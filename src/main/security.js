'use strict';

const { shell } = require('electron');
const { hostFromUrl, createHostGate } = require('./hosts');
const blocklist = require('./blocklist');
const keyboard = require('./keyboard');
const bundled = require('./bundled');

// Schemes the page may use internally. Everything else -- mailto:, steam:,
// itms-apps:, ms-windows-store:, file: -- is a way to launch another program
// and is refused outright.
const INTERNAL_SCHEMES = new Set(['data:', 'blob:', 'about:', 'filesystem:']);
const WEB_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

// The only two capabilities a game legitimately needs.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'pointerLock']);

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
    allowsHost (host) { return this.verdict(host) === 'allow'; },
    allowsUrl (url) {
      // A bundled app is confined to its own origin. Nothing else on this
      // scheme, and no web address, because it has no business on the network.
      if (bundled.isBundledUrl(url)) return bundled.belongsTo(url, bundleId);
      // A bundled app has no business on the network at all.
      if (bundleId) return false;
      return WEB_SCHEMES.has(schemeOf(url)) && this.verdict(hostFromUrl(url)) === 'allow';
    },
    tally (key) { if (key in counts) counts[key] += 1; }
  };
}

/**
 * Locks down the isolated session the kid's content runs in.
 */
function configureSession (ses, policy, { onBlocked } = {}) {
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
  ses.setPermissionRequestHandler((contents, permission, callback) => {
    const granted = ALLOWED_PERMISSIONS.has(permission);
    if (!granted) console.log(`[perm] denied: ${permission}`);
    callback(granted);
  });

  ses.setPermissionCheckHandler((contents, permission) => ALLOWED_PERMISSIONS.has(permission));

  // Hardware pickers: refuse by handing back an empty selection.
  ses.setDevicePermissionHandler(() => false);
  if (typeof ses.setBluetoothPairingHandler === 'function') {
    ses.setBluetoothPairingHandler((details, callback) => callback({ confirmed: false }));
  }

  // --- no downloads, ever ---
  ses.on('will-download', (event, item) => {
    policy.tally('downloads');
    console.log(`[download] cancelled: ${item.getFilename()}`);
    item.cancel();
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
