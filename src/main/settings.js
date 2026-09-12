'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  // How the grown-up proves they are a grown-up before the app will quit.
  //   'hold' -> press and hold the button, nothing else (the default)
  //   'pin'  -> hold, then type the pin below
  gateMode: 'hold',
  pin: null,

  // Seconds the exit button must be held down. This is the whole check in
  // 'hold' mode, so it is enforced in the main process, not in the page.
  holdSeconds: 3,

  // Window behaviour. kiosk covers the taskbar/dock and removes window chrome.
  kiosk: true,
  alwaysOnTop: true,
  fullscreenOnLaunch: true,

  // If the kid manages to click away to another app, pull focus back.
  // Self-disables if it ever starts fighting another window (see index.js).
  refocusOnBlur: true,

  // Show the "blocked N things" counter in the top bar.
  showBlockCounter: true
};

function clampInt (value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function coerce (raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;

  out.gateMode = raw.gateMode === 'pin' ? 'pin' : 'hold';
  out.pin = typeof raw.pin === 'string' && /^\d{4,8}$/.test(raw.pin) ? raw.pin : null;
  // A pin mode with no valid pin would lock the parent out; fall back to hold.
  if (out.gateMode === 'pin' && !out.pin) out.gateMode = 'hold';

  // A hold of zero would make the gate no gate at all.
  out.holdSeconds = clampInt(raw.holdSeconds, 1, 15, DEFAULTS.holdSeconds);

  for (const key of ['kiosk', 'alwaysOnTop', 'fullscreenOnLaunch', 'refocusOnBlur', 'showBlockCounter']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  return out;
}

function load (userDataDir) {
  const file = path.join(userDataDir, 'settings.json');
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[settings] could not read settings.json, using defaults:', err.message);
    }
  }
  const settings = coerce(raw);

  // Write the file back so the parent has something to edit.
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.warn('[settings] could not write settings.json:', err.message);
  }

  return { settings, file };
}

module.exports = { DEFAULTS, coerce, load };
