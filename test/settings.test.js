'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { coerce, DEFAULTS } = require('../src/main/settings');

test('the gate defaults to hold', () => {
  assert.equal(coerce({}).gateMode, 'hold');
  assert.equal(DEFAULTS.gateMode, 'hold');
});

test('pin mode without a usable pin falls back to hold rather than locking anyone out', () => {
  assert.equal(coerce({ gateMode: 'pin' }).gateMode, 'hold');
  assert.equal(coerce({ gateMode: 'pin', pin: '12ab' }).gateMode, 'hold');
  assert.equal(coerce({ gateMode: 'pin', pin: '4821' }).gateMode, 'pin');
});

test('a retired gate mode does not break an existing settings file', () => {
  assert.equal(coerce({ gateMode: 'math' }).gateMode, 'hold');
});

test('hold time is clamped so the gate always exists', () => {
  assert.equal(coerce({ holdSeconds: 0 }).holdSeconds, 1);
  assert.equal(coerce({ holdSeconds: -5 }).holdSeconds, 1);
  assert.equal(coerce({ holdSeconds: 999 }).holdSeconds, 15);
  assert.equal(coerce({ holdSeconds: 'abc' }).holdSeconds, DEFAULTS.holdSeconds);
});

test('garbage input yields usable defaults', () => {
  for (const bad of [null, undefined, 'nope', 42, []]) {
    assert.equal(coerce(bad).gateMode, 'hold');
  }
});
