'use strict';

// Printing is allowed for our own apps only, never opens a dialog, and a
// double tap prints once. See src/main/printing.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const bundled = require('../src/main/bundled');
const { createPrinter, officialFor, GAP_MS } = require('../src/main/printing');

const APPS = [
  { id: 'studio', official: true },
  { id: 'colouring', official: true },
  { id: 'smash', official: false }
];

/** A stand-in for a webContents: records what it was asked to print. */
function contents (url, result = [true, '']) {
  const calls = [];
  return {
    calls,
    getURL: () => url,
    print: (options, callback) => { calls.push(options); callback(...result); }
  };
}

function printer (clock = { t: 100000 }) {
  return createPrinter({ apps: () => APPS, belongsTo: bundled.belongsTo, now: () => clock.t });
}

test('an official app prints, silently, on A4 with no margins', async () => {
  const page = contents('sukhiplay://studio/index.html#/stationery');
  const r = await printer()(page);
  assert.deepEqual(r, { ok: true, app: 'studio', reason: '' });
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].silent, true, 'a print dialog is a way out of the kiosk');
  assert.equal(page.calls[0].pageSize, 'A4');
  assert.equal(page.calls[0].printBackground, true);
  assert.deepEqual(page.calls[0].margins, { marginType: 'none' });
});

test('websites and apps we did not make are refused without printing', async () => {
  for (const url of [
    'https://example.com/print-me',
    'sukhiplay://smash/index.html',
    'https://studio/index.html',
    '',
    undefined
  ]) {
    const page = contents(url);
    const r = await printer()(page);
    assert.equal(r.ok, false, `${url} must not print`);
    assert.equal(r.reason, 'not-allowed');
    assert.equal(page.calls.length, 0);
  }
});

test('two presses close together print once', async () => {
  const clock = { t: 100000 };
  const print = printer(clock);
  const page = contents('sukhiplay://studio/index.html');
  assert.equal((await print(page)).ok, true);
  clock.t += 500;
  assert.deepEqual(await print(page), { ok: false, reason: 'too-soon' });
  clock.t += GAP_MS;
  assert.equal((await print(page)).ok, true);
  assert.equal(page.calls.length, 2);
});

test('a printer that fails says why, and a throw does not escape', async () => {
  const page = contents('sukhiplay://studio/index.html', [false, 'Print job failed']);
  assert.deepEqual(await printer()(page), { ok: false, app: 'studio', reason: 'Print job failed' });

  const broken = { getURL: () => 'sukhiplay://studio/index.html', print: () => { throw new Error('no printers'); } };
  assert.deepEqual(await printer()(broken), { ok: false, app: 'studio', reason: 'no printers' });
});

test('officialFor only answers for official apps', () => {
  assert.equal(officialFor('sukhiplay://studio/x.html', APPS, bundled.belongsTo).id, 'studio');
  assert.equal(officialFor('sukhiplay://smash/x.html', APPS, bundled.belongsTo), null);
  assert.equal(officialFor(42, APPS, bundled.belongsTo), null);
});
