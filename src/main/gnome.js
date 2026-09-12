'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Borrows the GNOME shortcuts this app cannot take any other way, and gives
 * them back.
 *
 * Electron's globalShortcut only works on X11, and even there the Super key and
 * Alt+Tab belong to the window manager rather than to any application. Under
 * Wayland, which current Ubuntu defaults to, it intercepts nothing at all. So
 * the keys are switched off in GNOME's own settings for as long as the app is
 * running, and put back exactly as they were when it quits.
 *
 * Every original value is written to disk before anything changes, so a crash
 * or a kill does not leave a desktop with no Alt+Tab: the next start finds the
 * file and restores from it. Nothing here is permanent.
 */

// The Super key itself. A string, not a list, and the one that opens Activities.
const OVERLAY = { schema: 'org.gnome.mutter', key: 'overlay-key', blank: "''" };

const BINDINGS = [
  ['org.gnome.desktop.wm.keybindings', 'switch-applications'],
  ['org.gnome.desktop.wm.keybindings', 'switch-applications-backward'],
  ['org.gnome.desktop.wm.keybindings', 'switch-windows'],
  ['org.gnome.desktop.wm.keybindings', 'switch-windows-backward'],
  ['org.gnome.desktop.wm.keybindings', 'switch-group'],
  ['org.gnome.desktop.wm.keybindings', 'switch-group-backward'],
  ['org.gnome.desktop.wm.keybindings', 'switch-panels'],
  ['org.gnome.desktop.wm.keybindings', 'switch-panels-backward'],
  ['org.gnome.desktop.wm.keybindings', 'panel-main-menu'],
  ['org.gnome.desktop.wm.keybindings', 'panel-run-dialog'],
  ['org.gnome.desktop.wm.keybindings', 'switch-to-workspace-left'],
  ['org.gnome.desktop.wm.keybindings', 'switch-to-workspace-right'],
  ['org.gnome.desktop.wm.keybindings', 'switch-to-workspace-up'],
  ['org.gnome.desktop.wm.keybindings', 'switch-to-workspace-down'],
  ['org.gnome.desktop.wm.keybindings', 'show-desktop'],
  ['org.gnome.desktop.wm.keybindings', 'close'],
  ['org.gnome.desktop.wm.keybindings', 'minimize'],
  ['org.gnome.shell.keybindings', 'toggle-overview'],
  ['org.gnome.shell.keybindings', 'toggle-application-view'],
  ['org.gnome.shell.keybindings', 'toggle-quick-settings'],
  ['org.gnome.shell.keybindings', 'toggle-message-tray'],
  ['org.gnome.shell.keybindings', 'focus-active-notification'],
  ['org.gnome.shell.keybindings', 'open-application-menu'],
  ['org.gnome.shell.keybindings', 'screenshot'],
  ['org.gnome.shell.keybindings', 'show-screenshot-ui']
];

const STATE_FILE = 'gnome-shortcuts-backup.json';

let active = false;
let stateFile = null;

function gsettings (args) {
  // stderr is piped rather than inherited. Probing for a binding this GNOME
  // version does not have is expected and handled, but with inherited stderr
  // gsettings prints `No such key "open-application-menu"` straight to the
  // user's terminal, which reads like a failure.
  return execFileSync('gsettings', args, {
    encoding: 'utf8',
    timeout: 4000,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

/** Is this a GNOME session with gsettings available? */
function available () {
  if (process.platform !== 'linux') return false;
  const desktop = (process.env.XDG_CURRENT_DESKTOP || '').toLowerCase();
  if (!desktop.includes('gnome') && !desktop.includes('ubuntu')) return false;
  try {
    gsettings(['--version']);
    return true;
  } catch {
    return false;
  }
}

function readAll () {
  const saved = { bindings: [], overlay: null };

  for (const [schema, key] of BINDINGS) {
    try {
      saved.bindings.push({ schema, key, value: gsettings(['get', schema, key]) });
    } catch {
      // The key does not exist on this GNOME version. Skip it rather than
      // guessing; restoring something we never read would be worse.
    }
  }

  try {
    saved.overlay = gsettings(['get', OVERLAY.schema, OVERLAY.key]);
  } catch { /* older GNOME without mutter overlay-key */ }

  return saved;
}

/**
 * Switches the shortcuts off. Returns how many were taken.
 * @param {string} userDataDir where to keep the backup
 */
function borrow (userDataDir) {
  if (active || !available()) return 0;

  stateFile = path.join(userDataDir, STATE_FILE);

  // If a backup is already sitting there, a previous run died without putting
  // things back. Restore that first so we never save the blanked values as if
  // they were the originals.
  restoreFromDisk(userDataDir);

  const saved = readAll();
  if (!saved.bindings.length && saved.overlay === null) return 0;

  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(saved, null, 2), 'utf8');
  } catch (err) {
    // Without a backup on disk this is not safe to do at all.
    console.warn('[gnome] not touching shortcuts, could not save a backup:', err.message);
    return 0;
  }

  let taken = 0;
  for (const { schema, key } of saved.bindings) {
    try { gsettings(['set', schema, key, '[]']); taken += 1; } catch { /* ignore */ }
  }
  if (saved.overlay !== null) {
    try { gsettings(['set', OVERLAY.schema, OVERLAY.key, OVERLAY.blank]); taken += 1; } catch { /* ignore */ }
  }

  active = true;
  console.log(`[gnome] borrowed ${taken} desktop shortcuts, including Alt+Tab and the Super key`);
  console.log(`[gnome] originals saved to ${stateFile}, restored when this app quits`);
  return taken;
}

/** Puts everything back and removes the backup. */
function giveBack (userDataDir) {
  const restored = restoreFromDisk(userDataDir);
  active = false;
  if (restored) console.log(`[gnome] gave back ${restored} desktop shortcuts`);
  return restored;
}

function restoreFromDisk (userDataDir) {
  const file = path.join(userDataDir, STATE_FILE);
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return 0;   // nothing to restore
  }

  let count = 0;
  for (const entry of saved.bindings || []) {
    try { gsettings(['set', entry.schema, entry.key, entry.value]); count += 1; } catch { /* ignore */ }
  }
  if (saved.overlay) {
    try { gsettings(['set', OVERLAY.schema, OVERLAY.key, saved.overlay]); count += 1; } catch { /* ignore */ }
  }

  try { fs.unlinkSync(file); } catch { /* already gone */ }
  return count;
}

module.exports = { available, borrow, giveBack, restoreFromDisk, BINDINGS, STATE_FILE };
