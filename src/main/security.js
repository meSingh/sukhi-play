'use strict';

const { shell } = require('electron');
const { hostFromUrl, createHostGate } = require('./hosts');
const blocklist = require('./blocklist');
const fs = require('node:fs');
const path = require('node:path');
const keyboard = require('./keyboard');
const bundled = require('./bundled');

// What a bundled app is allowed to write. A picture, and nothing else: the
// list is short so that adding to it has to be a decision somebody makes.
const SAVEABLE = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp']
]);

/** The extension for a download, from its type rather than its name. */
function pickExtension (item) {
  const byType = SAVEABLE.get(String(item.getMimeType() || '').toLowerCase());
  if (byType) return byType;
  // A blob: url often arrives with no useful type, so fall back to the
  // extension the page asked for -- checked against the same short list.
  const ext = path.extname(String(item.getFilename() || '')).toLowerCase();
  return [...SAVEABLE.values()].includes(ext) ? ext : null;
}

// Schemes the page may use internally. Everything else -- mailto:, steam:,
// itms-apps:, ms-windows-store:, file: -- is a way to launch another program
// and is refused outright.
const INTERNAL_SCHEMES = new Set(['data:', 'blob:', 'about:', 'filesystem:']);
const WEB_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

// What any app may have without being asked for.
//
// Fullscreen used to be here, and it was the wrong call. A page that goes
// fullscreen covers the top bar, which is the only thing on screen telling a
// child how to get back -- the Back button and the grown-up button both
// disappear under the game. Escape gets you out, but a three-year-old does not
// know that, and a way out only an adult can find is not a way out. So the bar
// stays, always, and a page asking for the whole screen is refused.
const ALLOWED_PERMISSIONS = new Set(['pointerLock']);

function schemeOf (url) {
  try {
    return new URL(url).protocol;
  } catch {
    return '';
  }
}

/**
 * Holds the allow/deny rules for whichever app is currently open, plus the
 * running tally of what has been cut. Swapped wholesale when a new app launches.
 */
