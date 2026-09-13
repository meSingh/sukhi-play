'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

/** Loads shortcuts.js with a fake globalShortcut so it can be driven in tests. */
function loadShortcuts () {
  const held = new Set();
  const fake = {
    register: (accel) => { held.add(accel); return true; },
    unregister: (accel) => { held.delete(accel); },
    unregisterAll: () => { held.clear(); }
  };
  const realLoad = Module._load;
  Module._load = (req, ...rest) =>
    req === 'electron' ? { globalShortcut: fake } : realLoad(req, ...rest);
  delete require.cache[require.resolve('../src/main/shortcuts')];
  const mod = require('../src/main/shortcuts');
  Module._load = realLoad;
  return { mod, held };
}

test('acquiring takes the switchers, the function keys and the quit shortcuts', () => {
  const { mod, held } = loadShortcuts();
  mod.acquire({});
  for (const key of ['F4', 'CommandOrControl+Tab', 'Alt+Tab', 'CommandOrControl+Q',
                     'CommandOrControl+W', 'CommandOrControl+Space']) {
    assert.ok(held.has(key), `${key} should be held`);
  }
  mod.releaseAll();
});

test('releasing hands every key back', () => {
  const { mod, held } = loadShortcuts();
  mod.acquire({});
  assert.ok(held.size > 40);
  mod.release();
  assert.equal(held.size, 0);
});

test('a disabled session never takes the keyboard again', () => {
  // The regression this guards: releasing the lockdown calls win.focus(), the
  // focus handler called acquire(), and all 64 shortcuts came straight back --
  // putting the parent back in the trap the release was meant to open.
  const { mod, held } = loadShortcuts();
  mod.acquire({});
  assert.ok(held.size > 40, 'should start out holding the keyboard');

  mod.disable('test');
  assert.equal(held.size, 0, 'disable must hand the keys back');
  assert.equal(mod.isDisabled(), true);

  mod.acquire({});   // exactly what a focus event would do
  assert.equal(held.size, 0, 'a focus event must not re-take the keyboard');

  mod.releaseAll();
});

test('install with enabled:false never takes the keyboard', () => {
  const { mod, held } = loadShortcuts();
  const win = { isFocused: () => true, on: () => {} };
  mod.install(win, { enabled: false });
  assert.equal(held.size, 0);
  assert.equal(mod.isDisabled(), true);
});

test('screen capture is held, because it covers the kiosk', () => {
  // Print Screen on Windows 11 opens the Snipping Tool overlay on top of
  // everything, which is the behaviour this whole module exists to stop. It
  // was never registered: no PrintScreen entry existed in any list.
  const { mod, held } = loadShortcuts();
  mod.acquire({});
  for (const accelerator of mod.SCREEN_CAPTURE) {
    assert.ok(held.has(accelerator), `${accelerator} was not registered`);
  }
  assert.ok(mod.SCREEN_CAPTURE.includes('PrintScreen'), 'PrintScreen must be in the list');
});

test('only the Windows-key combinations Windows actually hands over are claimed', () => {
  // Measured with `npm run key-probe` on a Windows session: Super+D, Super+E,
  // Super+R, Super+Tab, Super+Shift+S and the rest are all refused, and a bare
  // Super accelerator throws. Listing refused ones would be noise that reads
  // like protection the app does not have.
  const { mod } = loadShortcuts();
  const all = [...mod.FUNCTION_KEYS, ...mod.APP_SHORTCUTS, ...mod.SWITCHERS,
    ...mod.MISSION_CONTROL, ...mod.SCREEN_CAPTURE, ...mod.WINDOWS_KEYS];

  assert.ok(!all.includes('Super'), 'a bare Super accelerator throws, it cannot be registered');
  for (const refused of ['Super+D', 'Super+E', 'Super+R', 'Super+L', 'Super+Tab', 'Super+Shift+S']) {
    assert.ok(!all.includes(refused), `${refused} is refused by Windows; listing it is misleading`);
  }
});
