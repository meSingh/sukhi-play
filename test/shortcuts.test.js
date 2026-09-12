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
