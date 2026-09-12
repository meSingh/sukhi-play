'use strict';

const path = require('node:path');
const { BaseWindow, WebContentsView, screen } = require('electron');
const security = require('./security');

const BAR_HEIGHT = 72;

function escapeHtml (text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const PRELOAD_DIR = path.join(__dirname, '..', 'preload');

/**
 * Owns the window and the two views inside it.
 *
 *   shellView  our own local UI  -- splash, tile picker, top bar, exit gate
 *   gameView   the remote site   -- created on launch, destroyed on going home
 *
 * Only the bounds change between modes. The shell is always the topmost view,
 * so growing it to fill the window is all it takes to put a modal in front of
 * the game, and the game cannot paint over it.
 */
class Shell {
  constructor ({ policy, settings, session, isDev, checkMode = false, onModeChange }) {
    this.policy = policy;
    this.settings = settings;
    this.session = session;
    this.isDev = isDev;
    this.checkMode = checkMode;
    this.onModeChange = onModeChange || (() => {});

    this.win = null;
    this.shellView = null;
    this.gameView = null;

    this.mode = 'boot';          // boot | launcher | playing | gate
    this.activeApp = null;
    this.htmlFullscreen = false;
    this.allowQuit = false;
  }

  /**
   * Screen-covering and always-on-top are off in dev and during --check, so
   * neither working on the app nor verifying a site takes over the display.
   */
  get lockdownEnabled () {
    return !this.isDev && !this.checkMode;
  }

  /** The rectangle we want to own: the whole primary display, menu bar included. */
  screenBounds () {
    const display = screen.getPrimaryDisplay();
    return display.bounds;
  }

  create () {
    const { settings } = this;
    const cover = this.lockdownEnabled && settings.kiosk;
    const bounds = this.screenBounds();

    // Deliberately NOT native fullscreen / kiosk on macOS.
    //
    // Native fullscreen puts the app in its own Space, and a three-finger swipe
    // then slides straight past it to the desktop. A plain window that covers
    // the whole display, sits at screen-saver level and is set to join every
    // Space cannot be swiped away from -- it travels to whichever Space you
    // land on. It also has no green button and no title bar, so there is
    // nothing to click that would shrink it back to a normal window.
    this.win = new BaseWindow({
      ...(cover ? bounds : { width: 1280, height: 820 }),
      show: false,
      backgroundColor: '#0f172a',
      title: 'Sukhi Play',
      frame: !cover,
      movable: !cover,
      resizable: !cover,
      minimizable: !cover,
      maximizable: !cover,
      closable: true,
      autoHideMenuBar: true,
      fullscreenable: false,
      minWidth: 640,
      minHeight: 480,
      alwaysOnTop: this.lockdownEnabled && settings.alwaysOnTop
    });

    if (cover) {
      this.applyCover();
      // A resolution or display change must not leave a gap around the edges.
      screen.on('display-metrics-changed', () => this.refitToScreen());
      screen.on('display-added', () => this.refitToScreen());
      screen.on('display-removed', () => this.refitToScreen());
    }

    this.shellView = new WebContentsView({
      webPreferences: {
        preload: path.join(PRELOAD_DIR, 'shell.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        devTools: this.isDev,
        spellcheck: false,
        navigateOnDragDrop: false
      }
    });

    security.hardenWebContents(this.shellView.webContents, {
      policy: this.policy,
      trusted: true,
      label: 'shell',
      onParentEscape: () => this.openGate('quit')
    });

    // Surface renderer errors in the terminal. Without this a script error in
    // the launcher shows up as a blank window and nothing else, which is
    // exactly as much help as it sounds.
    this.shellView.webContents.on('console-message', (event) => {
      const level = event.level || 'info';
      if (level === 'error' || level === 'warning') {
        console.error(`[renderer:${level}] ${event.message}  (${event.sourceId || '?'}:${event.lineNumber || 0})`);
      }
    });
    this.shellView.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[shell] failed to load: ${code} ${desc} ${url}`);
    });
    this.shellView.webContents.on('render-process-gone', (_e, d) => {
      console.error(`[shell] renderer gone: ${d.reason}`);
    });

    this.win.contentView.addChildView(this.shellView);
    this.shellView.webContents.loadFile(path.join(RENDERER_DIR, 'index.html'));

    this.win.on('resize', () => this.layout());

    this.setMode('boot');
    this.win.once('ready-to-show', () => this.win.show());
    this.shellView.webContents.once('did-finish-load', () => {
      if (!this.win.isVisible()) this.win.show();
      this.layout();
    });

    return this.win;
  }

  /**
   * Takes over the screen.
   *
   * On macOS this uses "simple" fullscreen -- the pre-Lion kind -- rather than
   * placing a window by hand at screen-saver level. Simple fullscreen genuinely
   * covers the menu bar and Dock and does NOT create its own Space, which is
   * the whole reason we avoid native fullscreen. Setting bounds by hand did not
   * work: macOS refuses to put an ordinary window under the menu bar, so the
   * window ended up offset down the screen and hanging off the bottom.
   *
   * `skipTransformProcessType` matters too. Without it, asking to be visible on
   * fullscreen Spaces makes Electron hide the Dock and switch the process type,
   * which is disruptive while the window is still being set up.
   */
  applyCover () {
    const win = this.win;
    if (!win || win.isDestroyed()) return;

    try {
      if (process.platform === 'darwin') {
        win.setSimpleFullScreen(true);
      } else {
        win.setBounds(this.screenBounds());
      }
    } catch (err) {
      console.warn('[window] could not cover the screen:', err.message);
      try { win.setBounds(this.screenBounds()); } catch { /* nothing more to try */ }
    }

    try {
      win.setAlwaysOnTop(true, 'screen-saver');
    } catch { /* not supported on Wayland */ }

    if (process.platform !== 'win32') {
      try {
        // Follow the child onto whatever Space they swipe to.
        win.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true });
      } catch { /* unsupported on some Linux window managers */ }
    }

    // Worth logging: a window that is not where it should be is the difference
    // between covering the screen and leaving a strip of desktop showing.
    try {
      const b = win.getBounds();
      const s = this.screenBounds();
      const covered = b.x <= s.x && b.y <= s.y &&
                      b.width >= s.width && b.height >= s.height;
      // Only worth saying once, or whenever it goes wrong.
      if (!covered || !this._loggedCover) {
        this._loggedCover = true;
        console.log(`[window] covering screen: ${covered ? 'yes' : 'NO'} ` +
                    `window=${b.x},${b.y} ${b.width}x${b.height} ` +
                    `screen=${s.x},${s.y} ${s.width}x${s.height}`);
      }
    } catch { /* window going away */ }
  }

  /**
   * Drops every lock: shortcuts, always-on-top, screen covering, and the quit
   * guard. Called when the interface fails to appear.
   *
   * A kiosk that breaks must break OPEN. If the launcher does not render, the
   * grown-up gate is not on screen either -- and with Cmd+Q and Cmd+Tab held at
   * the OS level, there would be nothing left but a force quit. That happened,
   * and this is the fix for it.
   */
  releaseLockdown (reason) {
    console.error(`[window] RELEASING LOCKDOWN: ${reason}`);
    this.lockdownReleased = true;
    this.allowQuit = true;

    const win = this.win;
    if (!win || win.isDestroyed()) return;
    try { if (process.platform === 'darwin') win.setSimpleFullScreen(false); } catch {}
    try { win.setAlwaysOnTop(false); } catch {}
    try { win.setVisibleOnAllWorkspaces(false); } catch {}
    try { win.setBounds({ x: 80, y: 80, width: 900, height: 620 }); } catch {}
    try { win.setClosable(true); } catch {}
    try { win.show(); win.focus(); } catch {}
  }

  /**
   * Replaces the launcher with a plain message the parent can read and act on.
   * Used only after lockdown has been released.
   */
  showFailure (title, detail) {
    if (!this.shellView || this.shellView.webContents.isDestroyed()) return;
    const page = 'data:text/html;charset=utf-8,' + encodeURIComponent(`
      <style>
        body { margin:0; height:100vh; display:flex; flex-direction:column;
               align-items:center; justify-content:center; gap:16px;
               background:#0f172a; color:#f8fafc; text-align:center; padding:40px;
               font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }
        h1 { margin:0; font-size:26px; }
        p  { margin:0; max-width:46ch; line-height:1.6; color:#94a3b8; font-size:16px; }
      </style>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(detail)}</p>
    `);
    this.shellView.webContents.loadURL(page).catch(() => {});
  }

  /** Re-claim the full display after a resolution or monitor change. */
  refitToScreen () {
    if (!this.win || this.win.isDestroyed()) return;
    if (this.lockdownReleased) return;
    if (!(this.lockdownEnabled && this.settings.kiosk)) return;
    this.applyCover();
    this.layout();
  }

  get gameContents () {
    if (!this.gameView) return null;
    return this.gameView.webContents.isDestroyed() ? null : this.gameView.webContents;
  }

  get activeAppId () {
    return this.activeApp ? this.activeApp.id : null;
  }

  contentSize () {
    const [width, height] = this.win.getContentSize();
    return { width, height };
  }

  layout () {
    if (!this.win || this.win.isDestroyed() || !this.shellView) return;
    const { width, height } = this.contentSize();

    if (this.mode === 'playing' && this.gameView) {
      const bar = this.htmlFullscreen ? 0 : BAR_HEIGHT;
      this.shellView.setBounds({ x: 0, y: 0, width, height: bar });
      this.gameView.setBounds({ x: 0, y: bar, width, height: Math.max(0, height - bar) });
      return;
    }

    // boot, launcher and gate all want the shell filling the window.
    this.shellView.setBounds({ x: 0, y: 0, width, height });
    if (this.gameView) {
      // Keep it laid out underneath so returning from the gate is instant.
      this.gameView.setBounds({ x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) });
    }
  }

  setMode (mode) {
    this.mode = mode;
    this.layout();
    this.pushState();
    this.onModeChange(mode);
  }

  pushState () {
    if (!this.shellView || this.shellView.webContents.isDestroyed()) return;
    this.shellView.webContents.send('shell:state', this.state());
  }

  state () {
    return {
      mode: this.mode,
      activeAppId: this.activeApp ? this.activeApp.id : null,
      activeAppTitle: this.activeApp ? this.activeApp.title : null,
      htmlFullscreen: this.htmlFullscreen,
      blocked: this.policy.totalBlocked,
      counts: this.policy.counts
    };
  }

  // --- launching -----------------------------------------------------------

  launch (appEntry) {
    if (!appEntry) return { ok: false, message: 'unknown app' };
    this.destroyGameView();

    this.activeApp = appEntry;
    this.gameStarted = false;
    this.policy.setApp(appEntry);

    this.gameView = new WebContentsView({
      webPreferences: {
        session: this.session,
        preload: path.join(PRELOAD_DIR, 'guest.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        webviewTag: false,
        devTools: false,
        spellcheck: false,
        // A page cannot trap the kid in an alert() it cannot dismiss.
        disableDialogs: true,
        safeDialogs: true,
        // Dropping a file onto the window must not navigate to it.
        navigateOnDragDrop: false,
        enableWebSQL: false,
        backgroundThrottling: false
      }
    });

    const view = this.gameView;
    const contents = view.webContents;

    // Every handler below belongs to THIS view. When a new game is launched the
    // old view is closed, and its teardown events (render-process-gone with
    // reason "clean-exit", aborted loads) arrive a moment later -- by which time
    // this.gameView already points at the NEW game. Acting on those stale events
    // was tearing down the game that had just started. This guard is what stops
    // switching games from throwing the child back to the tile screen.
    const isCurrent = () => this.gameView === view && !contents.isDestroyed();

    security.hardenWebContents(contents, {
      policy: this.policy,
      trusted: false,
      isTopGame: true,
      label: 'game',
      onParentEscape: () => this.openGate('exit'),
      onBlockedNavigation: () => { if (isCurrent()) this.pushState(); }
    });

    // Games are driven by the keyboard, so the game view -- not our bar -- has to
    // hold focus, or arrow keys and WASD go nowhere and the game looks broken.
    const focusGame = () => {
      if (!isCurrent()) return;
      if (this.mode !== 'playing') return;
      try { contents.focus(); } catch { /* view went away */ }
    };
    contents.on('dom-ready', focusGame);
    contents.on('did-finish-load', focusGame);
    contents.on('did-navigate', focusGame);
    contents.on('did-navigate-in-page', focusGame);
    this.focusGame = focusGame;

    // A game asking for real fullscreen gets it, and the bar gets out of the way.
    contents.on('enter-html-full-screen', () => {
      if (!isCurrent()) return;
      this.htmlFullscreen = true;
      this.layout();
      this.pushState();
      focusGame();
    });
    contents.on('leave-html-full-screen', () => {
      if (!isCurrent()) return;
      this.htmlFullscreen = false;
      this.layout();
      this.pushState();
      focusGame();
    });

    contents.on('render-process-gone', (_e, details) => {
      // "clean-exit" is what we get when WE close the view on purpose.
      if (details.reason === 'clean-exit' || details.reason === 'killed') return;
      if (!isCurrent()) return;
      console.warn('[game] render process gone:', details.reason);
      this.goHome();
      this.toast('That game stopped. Pick another one.');
    });

    contents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      // -3 aborted, -20 blocked by us. Neither means the game is broken, and a
      // blocked ad redirect in the main frame must not close the game.
      if (errorCode === -3 || errorCode === -20) return;
      if (!isCurrent()) return;
      // Once the page is up, a later failed navigation is the ad frame flailing,
      // not the game dying. Only a failure of the initial load is fatal.
      if (this.gameStarted) {
        console.warn(`[game] ignoring post-load failure ${errorCode}: ${validatedURL}`);
        return;
      }
      console.warn(`[game] load failed ${errorCode} ${errorDescription} ${validatedURL}`);
      this.goHome();
      this.toast('That did not open. Try again.');
    });

    contents.once('did-finish-load', () => { if (isCurrent()) this.gameStarted = true; });

    // Order matters: game first, shell re-added so it stays on top for the gate.
    this.win.contentView.addChildView(this.gameView);
    this.win.contentView.addChildView(this.shellView);

    contents.loadURL(appEntry.url).catch((err) => {
      console.warn('[game] loadURL rejected:', err.message);
    });

    this.setMode('playing');
    setTimeout(focusGame, 400);
    return { ok: true };
  }

  destroyGameView () {
    if (!this.gameView) return;
    const view = this.gameView;
    this.gameView = null;
    this.focusGame = null;
    this.gameStarted = false;
    try {
      this.win.contentView.removeChildView(view);
    } catch { /* already detached */ }
    try {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    } catch { /* already gone */ }
  }

  goHome () {
    this.destroyGameView();
    this.activeApp = null;
    this.policy.clear();
    this.htmlFullscreen = false;
    this.setMode('launcher');
    return { ok: true };
  }

  // --- gate ----------------------------------------------------------------

  openGate (intent) {
    if (this.mode === 'gate') return { ok: true };
    this.gateIntent = intent === 'quit' ? 'quit' : 'exit';
    this.previousMode = this.mode;
    if (this.gameView && !this.gameView.webContents.isDestroyed()) {
      this.gameView.webContents.setAudioMuted(true);
    }
    this.setMode('gate');
    return { ok: true, intent: this.gateIntent };
  }

  closeGate () {
    if (this.mode !== 'gate') return { ok: true };
    if (this.gameView && !this.gameView.webContents.isDestroyed()) {
      this.gameView.webContents.setAudioMuted(false);
    }
    this.setMode(this.previousMode === 'playing' && this.gameView ? 'playing' : 'launcher');
    if (this.mode === 'playing' && typeof this.focusGame === 'function') {
      setTimeout(() => this.focusGame(), 60);
    }
    return { ok: true };
  }

  /** Leave the gate and return to the tile screen, closing any open game. */
  closeGateAndGoHome () {
    if (this.gameView && !this.gameView.webContents.isDestroyed()) {
      this.gameView.webContents.setAudioMuted(false);
    }
    this.previousMode = 'launcher';
    this.goHome();
    return { ok: true };
  }

  toast (message) {
    if (!this.shellView || this.shellView.webContents.isDestroyed()) return;
    this.shellView.webContents.send('shell:toast', { message });
  }
}

module.exports = { Shell, BAR_HEIGHT };
