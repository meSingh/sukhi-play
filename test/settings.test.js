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

test('the walkthrough runs until it has been completed once', () => {
  assert.equal(coerce({}).onboarded, false, 'a fresh install must be walked through');
  assert.equal(coerce({ onboarded: true }).onboarded, true);
  // A junk value must not skip setup and leave a parent on an empty screen.
  assert.equal(coerce({ onboarded: 'yes' }).onboarded, false);
});

test('settings survive a save and reload', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { save, load } = require('../src/main/settings');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-set-'));
  assert.equal(load(dir).settings.onboarded, false);
  assert.equal(save(dir, { onboarded: true }).onboarded, true);
  assert.equal(load(dir).settings.onboarded, true, 'must persist across restarts');

  // Saving one field must not wipe the others.
  save(dir, { holdSeconds: 5 });
  const back = load(dir).settings;
  assert.equal(back.holdSeconds, 5);
  assert.equal(back.onboarded, true);
});

test('garbage input yields usable defaults', () => {
  for (const bad of [null, undefined, 'nope', 42, []]) {
    assert.equal(coerce(bad).gateMode, 'hold');
  }
});

test('the sum gate is a setting the file can carry', () => {
  assert.equal(coerce({ gateMode: 'sum' }).gateMode, 'sum');
  assert.equal(coerce({ gateMode: 'hold' }).gateMode, 'hold');
  // Anything unrecognised falls back to the hold rather than locking a parent
  // out of their own machine.
  assert.equal(coerce({ gateMode: 'fingerprint' }).gateMode, 'hold');
});


test('the shipped defaults survive being loaded and sanitised', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { parse } = require('../src/main/catalog');
  const file = path.join(__dirname, '..', 'config', 'catalog.json');
  const apps = parse(fs.readFileSync(file, 'utf8'));

  // A default that sanitises away would leave a first run with a blank screen
  // and nothing in the log to say why.
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(apps.length, raw.apps.length, 'every shipped default should survive');
  for (const app of apps) {
    assert.equal(app.bundled, true);
    assert.equal(app.enabled, true);
  }
});
