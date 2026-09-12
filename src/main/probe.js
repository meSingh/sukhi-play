'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { WebContentsView, net } = require('electron');
const { hostFromUrl, registrableDomain, normalizeHost } = require('./hosts');
const blocklist = require('./blocklist');

const PROBE_SECONDS = 12;

/**
 * Opens a site once, off-screen, and reports what it actually loads.
 *
 * This is what makes the app usable without asking a parent to understand
 * hostnames. They type a domain; we visit it, watch every request, and turn the
 * result into an allowlist. It is the same machinery `npm run check` uses,
 * driven from the interface instead of the terminal.
 *
 * Nothing is saved and no tile is created here -- the parent sees what was
 * found and decides.
 */
async function probeSite ({ win, shellView, session, policy, url, seconds = PROBE_SECONDS, onProgress }) {
  const target = normalizeUrl(url);
  if (!target) return { ok: false, message: 'That does not look like a web address.' };

  const view = new WebContentsView({
    webPreferences: {
      session,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
      javascript: true,
      // Nothing the probe page does should be able to talk to us.
      disableDialogs: true,
      safeDialogs: true,
      navigateOnDragDrop: false
    }
  });

  const contents = view.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.setAudioMuted(true);

  policy.startProbe();

  // Sit the probe underneath the parent's screen so it renders (an unattached
  // view does not lay out) without ever being visible.
  const [w, h] = win.getContentSize();
  win.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: w, height: h });
  win.contentView.addChildView(shellView);   // keep our UI on top

  const report = (stage) => { if (typeof onProgress === 'function') onProgress(stage); };

  let finalUrl = target;
  let title = '';
  let iconUrls = [];
  let iconData = null;

  try {
    report('loading');
    await contents.loadURL(target).catch(() => {});
    finalUrl = safeUrl(contents) || target;
    title = (contents.getTitle() || '').trim();

    report('watching');
    await wait(seconds * 1000);

    finalUrl = safeUrl(contents) || finalUrl;
    title = (contents.getTitle() || title).trim();
    iconUrls = await collectIconUrls(contents).catch(() => []);
    // Fetched now, not on save, so the parent can actually see the site's own
    // icon while choosing rather than discovering it afterwards.
    iconData = await fetchIconData(iconUrls).catch(() => null);
  } finally {
    try { win.contentView.removeChildView(view); } catch { /* already detached */ }
    try { if (!contents.isDestroyed()) contents.close(); } catch { /* gone */ }
  }

  const { allowed, blocked } = policy.seenHosts;
  policy.endProbe();

  const essential = summarise(allowed.map(([host]) => host));
  const adLike = summarise(blocked.map(([entry]) => entry.split(' ')[0]));

  return {
    ok: true,
    url: finalUrl,
    title: title || hostFromUrl(finalUrl),
    suggestedTitle: prettyTitle(title, finalUrl),
    allowHosts: essential,
    blockedHosts: adLike,
    hostCount: allowed.length,
    blockedCount: blocked.length,
    iconUrls,
    icon: iconData,
    // A site that loaded nothing is usually offline or refused to render.
    warning: allowed.length === 0
      ? 'Nothing loaded. Check the address, and check this machine is online.'
      : null
  };
}

/** Collapses recorded hostnames into the short list that goes on an allowlist. */
function summarise (hosts) {
  const out = new Set();
  for (const host of hosts) {
    const d = registrableDomain(host);
    if (d) out.add(d);
  }
  return [...out].sort();
}

function normalizeUrl (input) {
  let raw = String(input || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function safeUrl (contents) {
  try { return contents.isDestroyed() ? null : contents.getURL(); } catch { return null; }
}

function prettyTitle (title, url) {
  const host = registrableDomain(hostFromUrl(url));
  const base = (host || '').split('.')[0];
  const fromHost = base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Site';
  if (!title) return fromHost;
  // Page titles are long and full of taglines; a tile has room for one word.
  const first = title.split(/[|–,\-:·]/)[0].trim();
  const pick = first.length >= 3 && first.length <= 14 ? first : fromHost;
  return pick;
}

async function collectIconUrls (contents) {
  if (contents.isDestroyed()) return [];
  const found = await contents.executeJavaScript(`
    (() => {
      const out = [];
      for (const el of document.querySelectorAll('link[rel~="icon" i], link[rel~="apple-touch-icon" i]')) {
        const href = el.getAttribute('href');
        if (!href) continue;
        const sizes = el.getAttribute('sizes') || '';
        const n = parseInt(sizes, 10);
        out.push({ href: new URL(href, location.href).toString(), size: Number.isFinite(n) ? n : 0 });
      }
      out.push({ href: new URL('/favicon.ico', location.origin).toString(), size: 0 });
      return out;
    })()
  `, true);

  // Biggest first: a 180px apple-touch-icon makes a far better tile than a 16px favicon.
  return [...new Map(found.map((i) => [i.href, i])).values()]
    .sort((a, b) => b.size - a.size)
    .map((i) => i.href)
    .slice(0, 6);
}

const ICON_TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico'
};

function typeOf (header) {
  const base = String(header || '').split(';')[0].trim().toLowerCase();
  return ICON_TYPES[base] ? base : null;
}

/**
 * Fetches the first usable icon and hands it back as a data URI, without
 * touching the disk. Nothing is saved for a site the parent may not add.
 */
async function fetchIconData (urls) {
  for (const url of (urls || []).slice(0, 4)) {
    try {
      const res = await net.fetch(url, { credentials: 'omit' });
      if (!res.ok) continue;
      const type = typeOf(res.headers.get('content-type'));
      if (!type) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64 || buf.length > 256 * 1024) continue;
      return { url, dataUri: `data:${type};base64,${buf.toString('base64')}` };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Downloads the first icon that works and stores it beside the catalog.
 * Returns a path, or null -- a missing icon just means the tile keeps its shape.
 */
async function downloadIcon ({ urls, userDataDir, id }) {
  const dir = path.join(userDataDir, 'icons');
  for (const url of urls || []) {
    try {
      const res = await net.fetch(url, { credentials: 'omit' });
      if (!res.ok) continue;
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (!type.startsWith('image/')) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64 || buf.length > 2 * 1024 * 1024) continue;

      const ext = type.includes('png') ? 'png'
        : type.includes('svg') ? 'svg'
        : type.includes('jpeg') || type.includes('jpg') ? 'jpg'
        : type.includes('webp') ? 'webp'
        : type.includes('icon') || type.includes('ico') ? 'ico' : null;
      if (!ext) continue;

      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${id}.${ext}`);
      fs.writeFileSync(file, buf);
      return file;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  probeSite, downloadIcon, fetchIconData, normalizeUrl, summarise, prettyTitle, PROBE_SECONDS
};