function createPolicy () {
  let gate = createHostGate({ allow: [], deny: [] });
  let activeAppId = null;
  // Set while the open app is one that ships inside the download: the id in
  // its URL, which is NOT the catalog id. A catalog id is derived from the
  // title a parent typed and renamed on collision, so comparing against it
  // blocked an app whose tile had been given any other name.
  let bundleId = null;
  // Extra capabilities this one app may ask for, on top of ALLOWED_PERMISSIONS.
  // Empty for everything that has not been given one deliberately.
  let extraPermissions = new Set();
  // Where a bundled app's pictures go. Set once at start-up.
  let saveDir = null;
  let blockAds = true;
  // While probing a new site we want to SEE what it loads rather than cut it.
  // Known ad hosts are still refused -- there is no reason to pull adverts down
  // just to find out a site's hostnames.
  let probing = false;
  const counts = { ads: 0, offlist: 0, popups: 0, navigations: 0, downloads: 0 };
  // Kept so `npm run check` can report which hosts a site actually needed.
  const seen = { allowed: new Map(), blocked: new Map() };

  return {
    get activeAppId () { return activeAppId; },
    get blockAds () { return blockAds; },
    get probing () { return probing; },
    startProbe () {
      probing = true;
      blockAds = true;
      activeAppId = '__probe__';
      bundleId = null;
      gate = createHostGate({ allow: [], deny: [] });
      for (const key of Object.keys(counts)) counts[key] = 0;
      seen.allowed.clear();
      seen.blocked.clear();
    },
    endProbe () { probing = false; },
    get counts () { return { ...counts }; },
    get seenHosts () {
      const toSorted = (map) => [...map.entries()]
        .map(([host, v]) => [host, v.count, v.sample])
        .sort((a, b) => b[1] - a[1]);
      return { allowed: toSorted(seen.allowed), blocked: toSorted(seen.blocked) };
    },
    note (bucket, host, reason, url) {
      if (!host) return;
      const map = seen[bucket];
      if (!map) return;
      const key = bucket === 'blocked' ? `${host} (${reason})` : host;
      const prev = map.get(key);
      if (prev) prev.count += 1;
      else map.set(key, { count: 1, sample: url || '' });
    },
    get totalBlocked () {
      return counts.ads + counts.offlist + counts.popups + counts.navigations + counts.downloads;
    },
    setApp (app) {
      activeAppId = app ? app.id : null;
      bundleId = app && app.bundled ? bundled.idOf(app.url) : null;
      blockAds = app ? app.blockAds !== false : true;
      extraPermissions = new Set(
        Array.isArray(app && app.permissions) ? app.permissions : []);
      gate = createHostGate({
        allow: app ? app.allowHosts : [],
        deny: app ? app.denyHosts : []
      });
      for (const key of Object.keys(counts)) counts[key] = 0;
      seen.allowed.clear();
      seen.blocked.clear();
    },
    clear () { this.setApp(null); },
    verdict (host) {
      const v = gate.verdict(host);
      // Everything real is permitted during a probe, so the recorded list is
      // the site's actual set of hosts rather than whatever survived a guess.
      if (probing && v === 'deny-not-allowed') return 'allow';
      return v;
    },
    // Both of these go through verdict() rather than the raw gate, so there is
    // exactly one place that decides whether a host is permitted. Reading the
    // gate directly here meant navigation and request filtering could disagree
    // with each other during a probe.
    /**
     * Whether the app that is open may have this capability.
     *
     * Chromium asks under more than one name depending on how the page asked:
     * getUserMedia arrives as 'media', the older path as 'audioCapture'. Both
     * mean a microphone, so both are answered by the same entry.
     */
    allowsPermission (permission, details) {
      if (ALLOWED_PERMISSIONS.has(permission)) return true;
      if (!extraPermissions.size) return false;
      if (permission === 'media' || permission === 'audioCapture') {
        if (!extraPermissions.has('microphone')) return false;
        // 'media' is one permission covering microphone AND camera, and the
        // page says which it wants in mediaTypes. Granting the pair because
        // the microphone was asked for would hand a child's webcam to a
        // website. Audio only, and only when we can see that is all it wants.
        const types = details && details.mediaTypes;
        if (Array.isArray(types)) return types.length > 0 && types.every((t) => t === 'audio');
        return permission === 'audioCapture';
      }
      return extraPermissions.has(permission);
    },
    get permissions () { return [...extraPermissions]; },
    allowsHost (host) { return this.verdict(host) === 'allow'; },
    allowsUrl (url) {
      // A bundled app is confined to its own origin. Nothing else on this
      // scheme, and no web address, because it has no business on the network.
      if (bundled.isBundledUrl(url)) return bundled.belongsTo(url, bundleId);
      // A bundled app has no business on the network at all.
      if (bundleId) return false;
      return WEB_SCHEMES.has(schemeOf(url)) && this.verdict(hostFromUrl(url)) === 'allow';
    },
    tally (key) { if (key in counts) counts[key] += 1; },

    /**
     * Where a download may be written, or null for "nowhere".
     *
     * Only a bundled app may save anything, and only into the one folder set
     * up for it. The name is built here rather than taken from the page: a
     * filename arriving from content is a path, and a path can contain "..".
     */
    savePathFor (item) {
      if (!bundleId || !saveDir) return null;

      const ext = pickExtension(item);
      if (!ext) return null;

      const when = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
                    `-${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;

      try {
        fs.mkdirSync(saveDir, { recursive: true });
      } catch (err) {
        console.warn('[download] could not make the folder:', err.message);
        return null;
      }

      let file = path.join(saveDir, `${bundleId}-${stamp}${ext}`);
      // Three saves in the same second is exactly what a delighted child does.
      let n = 2;
      while (fs.existsSync(file)) {
        file = path.join(saveDir, `${bundleId}-${stamp}-${n}${ext}`);
        n += 1;
      }
      return file;
    },

    setSaveDir (dir) { saveDir = dir || null; }
  };
}

/**
 * Locks down the isolated session the kid's content runs in.
 */
function configureSession (ses, policy, { onBlocked, onSaved } = {}) {
  // --- every network request passes through here ---
  ses.webRequest.onBeforeRequest((details, callback) => {
    const { url, resourceType } = details;
    const scheme = schemeOf(url);

    if (INTERNAL_SCHEMES.has(scheme)) return callback({});

    // A bundled app reading its own files. Checked against the open app so one
    // bundled app can never pull another one's files into itself.
    if (scheme === `${bundled.SCHEME}:`) {
      if (policy.allowsUrl(url)) return callback({});
      policy.tally('offlist');
      log('bundled', url, 'not this app');
      return callback({ cancel: true });
    }

    if (!WEB_SCHEMES.has(scheme)) {
      // file:, mailto:, steam:, and friends. Never.
      policy.tally('offlist');
      log('scheme', url, scheme);
      return callback({ cancel: true });
    }

    const host = hostFromUrl(url);

    // Layer 1: known ad / tracker / popunder infrastructure. Skipped for sites
    // the parent has chosen to leave monetised -- the allowlist below still
    // confines the child to that site.
    const ad = policy.blockAds ? blocklist.inspect(url, host, resourceType) : null;
    if (ad) {
      policy.tally('ads');
      policy.note('blocked', host, ad.reason, url);
      log('ad', url, `${ad.reason}:${ad.detail}`);
      return callback({ cancel: true });
    }

    // Layer 2: the allowlist. Anything not essential to this app is cut,
    // whether or not we recognise it as an ad.
    const verdict = policy.verdict(host);
    if (verdict !== 'allow') {
      policy.tally('offlist');
      policy.note('blocked', host, verdict, url);
      log('offlist', url, verdict);
      return callback({ cancel: true });
    }

    policy.note('allowed', host);
    callback({});
  });

  function log (kind, url, detail) {
    if (typeof onBlocked === 'function') onBlocked(kind, url, detail);
  }

  // --- capabilities ---
  // A capability is granted only where the app's own entry asked for it, so
  // "the music site may use the microphone" never becomes "any site may".
  // Video is never granted: nothing here has a reason to watch a child.
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const granted = policy.allowsPermission(permission, details);
    console.log(granted
      ? `[perm] granted to this app: ${permission}`
      : `[perm] denied: ${permission}`);
    callback(granted);
  });

  // The check handler has no mediaTypes to inspect, so it can only say whether
  // the app has been given the microphone at all; the request handler above is
  // where audio-only is actually enforced.
  ses.setPermissionCheckHandler((contents, permission) => policy.allowsPermission(permission));

  // Hardware pickers: refuse by handing back an empty selection.
  ses.setDevicePermissionHandler(() => false);
  if (typeof ses.setBluetoothPairingHandler === 'function') {
    ses.setBluetoothPairingHandler((details, callback) => callback({ confirmed: false }));
  }

  // --- no downloads from the web, ever ---
  //
  // One exception, and only one: an app that ships inside Sukhi Play saving
  // the child's own picture. A colouring book whose save button does nothing
  // is a colouring book with a broken promise, and the usual reasons to refuse
  // a download -- a file of unknown provenance, from a host we do not control,
  // landing somewhere the child can run it -- are all absent here. The app is
  // on this disk, it has no network, and the file goes to one folder we pick.
  ses.on('will-download', (event, item) => {
    const save = policy.savePathFor(item);
    if (!save) {
      policy.tally('downloads');
      console.log(`[download] cancelled: ${item.getFilename()}`);
      item.cancel();
      return;
    }

    // Setting the path is what stops Electron opening a save dialog. A file
    // browser is exactly the thing a kiosk must never put in front of a child.
    item.setSavePath(save);
    item.once('done', (_e, state) => {
      if (state === 'completed') {
        console.log(`[download] saved ${save}`);
        if (typeof onSaved === 'function') onSaved(save);
      } else {
        console.warn(`[download] ${state}: ${save}`);
      }
    });
  });

  // Present as plain Chrome. Some sites behave oddly or nag when they spot
  // "Electron" in the user agent string.
  const ua = ses.getUserAgent()
    .replace(/ Electron\/[\d.]+/g, '')
    .replace(/ Sukhi Play\/[\d.]+/gi, '');
  ses.setUserAgent(ua);

  ses.setSpellCheckerEnabled(false);

  return ses;
}

/**
 * Applies the per-webContents rules. Called for the shell, the game view, and
 * anything either of them somehow spawns.
 *
 * @param {Electron.WebContents} contents
 * @param {object} opts
 * @param {boolean} opts.trusted   true only for our own local UI
 * @param {boolean} opts.isTopGame true for the top-level game frame
 */
function hardenWebContents (contents, opts = {}) {
  const {
    policy,
    trusted = false,
    isTopGame = false,
    label = 'view',
    onParentEscape,
    onBlockedNavigation
  } = opts;

  // --- no new windows, tabs, or popups. Not once. ---
  contents.setWindowOpenHandler((details) => {
    const { url } = details;
    // A legitimate "open this game in a new tab" from the top game frame is
    // honoured by navigating in place instead -- still no window is created.
    if (isTopGame && policy && policy.allowsUrl(url)) {
      console.log(`[popup] redirected in place: ${url}`);
      contents.loadURL(url).catch(() => {});
      return { action: 'deny' };
    }
    if (policy) policy.tally('popups');
    console.log(`[popup] denied: ${url}`);
    if (typeof onBlockedNavigation === 'function') onBlockedNavigation(url, 'popup');
    return { action: 'deny' };
  });

  if (!trusted) {
    const guardNavigation = (event, url, kind) => {
      if (policy && policy.allowsUrl(url)) return;
      event.preventDefault();
      if (policy) policy.tally('navigations');
      console.log(`[nav] blocked ${kind}: ${url}`);
      if (typeof onBlockedNavigation === 'function') onBlockedNavigation(url, kind);
    };

    contents.on('will-navigate', (e, url) => guardNavigation(e, url, 'navigate'));
    contents.on('will-redirect', (e, url) => guardNavigation(e, url, 'redirect'));
    // Fires for iframes, which is where ad redirects usually start.
    contents.on('will-frame-navigate', (e) => {
      if (e.url) guardNavigation(e, e.url, 'frame');
    });
  }

  // --- no right-click menu ---
  contents.on('context-menu', (event) => event.preventDefault());

  // --- no devtools ---
  contents.on('devtools-opened', () => {
    console.log('[devtools] force-closed');
    contents.closeDevTools();
  });

  // --- "are you sure you want to leave?" traps are auto-dismissed ---
  contents.on('will-prevent-unload', (event) => {
    console.log('[unload] auto-dismissed a leave-confirmation dialog');
    event.preventDefault(); // preventDefault here means "leave anyway"
  });

  // --- no HTTP auth popups, no client-cert pickers ---
  contents.on('login', (event) => event.preventDefault());
  contents.on('select-client-certificate', (event) => event.preventDefault());

  // --- bad certificates are never overridden ---
  contents.on('certificate-error', (event, url, error, cert, callback) => {
    console.log(`[cert] rejected ${url}: ${error}`);
    callback(false);
  });

  // --- keyboard ---
  keyboard.attach(contents, { onParentEscape, label });

  return contents;
}

/**
 * Belt-and-braces: catch any webContents created anywhere in the app, including
 * ones we did not make ourselves, and refuse the dangerous webview options.
 */
function installGlobalHardening (app, getPolicy) {
  app.on('web-contents-created', (event, contents) => {
    const type = contents.getType();
    if (type === 'window' || type === 'browserView' || type === 'webview') {
      // Already hardened explicitly where we create them; this is the net for
      // anything unexpected.
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }

    contents.on('will-attach-webview', (e, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      const policy = typeof getPolicy === 'function' ? getPolicy() : null;
      if (policy && !policy.allowsUrl(params.src)) {
        console.log(`[webview] refused: ${params.src}`);
        e.preventDefault();
      }
    });
  });

  // Nothing in this app should ever hand a URL to the operating system.
  // Wrapping it makes an accidental call loud instead of silent.
  const realOpenExternal = shell.openExternal;
  shell.openExternal = async (url) => {
    console.warn(`[shell] refused to open externally: ${url}`);
    return undefined;
  };
  shell.openExternal.restore = () => { shell.openExternal = realOpenExternal; };
}

module.exports = {
  createPolicy,
  configureSession,
  hardenWebContents,
  installGlobalHardening,
  ALLOWED_PERMISSIONS,
  WEB_SCHEMES
};
