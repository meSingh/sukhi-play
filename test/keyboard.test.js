'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decide } = require('../src/main/keyboard');

const key = (k, mods = {}) => ({
  key: k,
  control: !!mods.ctrl, meta: !!mods.meta, alt: !!mods.alt, shift: !!mods.shift
});

test('keys that games need are never swallowed', () => {
  // A game that cannot read WASD or the arrows is a broken game.
  for (const k of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                   ' ', 'Enter', 'Escape', '1', 'z', 'x']) {
    assert.equal(decide(key(k)).action, 'allow', `${k} should reach the game`);
  }
});

test('a modifier held on its own is a game action, not a shortcut', () => {
  // Plenty of games use Ctrl or Shift as "shoot" / "run".
  assert.equal(decide(key('Control', { ctrl: true })).action, 'allow');
  assert.equal(decide(key('Shift', { shift: true })).action, 'allow');
  assert.equal(decide(key('a', { shift: true })).action, 'allow');
});

test('modifier combinations are blocked', () => {
  for (const [k, mods] of [
    ['w', { ctrl: true }], ['t', { ctrl: true }], ['n', { ctrl: true }],
    ['r', { ctrl: true }], ['p', { ctrl: true }], ['q', { meta: true }],
    ['w', { meta: true }], ['i', { ctrl: true, shift: true }],
    ['ArrowLeft', { alt: true }]
  ]) {
    assert.equal(decide(key(k, mods)).action, 'block', `${k} with modifiers should be blocked`);
  }
});

test('function keys and browser keys are blocked', () => {
  for (const k of ['F1', 'F5', 'F11', 'F12', 'ContextMenu', 'BrowserBack', 'BrowserRefresh']) {
    assert.equal(decide(key(k)).action, 'block', `${k} should be blocked`);
  }
});

test('the grown-up chord is recognised on both platforms', () => {
  assert.equal(decide(key('x', { ctrl: true, shift: true })).action, 'parent-escape');
  assert.equal(decide(key('x', { meta: true, shift: true })).action, 'parent-escape');
});
