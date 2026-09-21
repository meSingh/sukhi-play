'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { app, session, ipcMain, Menu, nativeImage, net, protocol } = require('electron');

const settingsStore = require('./settings');
const catalogStore = require('./catalog');
const security = require('./security');
const shortcuts = require('./shortcuts');
const gnome = require('./gnome');
const startMenu = require('./startmenu');
const { createClock } = require('./playclock');
const probe = require('./probe');
const library = require('./library');
const { Shell, BAR_HEIGHT: BAR_HEIGHT_FALLBACK } = require('./windowing');
const bundled = require('./bundled');

const RELEASES_URL = 'https://github.com/meSingh/sukhi-play/releases/latest';

const IS_DEV = process.argv.includes('--dev');
const SESSION_PARTITION = 'persist:sukhi-kidzone';

// `--check[=appId]` opens an app, watches it for a few seconds, then prints
// which hosts it actually needed and what was cut, and exits. Run it after
// adding a site to catalog.json to see whether the allowlist is right.
const CHECK_ARG = process.argv.find((a) => a === '--check' || a.startsWith('--check='));
const CHECK_MODE = Boolean(CHECK_ARG);
const CHECK_APP_ID = CHECK_ARG && CHECK_ARG.includes('=') ? CHECK_ARG.split('=')[1] : null;
const CHECK_SECONDS = Number(process.env.CHECK_SECONDS || 14);

// `--probe <url>` visits a site once and prints the allowlist it would need.
// Same machinery the in-app "Add a site" wizard uses, driven from a terminal.
// `--diagnose` prints where the window actually ended up, and where the top bar
// ended up inside it, then quits. Paste the output into a bug report: window
// geometry is the one thing that cannot be reasoned about from another machine.
const DIAGNOSE = process.argv.includes('--diagnose');

// `--shots=DIR` walks the interface through each state worth showing and writes
// a PNG per state. Store listings and the README both need these, and a
// screenshot taken from the real app beats one taken from a mock.
// `--cover-probe` measures each way of covering the screen and reports what
// the window manager actually did with it. Windows left the taskbar visible and
// there is no way to tell from another platform whether that is the window
// being the wrong size or the taskbar being drawn over a correctly sized one.
const COVER_PROBE = process.argv.includes('--cover-probe');

// `--key-probe` asks the OS which accelerators it will actually hand over.
// globalShortcut.register returns false when the system keeps a key for
// itself, so this reports what is genuinely holdable on this platform instead
// of assuming. The Windows key and Print Screen were never registered at all.
const KEY_PROBE = process.argv.includes('--key-probe');

// `--start-probe` presses the Windows key over the kiosk and reports whether
// the Start menu was closed and the window came back to the front.
const START_PROBE = process.argv.includes('--start-probe');

// `--gate-check` walks the grown-up gate the way a parent does: hold the
// button, answer the sum wrongly, then correctly, and report what happened.
// The gate is the one thing in here that keeps a child out, so it is worth
// being able to watch it work rather than trusting that it does.
const GATE_CHECK = process.argv.includes('--gate-check');

// `--bundled-check=DIR` opens each app that ships inside the download, proves
// it drew something, and proves it cannot reach anything else. A bundled app
// is code somebody else wrote running next to a child, so "it loaded" is not
// the interesting question; "and nothing else did" is.
const BUNDLED_ARG = process.argv.find((a) => a.startsWith('--bundled-check'));
const BUNDLED_CHECK = BUNDLED_ARG
  ? (BUNDLED_ARG.includes('=') ? BUNDLED_ARG.slice(BUNDLED_ARG.indexOf('=') + 1) : true)
  : null;

// `--portal-shots=DIR` captures each tab of the grown-up screen.
const PORTAL_ARG = process.argv.find((a) => a.startsWith('--portal-shots='));
const PORTAL_SHOTS = PORTAL_ARG ? PORTAL_ARG.slice('--portal-shots='.length) : null;

// `--demo=DIR` records the app for the website: it drives the real screens and
// writes a PNG per frame. No mock, no reconstruction, and a throwaway profile
// so the recording never contains anyone's own list of sites.
const DEMO_ARG = process.argv.find((a) => a.startsWith('--demo='));
const DEMO_DIR = DEMO_ARG ? DEMO_ARG.slice('--demo='.length) : null;

const SHOTS_ARG = process.argv.find((a) => a.startsWith('--shots='));
const SHOTS_DIR = SHOTS_ARG ? SHOTS_ARG.slice('--shots='.length) : null;

// Each diagnostic run also saves what it printed to a text file on the Desktop.
// Installed builds are how most people run this, and on Windows an installed
// app is a windowed program: its output usually never reaches the terminal it
// was started from. A file can be attached to a bug report by anyone.
const REPORT_NAME = DIAGNOSE ? 'diagnose' : COVER_PROBE ? 'cover-probe' : KEY_PROBE ? 'key-probe'
  : START_PROBE ? 'start-probe' : GATE_CHECK ? 'gate-check'
  : BUNDLED_CHECK ? 'bundled-check' : null;
const reportLines = [];
if (REPORT_NAME) {
  const log = console.log.bind(console);
  console.log = (...args) => {
    reportLines.push(args.map(String).join(' '));
    log(...args);
  };
}

function saveReport () {
  if (!REPORT_NAME) return;
  const name = `sukhi-play-${REPORT_NAME}.txt`;
  const text = reportLines.join('\n') + '\n';
  for (const dir of [app.getPath('desktop'), app.getPath('userData')]) {
    try {
      const file = path.join(dir, name);
      fs.writeFileSync(file, text);
      process.stdout.write(`\n  Report saved to ${file}\n\n`);
      return;
    } catch { /* not writable here, try the next place */ }
  }
}

// True only when running from a Microsoft Store (MSIX) package.
const STORE_BUILD = Boolean(process.windowsStore);

const PROBE_ARG = process.argv.find((a) => a.startsWith('--probe='));
const PROBE_URL = PROBE_ARG ? PROBE_ARG.split('=').slice(1).join('=') : null;
const PROBE_MODE = Boolean(PROBE_URL);

// --- one instance only ------------------------------------------------------
// Two copies of a kiosk app fighting over always-on-top is a bad time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// No application menu means no Cmd+Q / Ctrl+W accelerators wired up by Electron,
// and no menu bar for a small person to discover.
Menu.setApplicationMenu(null);

// Chromium-level hardening, applied before anything loads.
app.commandLine.appendSwitch('disable-features', 'Translate,MediaRouter,AutofillServerCommunication');
app.enableSandbox();

let shellApp = null;
let playClock = null;
let policy = null;
let settings = null;
let catalog = null;
let paths = {};
let bundledApps = [];
let suggestions = [];
let probeBusy = false;

// --- the grown-up gate ------------------------------------------------------

/**
 * Gate state lives only in the main process. The page animates the hold button,
 * but it is this clock that decides whether the hold actually happened, and any
 * PIN is compared here -- so there is nothing in the page to read or fake.
 */
const gate = {
  openedAt: 0,
  wrongAttempts: 0,
  lockedUntil: 0,
  // The addition currently being asked, when gateMode is 'sum'. Generated
  // here, never in the page: a check the page could read is not a check.
  sum: null,
  // Set once the grown-up has answered correctly. Quitting is only honoured
  // while this is true, and it expires so a solved gate left open on the couch
  // does not stay solved.
  unlockedUntil: 0
};

// Overridable so the sliding behaviour can be exercised without a 90s test.
const UNLOCK_WINDOW_MS = Number(process.env.SUKHI_UNLOCK_MS || 90_000);

/**
 * A sliding window, not a stopwatch.
 *
 * It used to expire ninety seconds after unlocking no matter what, so a parent
 * who spent two minutes reading the list found that every switch and every
 * delete answered "not unlocked". Each successful action now pushes the expiry
 * out, so the window closes on idleness rather than on elapsed time.
 */
function isUnlocked () {
  if (Date.now() >= gate.unlockedUntil) return false;
  gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
  return true;
}

/**
 * In 'hold' mode the press-and-hold IS the check, so the elapsed time is
 * measured here rather than taken on trust from the page. The renderer animates
 * the button; the main process decides whether the hold really happened.
 */
function holdSatisfied () {
  if (!gate.openedAt) return false;
  const required = settings.holdSeconds * 1000;
  // A small tolerance for the renderer's animation frame timing.
  return (Date.now() - gate.openedAt) >= (required - 250);
}

/**
 * Makes up the addition a grown-up is asked after the hold.
 *
 * Both numbers are at least two, and the total is kept under twenty, so it is
 * a question any adult answers without thinking and a small child cannot.
 */
function newSum () {
  const pick = () => 2 + crypto.randomInt(8);      // 2..9
  const a = pick();
  const b = pick();
  gate.sum = { a, b, answer: a + b };
  return gate.sum;
}

function checkSum (given) {
  const now = Date.now();
  if (now < gate.lockedUntil) {
    const seconds = Math.ceil((gate.lockedUntil - now) / 1000);
    return { ok: false, message: `Wait ${seconds}s and try again.` };
  }
  if (!gate.sum) return { ok: false, message: 'Ask for the question first.' };

  if (Number(String(given).trim()) === gate.sum.answer) {
    gate.wrongAttempts = 0;
    gate.sum = null;
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    return { ok: true };
  }

  gate.wrongAttempts += 1;
  if (gate.wrongAttempts >= 3) {
    gate.wrongAttempts = 0;
    gate.lockedUntil = Date.now() + 10_000;
    gate.sum = null;
    return { ok: false, message: 'Too many tries. Wait 10 seconds.', locked: true };
  }
  // A new pair, so a wrong answer cannot be brute-forced by repetition.
  const next = newSum();
  return { ok: false, message: 'Not quite.', prompt: `What is ${next.a} + ${next.b}?` };
}

