'use strict';

/**
 * Keyboard policy for the game view.
 *
 * The tension here: we have to kill every browser/OS shortcut a toddler could
 * stumble onto, while leaving the keys games actually need. Plenty of games use
 * Ctrl or Shift as "shoot" or "run", so a blanket "block anything with Ctrl held"
 * would break them. The rule is therefore:
 *
 *   - a modifier pressed ON ITS OWN is fine (that is a game action)
 *   - a modifier COMBINED with a letter/digit/arrow is a shortcut -> blocked
 *   - function keys are always blocked (devtools, fullscreen, refresh)
 *   - one secret chord is reserved for the grown-up
 *
 * What this cannot do: Cmd+Tab, Alt+Tab, the Windows key, Ctrl+Alt+Del and
 * macOS Mission Control are handled by the OS before the app ever sees them.
 * See the "Hardening the machine itself" section of the README.
 */

const BARE_MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

// Keys that are a shortcut all by themselves, with no modifier needed.
const ALWAYS_BLOCKED = new Set([
  'ContextMenu',           // opens the right-click menu
  'BrowserBack', 'BrowserForward', 'BrowserRefresh', 'BrowserHome',
  'BrowserSearch', 'BrowserFavorites', 'BrowserStop',
  'LaunchApplication1', 'LaunchApplication2', 'LaunchMail',
  'Open', 'Find', 'Help', 'Print', 'Power', 'Sleep', 'WakeUp',
  'PrintScreen', 'Insert'
]);

// Keys a game legitimately needs, even though they are "special".
const GAME_SAFE = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ' ', 'Spacebar', 'Enter', 'Tab', 'Backspace', 'Delete',
  'Escape',                // a normal game key; nothing here uses it to escape
  'Home', 'End', 'PageUp', 'PageDown'
]);

/**
 * Pure decision function so the policy can be tested without an Electron window.
 * @param {{key:string, control:boolean, meta:boolean, alt:boolean, shift:boolean, type?:string}} input
 * @returns {{action:'allow'|'block'|'parent-escape', reason:string}}
 */
function decide (input) {
  const key = typeof input.key === 'string' ? input.key : '';
  const lower = key.toLowerCase();
  const { control = false, meta = false, alt = false, shift = false } = input;
  const anyModifier = control || meta || alt;

  // The grown-up's way out: Ctrl+Shift+X (Cmd+Shift+X on a Mac).
  // Three keys at once is not something a 3-year-old produces by mashing, and
  // it still only opens the exit gate -- it does not quit anything by itself.
  if ((control || meta) && shift && lower === 'x') {
    return { action: 'parent-escape', reason: 'parent chord' };
  }

  // A modifier held on its own is a game action (shoot / run), not a shortcut.
  if (BARE_MODIFIERS.has(key)) {
    return { action: 'allow', reason: 'bare modifier' };
  }

  if (FUNCTION_KEY.test(key)) {
    return { action: 'block', reason: 'function key' };
  }

  if (ALWAYS_BLOCKED.has(key)) {
    return { action: 'block', reason: 'browser/system key' };
  }

  // Any modifier + anything else is a shortcut. This is the rule that kills
  // Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+R, Ctrl+P, Ctrl+Shift+I, Cmd+Q, Alt+Left, etc.
  if (anyModifier) {
    return { action: 'block', reason: 'modifier shortcut' };
  }

  if (GAME_SAFE.has(key)) {
    return { action: 'allow', reason: 'game key' };
  }

  // Plain letters, digits and punctuation: let them through so games that ask
  // the player to type a name still work.
  return { action: 'allow', reason: 'plain key' };
}

/**
 * Attaches the policy to a webContents.
 * @param {Electron.WebContents} contents
 * @param {{onParentEscape?: Function, label?: string}} options
 */
function attach (contents, { onParentEscape, label = 'view' } = {}) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return;

    const verdict = decide(input);

    if (verdict.action === 'parent-escape') {
      event.preventDefault();
      if (input.type === 'keyDown' && typeof onParentEscape === 'function') {
        onParentEscape();
      }
      return;
    }

    if (verdict.action === 'block') {
      event.preventDefault();
      if (input.type === 'keyDown') {
        console.log(`[keys] blocked on ${label}: ${describe(input)} (${verdict.reason})`);
      }
    }
  });
}

function describe (input) {
  const parts = [];
  if (input.control) parts.push('Ctrl');
  if (input.meta) parts.push('Meta');
  if (input.alt) parts.push('Alt');
  if (input.shift) parts.push('Shift');
  parts.push(input.key);
  return parts.join('+');
}

module.exports = { decide, attach, describe };
