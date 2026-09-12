'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { app, session, ipcMain, Menu, nativeImage } = require('electron');

const settingsStore = require('./settings');
const catalogStore = require('./catalog');
const security = require('./security');
const shortcuts = require('./shortcuts');
const probe = require('./probe');
const library = require('./library');
const { Shell } = require('./windowing');

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
let policy = null;
let settings = null;
let catalog = null;
let paths = {};
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

    setTimeout(() => {
      if (!win.isDestroyed() && !win.isFocused()) {
        win.show();
        win.focus();
      }
    }, 120);
  });
}

// --- ipc --------------------------------------------------------------------

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
    needsOnboarding: !settings.onboarded
  }));

  ipcMain.handle('shell:launch', (_e, appId) => {
    const entry = findApp(appId);
    if (!entry) return { ok: false, message: 'That is not on the list.' };
    console.log(`[launch] ${entry.id} -> ${entry.url}`);
    return shellApp.launch(entry);
  });

  ipcMain.handle('shell:go-home', () => shellApp.goHome());

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

  ipcMain.handle('shell:complete-hold', () => {
    if (shellApp.mode !== 'gate') return { ok: false, message: 'not at the gate' };
    if (!holdSatisfied()) {
      return { ok: false, message: 'Hold the button a little longer.' };
    }
    if (settings.gateMode === 'pin') {
      return { ok: true, needsPin: true, prompt: 'Enter the parent PIN' };
    }
    // Holding is the whole check. Unlock, but decide nothing: the grown-up
    // picks "close" or "back to the games" next.
    gate.unlockedUntil = Date.now() + UNLOCK_WINDOW_MS;
    return { ok: true, unlocked: true };
  });

  ipcMain.handle('shell:answer-gate', (_e, answer) => {
    if (shellApp.mode !== 'gate') return { ok: false, message: 'not at the gate' };
    if (settings.gateMode !== 'pin') return { ok: false, message: 'no PIN required' };
    if (!holdSatisfied()) return { ok: false, message: 'Hold the button first.' };
    const result = checkPin(answer);
    if (result.ok) return { ok: true, action: 'unlocked' };
    return result;
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
        enabled: a.enabled, blockAds: a.blockAds, icon: a.icon,
        allowHosts: a.allowHosts, denyHosts: a.denyHosts, notes: a.notes
      })),
      // Ones already set up are dropped rather than greyed out -- a suggestion
      // you have taken is not a suggestion any more.
      suggestions: suggestions
        .filter((s) => !catalog.apps.some((a) => a.url === s.url))
        .map((s) => ({
          id: s.id, title: s.title, url: s.url, shape: s.shape, color: s.color,
          category: s.category, adSupported: s.adSupported, blockAds: s.blockAds,
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

    // Only when the parent actually chose the site's own icon over a shape.
    if (entry.useIcon && Array.isArray(entry.iconUrls) && entry.iconUrls.length) {
      const icon = await probe.downloadIcon({
        urls: entry.iconUrls, userDataDir: paths.userData, id: result.app.id
      });
      if (icon) library.updateSite(paths.catalog, result.app.id, { icon });
    }

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
  if (result.iconUrls.length) console.log(`\n  icon: ${result.iconUrls[0]}`);
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

  console.log(`[boot] ${catalog.apps.length} apps from ${catalog.source} catalog, ` +
              `${suggestions.length} suggestions available`);
  console.log(`[boot] config folder: ${paths.userData}`);

  policy = security.createPolicy();
  security.installGlobalHardening(app, () => policy);

  const kidSession = session.fromPartition(SESSION_PARTITION);
  security.configureSession(kidSession, policy, {
    onBlocked: () => {
      if (shellApp) shellApp.pushState();
    }
  });

  shellApp = new Shell({
    policy,
    settings,
    session: kidSession,
    isDev: IS_DEV,
    checkMode: CHECK_MODE || PROBE_MODE
  });

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
              document.querySelector('.gate-card').classList.add('is-wide');
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

  // Swallow F-keys, Mission Control, Cmd+Q/W/M and the rest at the OS level,
  // but only while this window is in front. Disabled in dev so the machine
  // stays usable while working on the app.
  shortcuts.install(win, {
    enabled: !IS_DEV && !CHECK_MODE && !PROBE_MODE,
    onParentEscape: () => shellApp.openGate('exit')
  });

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
  if (CHECK_MODE || PROBE_MODE) return;
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