function checkPin (given) {
  const now = Date.now();
  if (now < gate.lockedUntil) {
    const seconds = Math.ceil((gate.lockedUntil - now) / 1000);
    return { ok: false, message: `Wait ${seconds}s and try again.` };
  }
  if (!settings.pin) return { ok: false, message: 'No PIN is set.' };

  const expected = Buffer.from(settings.pin, 'utf8');
  const actual = Buffer.from(String(given).trim(), 'utf8');
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (match) {
    gate.wrongAttempts = 0;
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    return { ok: true };
  }

  gate.wrongAttempts += 1;
  if (gate.wrongAttempts >= 3) {
    gate.wrongAttempts = 0;
    gate.lockedUntil = Date.now() + 10_000;
    return { ok: false, message: 'Too many tries. Wait 10 seconds.', locked: true };
  }
  return { ok: false, message: 'Not quite. Try again.' };
}

function quitForReal () {
  console.log('[quit] grown-up confirmed, closing down');
  shortcuts.releaseAll();
  if (!shellApp) return app.exit(0);
  shellApp.allowQuit = true;
  shellApp.destroyGameView();
  // app.quit() runs the close handlers; if anything refuses, exit anyway so a
  // confirmed quit can never turn into "it just went back to the games".
  app.quit();
  setTimeout(() => app.exit(0), 1500);
}

// --- focus guard ------------------------------------------------------------

/**
 * Pulls the window back to the front if the kid clicks away. Self-disables if it
 * ever starts fighting with another window, so a focus loop can never make the
 * machine unusable -- the parent can still reach the exit gate either way.
 */
function installFocusGuard (win) {
  let recentRefocuses = [];
  let disabled = false;

  win.on('blur', () => {
    if (disabled || IS_DEV) return;
    if (!settings.refocusOnBlur) return;
    if (!shellApp || shellApp.mode === 'gate') return;

    const now = Date.now();
    recentRefocuses = recentRefocuses.filter((t) => now - t < 10_000);
    if (recentRefocuses.length >= 15) {
      disabled = true;
      console.warn('[focus] refocus guard disabled: too many refocuses in 10s');
      return;
    }
    recentRefocuses.push(now);

    // On Windows the Start menu sits above every app window and focus requests
    // are refused, so the only thing that closes it is Escape.
    if (process.platform === 'win32') {
      startMenu.reclaim(win).then((result) => {
        if (result && result !== 'already in front') console.log(`[start menu] ${result}`);
      });
    }

    setTimeout(() => {
      if (!win.isDestroyed() && !win.isFocused()) {
        win.show();
        win.focus();
      }
    }, 120);
  });
}

// --- ipc --------------------------------------------------------------------

/** Plain numeric semver comparison. Returns true when a is newer than b. */
function isNewer (a, b) {
  const parse = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return false;
}

function pushApps () {
  if (!shellApp || !shellApp.shellView) return;
  const wc = shellApp.shellView.webContents;
  if (wc.isDestroyed()) return;
  wc.send('shell:apps', { apps: library.toTilePayload(catalog.apps) });
}

function findApp (appId) {
  return catalog.apps.find((a) => a.id === appId && a.enabled) || null;
}

