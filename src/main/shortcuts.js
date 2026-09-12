'use strict';

const { globalShortcut } = require('electron');

/**
 * Whether the OS will actually hand over keys.
 *
 * Electron's globalShortcut is an X11 facility. Under Wayland, which is the
 * default on current Ubuntu and Fedora, registration reports success and then
 * nothing is intercepted, which is worse than failing outright because the log
 * claims the keyboard is held when it is not. Said plainly here instead.
 */
function sessionCanHoldKeys () {
  if (process.platform !== 'linux') return { ok: true, session: process.platform };
  const type = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
  const wayland = type === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY);
  return { ok: !wayland, session: wayland ? 'wayland' : (type || 'x11') };
}

/**
 * OS-level shortcut blocking.
 *
 * `before-input-event` only sees keys that actually reach the web page. On macOS
 * (and to a lesser extent Windows) the window manager eats F-keys, Mission
 * Control, minimise and quit BEFORE any application is consulted, which is why
 * those kept working no matter what the in-page policy said.
 *
 * globalShortcut registers at the OS level, so the key is swallowed before the
 * window manager acts on it. These are registered ONLY while our window holds
 * focus and released the moment it does not, so the rest of the machine behaves
 * normally when the app is not in front.
 */

const FUNCTION_KEYS = Array.from({ length: 20 }, (_, i) => `F${i + 1}`);

const APP_SHORTCUTS = [
  // Close / quit / hide the window.
  'CommandOrControl+W', 'CommandOrControl+Q', 'CommandOrControl+M',
  'CommandOrControl+H', 'Alt+F4',
  // New windows and tabs.
  'CommandOrControl+N', 'CommandOrControl+T', 'CommandOrControl+Shift+N',
  'CommandOrControl+Shift+T', 'CommandOrControl+Shift+W',
  // Reload, print, save, open, find, downloads, history, location bar.
  'CommandOrControl+R', 'CommandOrControl+Shift+R', 'CommandOrControl+P',
  'CommandOrControl+S', 'CommandOrControl+O', 'CommandOrControl+F',
  'CommandOrControl+G', 'CommandOrControl+J', 'CommandOrControl+L',
  'CommandOrControl+D', 'CommandOrControl+U',
  // Developer tools.
  'CommandOrControl+Shift+I', 'CommandOrControl+Shift+J',
  'CommandOrControl+Shift+C', 'CommandOrControl+Alt+I', 'CommandOrControl+Alt+J',
  // Zoom, which a small person will otherwise discover instantly.
  'CommandOrControl+Plus', 'CommandOrControl+-', 'CommandOrControl+0'
];

// The application switchers. These turned out to be capturable on both macOS
// and Windows, which matters more than everything else here: they are the
// shortcuts a child actually lands on by accident, and the ones that would drop
// them into the parent's work.
//
// Deliberately NOT registered: Force Quit (Cmd+Alt+Esc on macOS) and
// Ctrl+Alt+Del on Windows. Those stay available on purpose, as the way out if
// this app ever stops responding while holding these keys.
const SWITCHERS = [
  'CommandOrControl+Tab', 'CommandOrControl+Shift+Tab',
  'Alt+Tab', 'Alt+Shift+Tab',
  'CommandOrControl+Space',            // Spotlight / search
  'CommandOrControl+Alt+Space',
  'Alt+Escape', 'CommandOrControl+Escape'
].concat(process.platform === 'darwin' ? ['Command+`', 'Command+Alt+D'] : []);

// macOS Mission Control / Spaces / App Exposé. These are the shortcuts that
// expose the rest of the desktop, so they matter more than the rest combined.
const MISSION_CONTROL = process.platform === 'darwin'
  ? ['Control+Up', 'Control+Down', 'Control+Left', 'Control+Right']
  : [];

let registered = [];
let active = false;
// Once this is set, nothing re-takes the keyboard for the rest of the session.
// It exists because releasing the lockdown calls win.focus(), which fires the
// focus handler, which cheerfully re-registered all 64 shortcuts and put the
// parent straight back in the trap the release was meant to open.
let disabled = false;

/**
 * @param {{onParentEscape: Function}} handlers
 */
function acquire ({ onParentEscape } = {}) {
  if (disabled || active) return;
  active = true;

  // The grown-up chord is registered too, so it works even when the OS would
  // otherwise have swallowed it.
  const escapeChord = 'CommandOrControl+Shift+X';
  try {
    if (globalShortcut.register(escapeChord, () => {
      if (typeof onParentEscape === 'function') onParentEscape();
    })) registered.push(escapeChord);
  } catch { /* accelerator unsupported on this platform */ }

  for (const accelerator of [...FUNCTION_KEYS, ...APP_SHORTCUTS, ...SWITCHERS, ...MISSION_CONTROL]) {
    try {
      // An empty handler means "consume this key and do nothing".
      if (globalShortcut.register(accelerator, () => {})) {
        registered.push(accelerator);
      }
    } catch {
      // Some accelerators are reserved by the OS and simply cannot be taken.
      // That is expected; see the README's "What this cannot do".
    }
  }

  const env = sessionCanHoldKeys();
  if (env.ok) {
    console.log(`[shortcuts] holding ${registered.length} OS shortcuts while focused`);
  } else {
    console.warn(
      `[shortcuts] registered ${registered.length} shortcuts, but this is a ` +
      `${env.session} session and they will NOT be intercepted. ` +
      'Electron can only take global shortcuts on X11. ' +
      'Log in to an Xorg session, or restrict the keys in the account settings. ' +
      'See "What this cannot do" in the README.');
  }
}

function release () {
  if (!active) return;
  active = false;
  for (const accelerator of registered) {
    try { globalShortcut.unregister(accelerator); } catch { /* already gone */ }
  }
  registered = [];
}

function releaseAll () {
  active = false;
  registered = [];
  try { globalShortcut.unregisterAll(); } catch { /* nothing held */ }
}

/**
 * Gives the keyboard back and refuses to take it again for the rest of the
 * session. Use when the lockdown is being abandoned, never for a normal blur.
 */
function disable (reason) {
  disabled = true;
  releaseAll();
  console.log(`[shortcuts] disabled for this session: ${reason}`);
}

function isDisabled () { return disabled; }

/**
 * Binds acquire/release to the window's focus so the machine only loses these
 * keys while the kiosk is actually in front.
 */
function install (win, { onParentEscape, enabled = true } = {}) {
  if (!enabled) { disabled = true; return; }

  if (win.isFocused()) acquire({ onParentEscape });
  win.on('focus', () => acquire({ onParentEscape }));
  win.on('blur', release);
  win.on('closed', releaseAll);
}

module.exports = {
  install, acquire, release, releaseAll, disable, isDisabled, sessionCanHoldKeys,
  FUNCTION_KEYS, APP_SHORTCUTS, SWITCHERS, MISSION_CONTROL
};
