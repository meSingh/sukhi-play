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

  try {
    report('loading');
    await contents.loadURL(target).catch(() => {});
    finalUrl = safeUrl(contents) || target;
    title = (contents.getTitle() || '').trim();

    report('watching');
    await wait(seconds * 1000);

    finalUrl = safeUrl(contents) || finalUrl;
    title = (contents.getTitle() || title).trim();
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  probeSite, normalizeUrl, summarise, prettyTitle, PROBE_SECONDS
};