function registerIpc () {
  ipcMain.handle('shell:ready', () => ({
    apps: library.toTilePayload(catalog.apps),
    state: shellApp.state(),
    settings: {
      holdSeconds: settings.holdSeconds,
      gateMode: settings.gateMode,
      showBlockCounter: settings.showBlockCounter
    },
    version: app.getVersion(),
    paths,
    catalogSource: catalog.source,
    isDev: IS_DEV,
    checkMode: CHECK_MODE || PROBE_MODE,
    // The walkthrough runs when nobody has set the app up yet. Without it a
    // parent's first sight of the app is an empty screen with no clue what to do.
    needsOnboarding: !settings.onboarded,
    // A Microsoft Store install is updated by the Store. Store policy does not
    // allow pointing people at another download source, so the check is hidden.
    storeBuild: STORE_BUILD
  }));

  ipcMain.handle('shell:launch', (_e, appId) => {
    if (playClock.isTimeUp()) {
      return { ok: false, message: 'Play time is over. Ask a grown-up.' };
    }
    const entry = findApp(appId);
    if (!entry) return { ok: false, message: 'That is not on the list.' };
    console.log(`[launch] ${entry.id} -> ${entry.url}`);
    return shellApp.launch(entry);
  });

  ipcMain.handle('shell:go-home', () => shellApp.goHome());

  /**
   * More time, granted by a grown-up who has just answered the gate.
   *
   * It extends this session only. The limit in settings is the standing rule
   * and is left alone, so ten minutes now is not ten minutes every day.
   */
  ipcMain.handle('shell:more-time', (_e, minutes) => {
    if (!isUnlocked()) return locked();
    const whole = minutes === 'day';
    const added = playClock.extend(whole ? 'day' : minutes);
    if (!added) return { ok: false, message: 'There is no limit running.' };
    playClock.setActive(shellApp.mode === 'launcher' || shellApp.mode === 'playing');
    shellApp.goHome();
    shellApp.pushState();
    const granted = whole ? 'the rest of the day' : `${Math.round(Number(minutes))} minutes`;
    console.log(`[clock] a grown-up added ${granted}; the ${settings.sessionMinutes || 0}-minute rule is unchanged`);
    return {
      ok: true,
      whole,
      minutes: whole ? 0 : Math.round(Number(minutes)),
      clock: playClock.state()
    };
  });

  /** How long a session lasts. 0 switches the limit off. */
  ipcMain.handle('shell:set-session-minutes', (_e, minutes) => {
    if (!isUnlocked()) return locked();
    settings = settingsStore.save(paths.userData, { sessionMinutes: minutes });
    playClock.setLimit(settings.sessionMinutes);
    shellApp.pushState();
    console.log(`[clock] session limit is now ${settings.sessionMinutes || 'off'}`);
    return { ok: true, sessionMinutes: settings.sessionMinutes, clock: playClock.state() };
  });

  ipcMain.handle('shell:begin-onboarding', () => {
    // Setting the app up IS the grown-up task, and at this point there is
    // nothing configured to protect. Granting the unlock lets the walkthrough
    // use the same add-a-site machinery as the grown-up screen.
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    console.log('[boot] first run: showing the walkthrough');
    shellApp.setMode('onboarding');
    return { ok: true };
  });

  ipcMain.handle('shell:finish-onboarding', () => {
    settings = settingsStore.save(paths.userData, { onboarded: true });
    gate.unlockedUntil = 0;
    console.log('[boot] walkthrough finished');
    shellApp.goHome();
    return { ok: true };
  });

  ipcMain.handle('shell:keep-unlocked', () => {
    // Held open while the parent is demonstrably still on a parent screen.
    // Reading a long list is not idleness.
    if (shellApp.mode !== 'onboarding' && shellApp.mode !== 'gate') return { ok: false };
    if (!isUnlocked()) return { ok: false };
    return { ok: true };
  });

  ipcMain.handle('shell:open-gate', (_e, intent) => {
    gate.wrongAttempts = 0;
    gate.openedAt = Date.now();
    return shellApp.openGate(intent);
  });

  ipcMain.handle('shell:close-gate', () => {
    gate.openedAt = 0;
    gate.unlockedUntil = 0;
    return shellApp.closeGate();
  });

  /**
   * The question, when the way in is a sum.
   *
   * Asked as the gate opens rather than after a hold: the sum is the check,
   * not a second one.
   */
  ipcMain.handle('shell:gate-question', () => {
    if (shellApp.mode !== 'gate') return { ok: false, message: 'not at the gate' };
    if (settings.gateMode !== 'sum') return { ok: false, message: 'no question here' };
    const now = Date.now();
    if (now < gate.lockedUntil) {
      const seconds = Math.ceil((gate.lockedUntil - now) / 1000);
      return { ok: false, message: `Wait ${seconds}s and try again.` };
    }
    const { a, b } = newSum();
    return { ok: true, prompt: `What is ${a} + ${b}?` };
  });

  ipcMain.handle('shell:complete-hold', () => {
    if (shellApp.mode !== 'gate') return { ok: false, message: 'not at the gate' };
    if (!holdSatisfied()) {
      return { ok: false, message: 'Hold the button a little longer.' };
    }
    if (settings.gateMode === 'sum') {
      // The sum replaced the hold. Holding must not open anything by itself,
      // which is the whole point of choosing it.
      return { ok: false, message: 'Answer the sum instead.' };
    }
    if (settings.gateMode === 'pin') {
      return { ok: true, needsAnswer: true, prompt: 'Enter the parent PIN' };
    }
    // Holding is the whole check. Unlock, but decide nothing: the grown-up
    // picks "close" or "back to the games" next.
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    return { ok: true, unlocked: true };
  });

  ipcMain.handle('shell:answer-gate', (_e, answer) => {
    if (shellApp.mode !== 'gate') return { ok: false, message: 'not at the gate' };
    if (settings.gateMode === 'hold') return { ok: false, message: 'no answer required' };
    // A PIN comes after the hold; a sum is instead of it.
    if (settings.gateMode === 'pin' && !holdSatisfied()) {
      return { ok: false, message: 'Hold the button first.' };
    }
    const result = settings.gateMode === 'sum' ? checkSum(answer) : checkPin(answer);
    if (result.ok) return { ok: true, action: 'unlocked' };
    return result;
  });

  /** Hold only, or hold and a sum. A parent chooses in Settings. */
  ipcMain.handle('shell:set-gate-mode', (_e, mode) => {
    if (!isUnlocked()) return locked();
    if (mode !== 'hold' && mode !== 'sum') {
      return { ok: false, message: 'That is not a way in.' };
    }
    settings = settingsStore.save(paths.userData, { gateMode: mode });
    console.log(`[gate] way in is now ${settings.gateMode}`);
    return { ok: true, gateMode: settings.gateMode };
  });


  /**
   * Opens the releases page, and nothing else.
   *
   * shell.openExternal is stubbed out app-wide on purpose so no page can ever
   * hand a URL to the operating system. This uses the platform opener directly
   * with a URL that is a constant in this file, never anything from a page.
   */
  ipcMain.handle('shell:open-releases', () => {
    if (!isUnlocked()) return locked();
    if (STORE_BUILD) return { ok: false, message: 'Updates arrive through the Microsoft Store.' };
    const opener = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    try {
      execFile(opener, [RELEASES_URL], () => {});
      return { ok: true };
    } catch {
      return { ok: false, message: 'Could not open the browser.' };
    }
  });

  ipcMain.handle('shell:quit', () => {
    if (!isUnlocked()) return { ok: false, message: 'not unlocked' };
    gate.unlockedUntil = 0;
    setTimeout(quitForReal, 80);
    return { ok: true };
  });

  // ---- the grown-up library. Every handler needs an unlocked gate. ----

  const locked = () => ({ ok: false, message: 'Not unlocked.' });

  function reloadCatalog () {
    catalog = catalogStore.load({
      userDataDir: paths.userData,
      bundledPath: path.join(__dirname, '..', '..', 'config', 'catalog.json')
    });
    paths.catalog = catalog.file;
    // The tile screen is rendered once at start-up, so it has to be told when
    // the list changes -- otherwise a game the parent just added is written to
    // disk correctly and never drawn.
    pushApps();
    if (shellApp) shellApp.pushState();
  }

  ipcMain.handle('shell:library', () => {
    if (!isUnlocked()) return locked();
    return {
      ok: true,
      // Everything an editor needs, not a read-only summary: a parent has to be
      // able to change any of this without opening a text file.
      mine: catalog.apps.map((a) => ({
        id: a.id, title: a.title, url: a.url, shape: a.shape, color: a.color,
        enabled: a.enabled, blockAds: a.blockAds, bundled: a.bundled,
        allowHosts: a.allowHosts, denyHosts: a.denyHosts, notes: a.notes
      })),
      // Ones already set up are dropped rather than greyed out -- a suggestion
      // you have taken is not a suggestion any more.
      // Apps that ship inside the download come first: they always work, and
      // "always works" is the thing a parent on a bad connection wants.
      suggestions: bundledSuggestions().concat(suggestions)
        .filter((s) => !catalog.apps.some((a) => a.url === s.url))
        .map((s) => ({
          id: s.id, title: s.title, siteName: s.siteName, blurb: s.blurb,
          url: s.url, shape: s.shape, color: s.color,
          category: s.category, adSupported: s.adSupported, blockAds: s.blockAds,
          bundled: s.bundled, credit: s.credit,
          notes: s.notes, allowHosts: s.allowHosts, denyHosts: s.denyHosts
        })),
      shapes: library.SHAPES,
      colors: library.COLORS
    };
  });

  ipcMain.handle('shell:site-exists', (_e, url) => {
    if (!isUnlocked()) return locked();
    const target = probe.normalizeUrl(String(url || ''));
    if (!target) return { ok: false, message: 'That does not look like a web address.' };
    const clash = catalog.apps.find((a) => a.url === target);
    return { ok: true, exists: Boolean(clash), title: clash ? clash.title : null, url: target };
  });

  ipcMain.handle('shell:probe-site', async (_e, url) => {
    if (!isUnlocked()) return locked();
    if (probeBusy) return { ok: false, message: 'Already checking a site.' };
    probeBusy = true;
    try {
      return await probe.probeSite({
        win: shellApp.win,
        shellView: shellApp.shellView,
        session: session.fromPartition(SESSION_PARTITION),
        policy,
        url: String(url || '')
      });
    } catch (err) {
      console.warn('[probe] failed:', err.message);
      return { ok: false, message: 'That site could not be checked.' };
    } finally {
      probeBusy = false;
      // The probe borrowed the policy. Put it back, and end probe mode here as
      // well as inside probeSite: if the probe threw part-way, leaving `probing`
      // set would quietly disable the allowlist for the child's next session.
      policy.endProbe();
      policy.clear();
    }
  });

  ipcMain.handle('shell:add-site', async (_e, entry) => {
    if (!isUnlocked()) return locked();
    if (!entry || typeof entry !== 'object') return { ok: false, message: 'Nothing to add.' };

    const result = library.addSite(paths.catalog, {
      title: entry.title,
      url: entry.url,
      shape: entry.shape,
      color: entry.color,
      allowHosts: entry.allowHosts,
      denyHosts: entry.denyHosts,
      blockAds: entry.blockAds !== false,
      notes: entry.notes,
      enabled: entry.enabled !== false
    });
    if (!result.ok) return result;

    reloadCatalog();
    console.log(`[library] added ${result.app.id} -> ${result.app.url}`);
    return { ok: true, app: result.app };
  });

  ipcMain.handle('shell:update-site', (_e, id, patch) => {
    if (!isUnlocked()) return locked();
    const result = library.updateSite(paths.catalog, String(id), patch || {});
    if (result.ok) reloadCatalog();
    return result;
  });

  /**
   * Wipes everything back to a first run.
   *
   * The app is relaunched rather than reloaded: settings and the catalog are
   * read once at start-up, so carrying on in the same process would leave the
   * old ones in memory and the next write would put them straight back.
   */
  ipcMain.handle('shell:reset-everything', () => {
    if (!isUnlocked()) return locked();
    try {
      fs.rmSync(path.join(paths.userData, 'catalog.json'), { force: true });
      fs.rmSync(path.join(paths.userData, 'settings.json'), { force: true });
      fs.rmSync(path.join(paths.userData, 'icons'), { recursive: true, force: true });
    } catch (err) {
      console.warn('[reset] could not clear settings:', err.message);
      return { ok: false, message: 'Could not clear the settings.' };
    }
    console.log('[reset] cleared, restarting into the walkthrough');
    shortcuts.releaseAll();
    gnome.giveBack(paths.userData);
    shellApp.allowQuit = true;
    app.relaunch();
    app.exit(0);
    return { ok: true };
  });

  /**
   * Asks GitHub whether there is a newer release. Checking only: a kiosk that
   * can rewrite itself is a worse problem than one that is out of date, so this
   * reports and links, and never downloads or installs anything.
   */
  ipcMain.handle('shell:check-update', async () => {
    if (!isUnlocked()) return locked();
    if (STORE_BUILD) return { ok: false, message: 'Updates arrive through the Microsoft Store.' };
    try {
      const res = await net.fetch(
        'https://api.github.com/repos/meSingh/sukhi-play/releases/latest',
        { credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return { ok: false, message: `GitHub returned ${res.status}.` };

      const body = await res.json();
      const latest = String(body.tag_name || '').replace(/^v/, '');
      if (!latest) return { ok: false, message: 'No release found.' };

      return {
        ok: true,
        current: app.getVersion(),
        latest,
        newer: isNewer(latest, app.getVersion()),
        url: body.html_url || RELEASES_URL
      };
    } catch (err) {
      return { ok: false, message: 'Could not reach GitHub.' };
    }
  });

  ipcMain.handle('shell:remove-site', (_e, id) => {
    if (!isUnlocked()) return locked();
    const result = library.removeSite(paths.catalog, String(id));
    if (result.ok) reloadCatalog();
    return result;
  });

}

// --- allowlist check ---------------------------------------------------------

function reportOne (entry) {
  const { allowed, blocked } = policy.seenHosts;
  const counts = policy.counts;
  const pad = (n) => String(n).padStart(5);

  console.log(`\n  == ${entry.id} ==\n`);
  console.log(`  LOADED (${allowed.length} hosts)`);
  if (!allowed.length) console.log('    (nothing loaded - is the allowlist too tight, or is the machine offline?)');
  for (const [host, n] of allowed) console.log(`  ${pad(n)}  ${host}`);

  console.log(`\n  BLOCKED (${blocked.length} hosts)`);
  for (const [host, n, sample] of blocked.slice(0, 40)) {
    console.log(`  ${pad(n)}  ${host}`);
    if (sample) console.log(`         ${sample.slice(0, 110)}`);
  }
  if (blocked.length > 40) console.log(`         ...and ${blocked.length - 40} more`);

  console.log(`\n  ads:${counts.ads}  off-list:${counts.offlist}  popups:${counts.popups}` +
              `  navigations:${counts.navigations}  downloads:${counts.downloads}`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCheck () {
  const enabled = catalog.apps.filter((a) => a.enabled);
  let entries;

  if (CHECK_APP_ID === 'all') {
    entries = enabled;
  } else if (CHECK_APP_ID) {
    const found = catalog.apps.find((a) => a.id === CHECK_APP_ID);
    entries = found ? [found] : [];
  } else {
    entries = enabled.slice(0, 1);
  }

  if (!entries.length) {
    console.error(`\n  No app to check${CHECK_APP_ID ? ` with id "${CHECK_APP_ID}"` : ''}.`);
    console.error(`  Available: ${catalog.apps.map((a) => a.id).join(', ')}\n`);
    shellApp.allowQuit = true;
    return app.exit(1);
  }

  // Switching between games is exactly the path that used to fall over, so
  // checking several in a row is also the regression test for it.
  const problems = [];

  for (const entry of entries) {
    console.log(`\n  Checking "${entry.title}" (${entry.url})`);
    console.log(`  Watching for ${CHECK_SECONDS} seconds...`);
    shellApp.launch(entry);

    await wait(CHECK_SECONDS * 1000);

    // If the app bounced back to the tiles on its own, that is the bug the
    // child experiences as a crash.
    if (shellApp.mode !== 'playing') {
      problems.push(`${entry.id}: dropped out of the game by itself (mode=${shellApp.mode})`);
    }
    if (shellApp.activeAppId !== entry.id) {
      problems.push(`${entry.id}: active app changed to ${shellApp.activeAppId}`);
    }
    // Games are keyboard-driven: if our bar holds focus instead of the game,
    // arrow keys and WASD go nowhere and the game looks frozen.
    const gc = shellApp.gameContents;
    const keyboardOnGame = Boolean(gc && gc.isFocused());
    if (!keyboardOnGame) {
      problems.push(`${entry.id}: keyboard focus is NOT on the game (arrow keys/WASD would not work)`);
    }
    reportOne(entry);
    console.log(`\n  keyboard focus on game: ${keyboardOnGame ? 'yes' : 'NO'}`);
  }

  if (entries.length > 1) {
    console.log(`\n  == switching ==\n`);
    if (problems.length) {
      for (const p of problems) console.log(`  PROBLEM  ${p}`);
    } else {
      console.log(`  ok  played ${entries.length} games back to back, stayed in the game each time`);
    }
  }

  console.log('\n  If the app looked broken, add the host it needed to allowHosts in catalog.json.\n');

  shortcuts.releaseAll();
  shellApp.allowQuit = true;
  app.exit(problems.length ? 1 : 0);
}

// Each entry puts the interface into one state and names the file. `run` gets
// the renderer's executeJavaScript so a step can click real controls rather
// than reaching past them into private state.
// Pauses every running animation at its first frame.
//
// Must not inject a <style> element: the renderer's CSP is `style-src 'self'`,
// which blocks one, silently as far as the injecting side can tell. An earlier
// version did exactly that, so nothing was ever frozen -- the only visible
// sign was a CSP violation in the renderer log. The Web Animations API touches
// no stylesheet and is not restricted.
const FREEZE_MOTION = `(() => {
  const running = document.getAnimations();
  for (const animation of running) {
    animation.currentTime = 0;
    animation.pause();
  }
  return running.length;
})()`;

function shotScript () {
  const js = (code) => shellApp.shellView.webContents.executeJavaScript(code);
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));

  // Every state starts from the launcher. openGate returns early when the gate
  // is already open, so without this a step inherits whatever the previous one
  // left on screen -- which produced a capture showing the add form and the
  // portal stacked on top of each other.
  const reset = async () => {
    shellApp.closeGate();
    shellApp.goHome();
    await js(FREEZE_MOTION);
    await settle(500);
  };

  const openPortal = async () => {
    await reset();
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    shellApp.openGate('portal');
    await js(`(async () => {
      for (const id of ['gate-step-hold', 'gate-step-answer', 'gate-step-form']) {
        document.getElementById(id).hidden = true;
      }
      document.getElementById('gate-step-library').hidden = false;
      document.querySelector('.gate-card').classList.add('is-portal');
      if (window.__showPortalTab) window.__showPortalTab('apps');
      const fn = window.__loadLibrary; if (fn) await fn();
      return 1;
    })()`);
    await settle(1400);
  };

  if (!settings.onboarded) {
    const step = async (clickId) => {
      await js(FREEZE_MOTION);
      if (clickId) {
        await js(`(() => { const b = document.getElementById('${clickId}');
          if (b) b.click(); return 1; })()`);
      }
      await settle(800);
    };
    return [
      {
        name: '00-first-run',
        caption: 'First run: nothing is allowed until a grown-up chooses',
        run: () => step(null)
      },
      {
        name: '00b-first-run-pick',
        caption: 'Setup offers a curated list, or any address you type',
        run: () => step('ob-parent')
      }
    ];
  }

  return [
    {
      name: '01-launcher',
      caption: 'What your child sees: only the apps you approved',
      run: async () => { await reset(); await settle(600); }
    },
    {
      name: '02-parent-portal',
      caption: 'The grown-up portal: every app, with a switch to hide it',
      run: openPortal
    },
    {
      name: '03-add-an-app',
      caption: 'Adding an app: type an address, it works out the rest',
      run: async () => {
        await openPortal();
        await js(`document.getElementById('add-new').click(); 1`);
        await settle(900);
        await js(`(() => {
          const u = document.getElementById('form-url');
          if (u) { u.value = 'poki.com'; u.dispatchEvent(new Event('input')); }
          return 1;
        })()`);
        await settle(500);
      }
    },
    {
      name: '04-suggestions',
      caption: 'Suggestions: a curated list, each one already checked',
      run: async () => {
        await openPortal();
        await js(`(() => {
          const s = document.getElementById('sec-suggest');
          if (s) s.scrollIntoView({ block: 'center', behavior: 'instant' });
          return 1;
        })()`);
        await settle(700);
      }
    },
    {
      name: '05-closing-needs-a-grownup',
      caption: 'Closing takes a steady press a small child will not manage',
      run: async () => {
        await reset();
        shellApp.openGate('quit');
        await settle(900);
      }
    }
  ];
}

async function runShots () {
  const fs = require('node:fs');
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const w = Number(process.env.SUKHI_SHOT_W || 1400);
  const h = Number(process.env.SUKHI_SHOT_H || 928);
  shellApp.win.setBounds({ x: 40, y: 40, width: w, height: h });
  shellApp.layout();
  await new Promise((r) => setTimeout(r, 1200));

  const index = [];
  for (const shot of shotScript()) {
    try {
      await shot.run();
      shellApp.layout();
      await new Promise((r) => setTimeout(r, 350));
      const image = await shellApp.shellView.webContents.capturePage();
      const file = require('node:path').join(SHOTS_DIR, `${shot.name}.png`);
      fs.writeFileSync(file, image.toPNG());
      const size = image.getSize();
      index.push({ name: shot.name, caption: shot.caption, ...size });
      console.log(`[SHOT] ${shot.name}  ${size.width}x${size.height}`);
    } catch (err) {
      console.log(`[SHOT] ${shot.name} FAILED: ${err.message}`);
      index.push({ name: shot.name, caption: shot.caption, error: err.message });
    }
  }

  // Onboarding and post-setup states come from separate runs writing into the
  // same directory, so merge rather than clobber.
  const capFile = require('node:path').join(SHOTS_DIR, 'captions.json');
  let merged = [];
  try { merged = JSON.parse(fs.readFileSync(capFile, 'utf8')); } catch { merged = []; }
  for (const entry of index) {
    const at = merged.findIndex((m) => m.name === entry.name);
    if (at >= 0) merged[at] = entry; else merged.push(entry);
  }
  merged.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(capFile, JSON.stringify(merged, null, 2) + '\n');
  console.log(`[SHOT] wrote ${index.filter((s) => !s.error).length}/${index.length} to ${SHOTS_DIR}`);

  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  gnome.giveBack(paths.userData);
  shellApp.allowQuit = true;
  app.exit(index.some((s) => s.error) ? 1 : 0);
}

async function runKeyProbe () {
  const { globalShortcut } = require('electron');

  const groups = {
    'bare modifiers and keys': [
      'Super', 'Meta', 'PrintScreen', 'Alt+PrintScreen', 'Super+PrintScreen',
      'Control+PrintScreen'
    ],
    'Windows key combinations': [
      'Super+D', 'Super+E', 'Super+R', 'Super+L', 'Super+S', 'Super+A',
      'Super+I', 'Super+X', 'Super+Tab', 'Super+M', 'Super+Up', 'Super+Down',
      'Super+Left', 'Super+Right', 'Super+Home', 'Super+P', 'Super+G',
      'Super+Shift+S', 'Super+Control+D', 'Super+Control+Left',
      'Super+Control+Right', 'Super+Control+F4', 'Super+Space', 'Super+;',
      'Super+.', 'Super+V', 'Super+K', 'Super+H', 'Super+W', 'Super+N',
      'Super+Plus', 'Super+-'
    ],
    'already held, as a control': [
      'Alt+Tab', 'F11', 'CommandOrControl+W'
    ],
    'deliberately left alone': [
      'Control+Shift+Escape', 'Control+Alt+Delete'
    ]
  };

  console.log('\n  ===== which accelerators will this OS hand over? =====\n');
  console.log(`  platform ${process.platform}\n`);

  const holdable = [];
  for (const [group, list] of Object.entries(groups)) {
    console.log(`  ${group}`);
    for (const accelerator of list) {
      let result;
      try {
        result = globalShortcut.register(accelerator, () => {}) ? 'held' : 'REFUSED';
      } catch (err) {
        result = 'threw: ' + err.message.split('\n')[0];
      }
      if (result === 'held') {
        holdable.push(accelerator);
        try { globalShortcut.unregister(accelerator); } catch { /* fine */ }
      }
      console.log(`      ${accelerator.padEnd(24)} ${result}`);
    }
    console.log('');
  }

  console.log('  Holdable list, ready to paste into shortcuts.js:');
  console.log('  ' + JSON.stringify(holdable));
  console.log('');
  console.log('  REFUSED means the OS keeps the key for itself and no amount of');
  console.log('  Electron will take it. That needs a native keyboard hook or a');
  console.log('  policy change, both out of scope for an app that promises to');
  console.log('  put everything back when it quits.\n');

  try { globalShortcut.unregisterAll(); } catch { /* nothing held */ }
  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  gnome.giveBack(paths.userData);
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

/**
 * Records the app doing the thing the website claims it does.
 *
 * The scenes are driven through the real interface: a real hold on the real
 * button, the real clock running out. Only the waiting is skipped, by pausing
 * the capture between scenes rather than by faking any state.
 */
async function runPortalShots () {
  const fs = require('node:fs');
  const path = require('node:path');
  const js = (code) => shellApp.shellView.webContents.executeJavaScript(code);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  fs.mkdirSync(PORTAL_SHOTS, { recursive: true });
  shellApp.win.setBounds({ x: 40, y: 40, width: 1400, height: 940 });
  shellApp.layout();
  await sleep(900);

  gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
  shellApp.openGate('portal');
  // The gate asks its question asynchronously. Hiding the steps before that
  // answer arrives means it puts the question straight back up again.
  await sleep(700);
  await js(`(async () => {
    for (const id of ['gate-step-hold', 'gate-step-answer', 'gate-step-form']) {
      document.getElementById(id).hidden = true;
    }
    document.getElementById('gate-step-library').hidden = false;
    document.querySelector('.gate-card').classList.add('is-portal');
    if (window.__markGatePassed) window.__markGatePassed();
    const fn = window.__loadLibrary; if (fn) await fn();
    return 1;
  })()`);
  await sleep(1200);

  // Does every panel actually reach its own bottom? The Save button sat below
  // the fold with no way to scroll to it, and a screenshot of the top of the
  // page would not have shown that.
  for (const tab of ['time', 'apps', 'catalog', 'settings', 'form']) {
    if (tab === 'form') {
      await js(`(() => { document.getElementById('add-new').click(); return 1; })()`);
      await sleep(500);
      await js(`(() => {
        const f = window.__fillDemoForm; if (f) f();
        return 1;
      })()`);
      await sleep(400);
    } else {
      await js(`(() => { window.__showPortalTab('${tab}'); return 1; })()`);
    }
    await sleep(400);
    const fit = await js(`(() => {
      const body = document.querySelector('#gate-step-library .portal-body');
      body.scrollTop = 1e6;
      const panel = document.querySelector('.portal-panel:not([hidden])');
      const last = panel.lastElementChild;
      const r = last.getBoundingClientRect();
      return JSON.stringify({
        scrollable: body.scrollHeight > body.clientHeight,
        scrolledTo: Math.round(body.scrollTop),
        lastVisible: r.bottom <= window.innerHeight + 1 && r.top >= 0
      });
    })()`);
    // Back to the top for the picture: a capture of a panel scrolled to its
    // end is not what a parent sees when they open it.
    await js(`(() => {
      document.querySelector('#gate-step-library .portal-body').scrollTop = 0;
      return 1;
    })()`);
    await sleep(300);
    const image = await shellApp.shellView.webContents.capturePage();
    fs.writeFileSync(path.join(PORTAL_SHOTS, `${tab}.png`), image.toPNG());
    console.log(`[PORTAL] ${tab} ${fit}`);
  }

  // And the other screen a parent sees: asking for more time, which is a box
  // with three choices and not the grown-up screen.
  shellApp.closeGate();
  await sleep(400);
  settings.sessionMinutes = settings.sessionMinutes || 20;
  playClock.setLimit(settings.sessionMinutes);
  shellApp.pushState();
  await sleep(200);
  shellApp.openGate('time');
  await sleep(500);
  await js(`(async () => {
    if (window.__markGatePassed) window.__markGatePassed();
    if (window.__afterUnlock) await window.__afterUnlock();
    return 1;
  })()`);
  await sleep(700);
  const more = await shellApp.shellView.webContents.capturePage();
  fs.writeFileSync(path.join(PORTAL_SHOTS, 'more-time.png'), more.toPNG());
  console.log('[PORTAL] more-time captured');

  shellApp.allowQuit = true;
  app.exit(0);
}

/**
 * Opens every bundled app for real and reports what it did and did not do.
 *
 * Three questions, in order of how much they matter: did it paint anything,
 * could it read its own files, and could it reach anything else. The last one
 * is asked from inside the app's own page, because that is where an answer
 * means something.
 */
async function runBundledCheck () {
  const fs = require('node:fs');
  const path = require('node:path');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (k, v) => console.log(`  ${String(k).padEnd(30)} ${v}`);

  console.log('\n  ===== apps that ship inside the download =====\n');
  if (bundledApps.length === 0) {
    console.log('  none on disk\n');
    return finishBundledCheck();
  }

  let allWell = true;

  for (const b of bundledApps) {
    console.log(`  --- ${b.title} (${b.credit || 'no credit recorded'}) ---`);

    // Installed the same way a parent installs it, from the catalogue entry,
    // so the check exercises the path that actually ships.
    const added = await ipcCall('shell:add-site', {
      title: b.title, url: b.url, shape: b.shape, color: b.color,
      allowHosts: [b.id], denyHosts: [], blockAds: true
    });
    const appId = added && added.app ? added.app.id : null;
    if (!appId) {
      say('installed', `FAILED: ${added && added.message}`);
      allWell = false;
      continue;
    }

    await ipcCall('shell:launch', appId);
    await sleep(2500);

    const view = shellApp.gameView;
    if (!view || view.webContents.isDestroyed()) {
      say('opened', 'FAILED: no view');
      allWell = false;
      continue;
    }
    const js = (code) => view.webContents.executeJavaScript(code, true);

    const here = await js('location.href');
    say('address', here);

    // Did it draw? An empty body means it loaded nothing that matters.
    const drew = await js(`(() => {
      const n = document.querySelectorAll('button, canvas, svg, img').length;
      return JSON.stringify({ parts: n, title: document.title, lang: document.documentElement.lang });
    })()`);
    const shape = JSON.parse(drew);
    say('drew', `${shape.parts} parts, title "${shape.title}", lang ${shape.lang}`);
    if (shape.parts < 3) allWell = false;

    // Its own files: reachable.
    const own = await js(`fetch('${b.url}').then(r => r.status).catch(e => 'threw: ' + e.message)`);
    say('its own files', own === 200 ? 'reachable' : `FAILED: ${own}`);
    if (own !== 200) allWell = false;

    // Everything else: not.
    const out = await js(`fetch('https://example.com/', { mode: 'no-cors' })
      .then(() => 'REACHED (bad)').catch(() => 'refused')`);
    say('the internet', out);
    if (out !== 'refused') allWell = false;

    // And another bundled app's files, which is the one thing our own scheme
    // could accidentally hand over.
    const other = await js(`fetch('sukhiplay://somewhere-else/index.html')
      .then(r => 'REACHED (bad): ' + r.status).catch(() => 'refused')`);
    say('another app\'s files', other);
    if (!String(other).startsWith('refused')) allWell = false;

    if (typeof BUNDLED_CHECK === 'string') {
      fs.mkdirSync(BUNDLED_CHECK, { recursive: true });
      const image = await view.webContents.capturePage();
      fs.writeFileSync(path.join(BUNDLED_CHECK, `${b.id}.png`), image.toPNG());
      say('picture', path.join(BUNDLED_CHECK, `${b.id}.png`));
    }

    shellApp.goHome();
    await sleep(400);
    console.log('');
  }

  console.log(allWell
    ? '  PASS: every bundled app runs, and none of them can reach anything else'
    : '  FAIL: see above');
  finishBundledCheck();
}

function finishBundledCheck () {
  console.log('');
  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

async function runGateCheck () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v}`);
  console.log('\n  ===== the grown-up gate =====\n');
  // The check is about the sum, so it sets the sum itself rather than trusting
  // whatever profile it happens to run against. A default profile is on hold,
  // and a check that silently tests the wrong thing is worse than no check.
  settings.gateMode = 'sum';
  say('way in', settings.gateMode);

  shellApp.openGate('portal');
  await sleep(400);
  gate.openedAt = Date.now();

  // A guess before the question exists must go nowhere.
  const early = await ipcCall('shell:answer-gate', '7');
  say('answering before the question', early.ok ? 'ACCEPTED (bad)' : `refused: ${early.message}`);

  // Holding is not the way in any more, and must open nothing by itself.
  gate.openedAt = Date.now() - (settings.holdSeconds * 1000) - 200;
  const held = await ipcCall('shell:complete-hold');
  say('holding the button', held.ok && held.unlocked ? 'UNLOCKED (bad)' : `refused: ${held.message}`);

  const asked = await ipcCall('shell:gate-question');
  say('the question', asked.prompt || `FAILED: ${asked.message}`);
  if (!gate.sum) {
    say('result', 'FAIL: no sum was asked');
    return finishGateCheck();
  }

  const right = gate.sum.answer;
  const wrong = right === 4 ? 5 : 4;
  const bad = await ipcCall('shell:answer-gate', String(wrong));
  say(`wrong answer (${wrong})`, bad.ok ? 'ACCEPTED (bad)' : `refused: ${bad.message}`);
  say('a fresh sum is asked', bad.prompt || '(none)');

  const answer = gate.sum ? gate.sum.answer : right;
  const good = await ipcCall('shell:answer-gate', String(answer));
  say(`right answer (${answer})`, good.ok ? 'accepted' : `REFUSED (bad): ${good.message}`);

  const passed = !early.ok && !(held.ok && held.unlocked) && !bad.ok && good.ok;
  say('result', passed
    ? 'PASS: only the right sum opens it, and holding does not'
    : 'FAIL: see above');
  finishGateCheck();
}

function finishGateCheck () {
  console.log('');
  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

/** Calls a registered IPC handler the way the page would. */
function ipcCall (channel, ...args) {
  const handler = ipcMain._invokeHandlers.get(channel);
  if (!handler) return Promise.resolve({ ok: false, message: `no handler for ${channel}` });
  return Promise.resolve(handler({}, ...args));
}

async function runDemo () {
  const fs = require('node:fs');
  const path = require('node:path');

  const js = (code) => shellApp.shellView.webContents.executeJavaScript(code);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  fs.mkdirSync(DEMO_DIR, { recursive: true });

  const w = Number(process.env.SUKHI_DEMO_W || 1280);
  const h = Number(process.env.SUKHI_DEMO_H || 800);
  shellApp.win.setBounds({ x: 40, y: 40, width: w, height: h });
  shellApp.layout();
  // The window has to be in front while this runs. A view that is covered by
  // another window is not painted, and capturePage then returns its background
  // colour and nothing else: a recording of an empty page.
  shellApp.win.show();
  shellApp.win.moveTop();
  if (process.platform === 'darwin') app.focus({ steal: true });
  await sleep(1200);

  let frame = 0;
  let capturing = false;
  let stopped = false;
  let latestGame = null;
  let subscribed = null;
  const FPS = 10;

  /** Takes painted frames from the site's view for as long as it exists. */
  const watchGame = () => {
    const wc = shellApp.gameView && shellApp.gameView.webContents;
    if (!wc || wc.isDestroyed() || wc === subscribed) return;
    subscribed = wc;
    latestGame = null;
    wc.setBackgroundThrottling(false);
    wc.beginFrameSubscription(false, (image) => {
      if (image && image.getSize().width > 0) latestGame = image;
    });
  };

  // The interface and the site a child is playing are two separate views, and
  // each is captured on its own. They are put back together when the frames
  // are assembled, using the gap between the two heights as the bar's height,
  // so nothing has to know the layout twice.
  const loop = (async () => {
    while (!stopped) {
      const started = Date.now();
      if (capturing) {
        const name = `f${String(frame++).padStart(4, '0')}`;
        try {
          const shell = await shellApp.shellView.webContents.capturePage();
          fs.writeFileSync(path.join(DEMO_DIR, `${name}.png`), shell.toPNG());
          // capturePage on the site's view comes back as its background
          // colour and nothing else, so the painted frames are taken from the
          // view's own frame stream instead.
          if (shellApp.mode === 'playing' && latestGame) {
            fs.writeFileSync(path.join(DEMO_DIR, `${name}.game.png`), latestGame.toPNG());
          }
        } catch { /* a frame lost to a resize is not worth stopping for */ }
      }
      await sleep(Math.max(0, (1000 / FPS) - (Date.now() - started)));
    }
  })();

  /** Records for `ms`, then stops the camera while the next scene is set up. */
  const scene = async (label, ms, setup) => {
    capturing = false;
    if (setup) await setup();
    await sleep(400);
    capturing = true;
    console.log(`[DEMO] ${label}`);
    await sleep(ms);
    capturing = false;
  };

  /** A tap inside the site, so the recording shows playing and not a still. */
  const tapGame = async (x, y) => {
    const wc = shellApp.gameView && shellApp.gameView.webContents;
    if (!wc || wc.isDestroyed()) return;
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  };

  await scene('the tile screen a child sees', 2600, async () => {
    shellApp.closeGate();
    shellApp.goHome();
  });

  await scene('opening a site, and playing it', 6000, async () => {
    await js(`(() => {
      const tile = document.querySelector('#tiles .tile');
      if (tile) tile.click();
      return 1;
    })()`);
    // Give the page time to load, and to be painted, before the camera starts.
    await sleep(2200);
    watchGame();
    const wc = shellApp.gameView && shellApp.gameView.webContents;
    if (wc && !wc.isDestroyed()) wc.focus();
    await sleep(900);
  });
  // The taps happen inside the recorded scene above's successor, so they land
  // on camera: four shapes, roughly a second apart.
  capturing = true;
  const taps = [[364, 324], [547, 324], [720, 324], [915, 324]];
  for (const [x, y] of taps) {
    await tapGame(x, y);
    await sleep(900);
  }
  capturing = false;

  // A short run for working on the recording itself: everything up to the
  // first play scene, then out, rather than sitting through a session.
  if (process.env.SUKHI_DEMO_QUICK) {
    const wc = shellApp.gameView && shellApp.gameView.webContents;
    if (wc && !wc.isDestroyed()) {
      const seen = await wc.executeJavaScript(
        `JSON.stringify({ url: location.href, text: document.body.innerText.slice(0, 40),
          bg: getComputedStyle(document.body).backgroundColor })`);
      const shot = await wc.capturePage();
      console.log(`[DEMO] site: ${seen}`);
      console.log(`[DEMO] site capture: ${JSON.stringify(shot.getSize())} empty=${shot.isEmpty()}`);
    } else {
      console.log('[DEMO] site: no game view at all');
    }
    stopped = true;
    await loop;
    shellApp.allowQuit = true;
    app.exit(0);
    return;
  }

  await scene('one minute left, said out loud', 3400, async () => {
    while (!playClock.isTimeUp() && (playClock.state().leftSeconds || 0) > 62) {
      await sleep(250);
    }
  });

  await scene('time is up, and nothing else opens', 3400, async () => {
    while (!playClock.isTimeUp()) await sleep(200);
    const seen = await js(`(() => {
      const el = document.getElementById('timeup');
      const r = el.getBoundingClientRect();
      return JSON.stringify({
        classes: document.getElementById('app').className,
        display: getComputedStyle(el).display,
        // Where it is, not just how big: laid out below the fold it was the
        // right size and never once on screen.
        box: Math.round(r.top) + ',' + Math.round(r.left) +
             ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
      });
    })()`);
    console.log(`[DEMO] stop screen: ${seen}`);
  });

  await scene('a grown-up holds the button', 1200, async () => {
    await js(`(() => { document.getElementById('timeup-gate').click(); return 1; })()`);
    await sleep(700);
  });
  // The hold itself is recorded, so the ring fills on camera.
  capturing = true;
  await js(`(() => {
    document.getElementById('hold-btn')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return 1;
  })()`);
  await sleep(3400);
  await js(`(() => {
    document.getElementById('hold-btn')
      .dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return 1;
  })()`);
  await sleep(1600);
  capturing = false;

  await scene('play time is the first thing a grown-up sees', 3400, async () => {
    await js(`(() => {
      if (window.__showPortalTab) window.__showPortalTab('time');
      const body = document.querySelector('#gate-step-library .portal-body');
      if (body) body.scrollTop = 0;
      return 1;
    })()`);
  });

  await scene('more time, and back to playing', 3000, async () => {
    await js(`(() => { document.getElementById('time-more').click(); return 1; })()`);
    await sleep(900);
    await js(`(() => { document.getElementById('lib-done').click(); return 1; })()`);
  });

  stopped = true;
  await loop;
  console.log(`[DEMO] wrote ${frame} frames to ${DEMO_DIR}`);

  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  shellApp.allowQuit = true;
  app.exit(0);
}

async function runStartProbe () {
  const win = shellApp.win;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  const say = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v}`);

  console.log('\n  ===== does the Start menu get closed? =====\n');
  say('platform', `${process.platform} ${process.arch}`);
  if (process.platform !== 'win32') {
    say('result', 'nothing to test: this only applies to Windows');
  } else {
    // Wait for PowerShell to compile the helper.
    for (let i = 0; i < 60 && !startMenu.isReady(); i += 1) await wait(250);
    say('helper', startMenu.isReady() ? 'ready' : 'DID NOT START');

    win.show();
    win.focus();
    await wait(600);
    say('in front before the key', await startMenu.foreground(win));

    for (let round = 1; round <= 3; round += 1) {
      await startMenu.tapWindowsKey(win);
      await wait(250);
      const opened = await startMenu.foreground(win);
      await wait(1200);
      const after = await startMenu.foreground(win);
      say(`round ${round}: 250ms after the key`, opened);
      say(`round ${round}: 1.5s after the key`, after);
      results.push(after === 'self');
      await wait(500);
    }
    say('result', results.every(Boolean)
      ? 'PASS: the kiosk was back in front every time'
      : 'FAIL: something else kept the foreground');
  }
  console.log('');

  startMenu.stop();
  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

async function runCoverProbe () {
  const { screen } = require('electron');
  const win = shellApp.win;
  const display = screen.getPrimaryDisplay();
  const settle = () => new Promise((r) => setTimeout(r, 1200));

  const reset = async () => {
    try { win.setKiosk(false); } catch { /* not supported */ }
    try { win.setFullScreen(false); } catch { /* not supported */ }
    await settle();
  };

  const snapshot = (label) => {
    const b = win.getBounds();
    const c = win.getContentBounds();
    const s = display.bounds;
    const covers = b.x <= s.x && b.y <= s.y &&
                   b.width >= s.width && b.height >= s.height;
    return {
      strategy: label,
      bounds: `${b.x},${b.y} ${b.width}x${b.height}`,
      content: `${c.x},${c.y} ${c.width}x${c.height}`,
      fullScreen: (() => { try { return win.isFullScreen(); } catch { return '?'; } })(),
      kiosk: (() => { try { return win.isKiosk(); } catch { return '?'; } })(),
      // The gap the taskbar would sit in, if the window is merely work-area
      // sized rather than screen sized.
      shortBy: `${s.width - b.width}x${s.height - b.height}`,
      coversScreen: covers
    };
  };

  const rows = [];
  for (const [label, apply] of [
    ['setFullScreen(true)', () => win.setFullScreen(true)],
    ['setKiosk(true)', () => win.setKiosk(true)],
    ['setBounds(display.bounds)', () => win.setBounds(display.bounds)],
    ['kiosk + alwaysOnTop', () => {
      win.setKiosk(true);
      win.setAlwaysOnTop(true, 'screen-saver');
    }],
    ['setFullScreen then setBounds', () => {
      win.setFullScreen(true);
      win.setBounds(display.bounds);
    }],
    ['setBounds then alwaysOnTop', () => {
      win.setBounds(display.bounds);
      win.setAlwaysOnTop(true, 'screen-saver');
    }]
  ]) {
    await reset();
    try { apply(); } catch (err) { rows.push({ strategy: label, bounds: 'threw: ' + err.message }); continue; }
    await settle();
    rows.push(snapshot(label));
  }

  console.log('\n  ===== how each strategy covers the screen =====\n');
  console.log(`  platform      ${process.platform}`);
  console.log(`  display       ${display.bounds.width}x${display.bounds.height} at ${display.bounds.x},${display.bounds.y}`);
  console.log(`  workArea      ${display.workArea.width}x${display.workArea.height} at ${display.workArea.x},${display.workArea.y}`);
  console.log(`  scaleFactor   ${display.scaleFactor}`);
  console.log('');
  for (const r of rows) {
    console.log(`  ${r.strategy}`);
    if (r.bounds && r.bounds.startsWith('threw')) { console.log(`      ${r.bounds}`); continue; }
    console.log(`      bounds ${r.bounds}   content ${r.content}`);
    console.log(`      isFullScreen=${r.fullScreen}  isKiosk=${r.kiosk}  short by ${r.shortBy}`);
    console.log(`      covers the whole display: ${r.coversScreen ? 'yes' : 'NO'}`);
  }
  console.log('');
  console.log('  A window the size of workArea rather than the display is being');
  console.log('  kept off the taskbar. One that matches the display but still');
  console.log('  shows the taskbar is a z-order problem, not a sizing one.\n');

  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  gnome.giveBack(paths.userData);
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

async function runDiagnose () {
  const { screen } = require('electron');
  const win = shellApp.win;
  const wc = shellApp.shellView.webContents;

  const display = screen.getPrimaryDisplay();
  const lines = [];
  const say = (k, v) => lines.push(`  ${String(k).padEnd(22)} ${v}`);

  say('app version', app.getVersion());
  say('platform', `${process.platform} ${process.arch}`);
  say('electron', process.versions.electron);
  say('desktop', process.env.XDG_CURRENT_DESKTOP || '(none)');
  say('session type', process.env.XDG_SESSION_TYPE || '(none)');
  say('wayland display', process.env.WAYLAND_DISPLAY || '(none)');
  say('shortcut capture', shortcuts.sessionCanHoldKeys().session +
      (shortcuts.sessionCanHoldKeys().ok ? ' (works)' : ' (CANNOT intercept)'));
  say('gnome borrowing', gnome.available() ? 'available' : 'not a gnome session');

  say('display bounds', JSON.stringify(display.bounds));
  say('display workArea', JSON.stringify(display.workArea));
  say('scaleFactor', display.scaleFactor);

  say('window bounds', JSON.stringify(win.getBounds()));
  say('window content', JSON.stringify(win.getContentBounds()));
  say('content size', JSON.stringify(win.getContentSize()));
  say('isFullScreen', win.isFullScreen());
  say('isVisible', win.isVisible());
  say('kiosk setting', settings.kiosk);
  say('lockdown', shellApp.lockdownEnabled ? 'ON' : 'off (diagnostic run)');
  say('in-game bar', `${shellApp.barHeight}px from the ${shellApp.barSource}` +
      (shellApp.barSource === 'fallback'
        ? ` -- could not read --bar-h, using the ${BAR_HEIGHT_FALLBACK}px constant`
        : ''));
  say('alwaysOnTop', settings.alwaysOnTop);

  try {
    // The tiles float on a staggered delay, so measuring them mid-animation
    // reports a spread that is motion, not misalignment.
    const paused = await wc.executeJavaScript(FREEZE_MOTION);
    say('animations', `${paused} paused for measurement`);
    await new Promise((r) => setTimeout(r, 250));
    const dom = await wc.executeJavaScript(`(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 'missing';
        const r = el.getBoundingClientRect();
        return JSON.stringify({
          top: Math.round(r.top), left: Math.round(r.left),
          w: Math.round(r.width), h: Math.round(r.height)
        });
      };
      const bar = document.querySelector('.top');
      return JSON.stringify({
        mode: document.getElementById('app').dataset.mode,
        viewport: window.innerWidth + 'x' + window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        topBar: pick('.top'),
        topBarStyle: bar ? getComputedStyle(bar).minHeight + ' / ' + getComputedStyle(bar).paddingTop : 'n/a',
        firstButton: pick('.top-actions .top-btn'),
        brandMark: pick('.top-mark'),
        scrollTop: document.getElementById('launcher') ? document.getElementById('launcher').scrollTop : 'n/a',
        // Reported raw. A few pixels of variation within a row is expected:
        // each tile carries a small CSS rotation and a float animation on a
        // staggered delay, so labels genuinely sit at slightly different
        // heights. Only a large spread points at a layout problem.
        tileLabelTops: (function () {
          var tops = Array.prototype.map.call(
            document.querySelectorAll('#tiles .tile-name'),
            function (el) { return Math.round(el.getBoundingClientRect().top); }
          );
          return tops.length ? tops.join(', ') : 'no tiles';
        })()
      });
    })()`);
    const d = JSON.parse(dom);
    for (const [k, v] of Object.entries(d)) say(k, v);
  } catch (err) {
    say('renderer', 'could not be measured: ' + err.message);
  }

  console.log('\n  ===== Sukhi Play diagnostics =====\n');
  console.log(lines.join('\n'));
  console.log('\n  A top bar that reads top:0 with a positive height is correctly placed.');
  console.log('  A negative top, or a window whose y is less than the display y,');
  console.log('  means the window manager and the app disagree about the geometry.\n');

  try { shortcuts.releaseAll(); } catch { /* nothing held */ }
  gnome.giveBack(paths.userData);
  shellApp.allowQuit = true;
  saveReport();
  app.exit(0);
}

async function runProbe () {
  console.log(`\n  Probing ${PROBE_URL}\n  This takes about ${probe.PROBE_SECONDS} seconds...\n`);

  const result = await probe.probeSite({
    win: shellApp.win,
    shellView: shellApp.shellView,
    session: session.fromPartition(SESSION_PARTITION),
    policy,
    url: PROBE_URL,
    onProgress: (stage) => console.log(`  [${stage}]`)
  });

  if (!result.ok) {
    console.error(`\n  ${result.message}\n`);
    shellApp.allowQuit = true;
    return app.exit(1);
  }

  console.log(`\n  == ${result.url} ==`);
  console.log(`  title: ${result.title}`);
  console.log(`  suggested tile name: ${result.suggestedTitle}\n`);
  console.log(`  allowHosts (${result.allowHosts.length}) -- paste into catalog.json:`);
  console.log('    ' + JSON.stringify(result.allowHosts));
  console.log(`\n  blocked as ads/trackers (${result.blockedHosts.length}):`);
  console.log('    ' + (result.blockedHosts.length ? JSON.stringify(result.blockedHosts) : '(none)'));
  if (result.warning) console.log(`\n  WARNING: ${result.warning}`);
  console.log('');

  shortcuts.releaseAll();
  shellApp.allowQuit = true;
  app.exit(0);
}

// --- boot -------------------------------------------------------------------

/**
 * Shows the real app icon while running from source.
 *
 * A packaged build gets its icon from the bundle, but `npm start` runs the
 * Electron binary directly and inherits Electron's own icon. Setting the Dock
 * image fixes that for development; it is a no-op everywhere else.
 */
function applyDevIcon () {
  if (process.platform !== 'darwin' || !app.dock) return;
  try {
    const icon = nativeImage.createFromPath(
      path.join(__dirname, '..', '..', 'build', 'icon.png'));
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  } catch (err) {
    console.warn('[boot] could not set the dock icon:', err.message);
  }
}

// Declared before the app is ready, which is the only time Electron accepts it.
// Without `standard` the bundled apps get an opaque origin and localStorage
// throws; without `secure` they count as insecure and lose the same APIs a
// page served over http would.
protocol.registerSchemesAsPrivileged([{
  scheme: bundled.SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

/**
 * The bundled apps, shaped like catalogue suggestions.
 *
 * They are not in suggestions.json because that file is about sites: hosts,
 * advertising, somebody's terms. None of that applies to files on this disk,
 * and pretending otherwise would put a "no adverts" badge on something that
 * has nowhere to serve one from.
 */
function bundledSuggestions () {
  return bundledApps.map((b) => ({
    id: b.id,
    title: b.title,
    siteName: b.siteName,
    blurb: b.blurb,
    url: b.url,
    shape: b.shape,
    color: b.color,
    category: b.category,
    adSupported: false,
    blockAds: true,
    bundled: true,
    credit: b.credit,
    notes: b.credit ? `${b.credit} (${b.licence}). Included in Sukhi Play.` : '',
    allowHosts: [b.id],
    denyHosts: []
  }));
}

app.whenReady().then(() => {
  applyDevIcon();
  paths = {
    userData: app.getPath('userData'),
    catalog: null,
    settings: null
  };

  const loadedSettings = settingsStore.load(paths.userData);
  settings = loadedSettings.settings;
  paths.settings = loadedSettings.file;

  catalog = catalogStore.load({
    userDataDir: paths.userData,
    bundledPath: path.join(__dirname, '..', '..', 'config', 'catalog.json')
  });
  paths.catalog = catalog.file;

  suggestions = library.loadSuggestions(
    path.join(__dirname, '..', '..', 'config', 'suggestions.json'));

  // Apps that live inside the download. No network, nothing to filter.
  bundledApps = bundled.load(
    path.join(__dirname, '..', '..', 'config', 'bundled.json'),
    path.join(__dirname, '..', '..', 'vendor'));

  console.log(`[boot] ${catalog.apps.length} apps from ${catalog.source} catalog, ` +
              `${suggestions.length} suggestions available`);
  console.log(`[boot] config folder: ${paths.userData}`);

  policy = security.createPolicy();
  security.installGlobalHardening(app, () => policy);

  const kidSession = session.fromPartition(SESSION_PARTITION);
  bundled.serve(kidSession.protocol, bundledApps);
  security.configureSession(kidSession, policy, {
    onBlocked: () => {
      if (shellApp) shellApp.pushState();
    }
  });

  // Ends the session after settings.sessionMinutes of play. Counted in the
  // main process: a site the child is on shares the page's process, and a
  // clock a game could stop is not a clock.
  playClock = createClock({
    limitMinutes: settings.sessionMinutes,
    onWarn: (left) => {
      const mins = Math.round(left / 60);
      shellApp.toast(mins <= 1 ? 'One minute left' : `${mins} minutes left`);
      shellApp.pushState();
    },
    onTimeUp: () => {
      console.log('[clock] session time is up');
      shellApp.goHome();
      shellApp.pushState();
    }
  });

  shellApp = new Shell({
    policy,
    settings,
    session: kidSession,
    isDev: IS_DEV,
    checkMode: CHECK_MODE || PROBE_MODE,
    // Diagnostics and screenshots must not take over the display: --diagnose
    // used to cover the screen, go always-on-top and borrow 25 GNOME shortcuts
    // including Alt+Tab and the Super key, which made the one tool you would
    // ask someone to run the most intimidating thing in the project.
    //
    // Deliberately not folded into checkMode. That flag means "the main
    // process drives the UI", which parks the renderer on the splash, and with
    // it set every measurement the diagnostic takes comes back zero.
    // COVER_PROBE deliberately absent: without the lockdown the window gets a
    // frame, and a framed window measures differently from the frameless one
    // the probe exists to measure.
    noLockdown: DIAGNOSE || KEY_PROBE || Boolean(SHOTS_DIR) || Boolean(DEMO_DIR),
    // The gate and the portal are the parent's time, not the child's.
    onModeChange: (mode) => {
      playClock.setActive(mode === 'launcher' || mode === 'playing');
    }
  });

  shellApp.clockState = () => playClock.state();

  // If the lockdown is abandoned, the desktop gets its shortcuts back too.
  shellApp.onReleaseLockdown = () => {
    startMenu.stop();
    gnome.giveBack(paths.userData);
  };

  const win = shellApp.create();

  // A test run must never be able to take over the machine. SUKHI_EXIT_AFTER
  // gives any run a hard deadline.
  const exitAfter = Number(process.env.SUKHI_EXIT_AFTER || 0);
  if (exitAfter > 0) {
    setTimeout(() => {
      console.log(`[boot] SUKHI_EXIT_AFTER=${exitAfter}s reached, exiting`);
      try { shortcuts.releaseAll(); } catch { /* nothing held */ }
      if (shellApp) shellApp.allowQuit = true;
      app.exit(0);
    }, exitAfter * 1000);
  }

  // Screenshot tooling for the README. Kept because the images go stale every
  // time the interface changes, and a screenshot taken from the real app beats
  // one taken from a mock. See CONTRIBUTING.md.
  if (process.env.SUKHI_SHOT) {
    ipcMain.once('shell:renderer-ready', () => {
      setTimeout(async () => {
        try {
          if (process.env.SUKHI_SHOT_VIEW === 'portal') {
            gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
            shellApp.openGate('portal');
            await shellApp.shellView.webContents.executeJavaScript(`(async () => {
              document.getElementById('gate-step-hold').hidden = true;
              document.getElementById('gate-step-library').hidden = false;
              document.querySelector('.gate-card').classList.add('is-portal');
              const fn = window.__loadLibrary; if (fn) await fn();
              return 1;
            })()`);
            await new Promise((r) => setTimeout(r, 1200));
          }

          const w = Number(process.env.SUKHI_SHOT_W || 1280);
          const h = Number(process.env.SUKHI_SHOT_H || 820);
          shellApp.win.setBounds({ x: 40, y: 40, width: w, height: h });
          shellApp.layout();
          await new Promise((r) => setTimeout(r, 900));
          const view = shellApp.shellView;
          const image = await view.webContents.capturePage();
          require('node:fs').writeFileSync(process.env.SUKHI_SHOT, image.toPNG());
          console.log('[SHOT] wrote', process.env.SUKHI_SHOT, image.getSize());
        } catch (e) {
          console.log('[SHOT] failed:', e.message);
        }
        try { shortcuts.releaseAll(); } catch {}
        shellApp.allowQuit = true;
        app.exit(0);
      }, Number(process.env.SUKHI_SHOT_DELAY || 3500));
    });
  }

  // The launcher must prove it is on screen. If it does not, everything is
  // unlocked: a kiosk whose interface never appeared has no exit gate either,
  // and with Cmd+Q and Cmd+Tab held at the OS level the only way out would be a
  // force quit. Fail open, not locked.
  const READY_TIMEOUT_MS = 12_000;
  let rendererReady = false;

  const watchdog = setTimeout(() => {
    if (rendererReady) return;
    shortcuts.disable('the launcher did not appear');
    shellApp.releaseLockdown('the launcher did not appear within 12 seconds');
    shellApp.showFailure(
      'Sukhi Play could not start properly.',
      'Everything has been unlocked so you can close this window normally. ' +
      'Please report this at github.com/meSingh/sukhi-play/issues'
    );
  }, READY_TIMEOUT_MS);

  ipcMain.on('shell:renderer-ready', () => {
    if (rendererReady) return;
    rendererReady = true;
    clearTimeout(watchdog);
    console.log('[boot] launcher is on screen');
  });

  shellApp.shellView.webContents.on('render-process-gone', (_e, details) => {
    clearTimeout(watchdog);
    shortcuts.disable('the launcher crashed');
    shellApp.releaseLockdown(`the launcher crashed (${details.reason})`);
  });

  installFocusGuard(win);
  registerIpc();

  // One tick a second, and a fresh state to the renderer while the last five
  // minutes run down so the countdown in the bar stays honest.
  if (!CHECK_MODE && !PROBE_MODE) {
    // Four times a second rather than once: at one tick a second the stop
    // screen could arrive most of a second after the countdown showed 0:00,
    // which reads as the app being slow to keep its own promise.
    let ticks = 0;
    setInterval(() => {
      playClock.tick();
      const { limitSeconds, timeUp } = playClock.state();
      // The renderer counts the seconds down on its own; these messages are
      // what keeps its count honest. Rarely, and never after it has stopped.
      ticks += 1;
      const near = (playClock.state().leftSeconds || 0) <= 35;
      if (limitSeconds && !timeUp && ticks % (near ? 4 : 80) === 0) shellApp.pushState();
    }, 250).unref();
  }

  if (process.platform === 'win32' && !IS_DEV && !CHECK_MODE && !PROBE_MODE &&
      (shellApp.lockdownEnabled || START_PROBE)) {
    startMenu.start();
  }

  // Swallow F-keys, Mission Control, Cmd+Q/W/M and the rest at the OS level,
  // but only while this window is in front. Disabled in dev so the machine
  // stays usable while working on the app.
  shortcuts.install(win, {
    enabled: !IS_DEV && !CHECK_MODE && !PROBE_MODE,
    onParentEscape: () => shellApp.openGate('exit')
  });

  // On Linux the desktop owns Alt+Tab and the Super key, and on Wayland it owns
  // every shortcut. Borrowed for the session and given back on quit.
  if (!IS_DEV && !CHECK_MODE && !PROBE_MODE && !DIAGNOSE && !SHOTS_DIR &&
      settings.borrowDesktopShortcuts) {
    gnome.borrow(paths.userData);
  } else if (gnome.available()) {
    // A previous run may have died mid-session; never leave them borrowed.
    gnome.restoreFromDisk(paths.userData);
  }

  if (SHOTS_DIR) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runShots(); }, 2200));
    return;
  }

  if (KEY_PROBE) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runKeyProbe(); }, 1500));
    return;
  }

  if (PORTAL_SHOTS) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runPortalShots(); }, 1600));
    return;
  }

  if (GATE_CHECK) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runGateCheck(); }, 1500));
    return;
  }

  if (BUNDLED_CHECK) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runBundledCheck(); }, 1500));
    return;
  }

  if (DEMO_DIR) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runDemo(); }, 1600));
    return;
  }

  if (START_PROBE) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runStartProbe(); }, 2000));
    return;
  }

  if (COVER_PROBE) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runCoverProbe(); }, 2000));
    return;
  }

  if (DIAGNOSE) {
    ipcMain.once('shell:renderer-ready', () => setTimeout(() => { runDiagnose(); }, 1800));
    return;
  }

  if (PROBE_MODE) {
    ipcMain.once('shell:renderer-idle', () => setTimeout(() => { runProbe(); }, 200));
    return;
  }

  if (CHECK_MODE) {
    // Wait for the renderer to finish booting before launching anything:
    // otherwise its splash timer calls goHome() and tears down the very view
    // we are trying to measure.
      ipcMain.once('shell:renderer-idle', () => setTimeout(() => { runCheck(); }, 200));
    return;
  }

  // Closing the window is a quit request, and quit requests go to the gate.
  win.on('close', (event) => {
    if (shellApp.allowQuit) return;
    event.preventDefault();
    shellApp.openGate('quit');
  });

  shellApp.setMode('boot');
});

app.on('before-quit', (event) => {
  if (CHECK_MODE || PROBE_MODE || DIAGNOSE || COVER_PROBE || KEY_PROBE || START_PROBE ||
      SHOTS_DIR || DEMO_DIR || GATE_CHECK || PORTAL_SHOTS || BUNDLED_CHECK) return;
  if (shellApp && !shellApp.allowQuit) {
    event.preventDefault();
    shellApp.openGate('quit');
  }
});

app.on('second-instance', () => {
  if (shellApp && shellApp.win && !shellApp.win.isDestroyed()) {
    shellApp.win.show();
    shellApp.win.focus();
  }
});

app.on('will-quit', () => {
  // Never leave the machine with keys held hostage after we exit.
  shortcuts.releaseAll();
  startMenu.stop();
  if (paths.userData) gnome.giveBack(paths.userData);
});

app.on('window-all-closed', () => {
  app.quit();
});

// Never let a page talk the app into opening something in the real browser.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://') || url.startsWith('http')) return;
    event.preventDefault();
  });
});
