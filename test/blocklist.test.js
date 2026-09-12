'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { inspect } = require('../src/main/blocklist');
const { hostFromUrl } = require('../src/main/hosts');

const check = (url, type = 'script') => inspect(url, hostFromUrl(url), type);

test('known ad and tracker hosts are caught', () => {
  for (const url of [
    'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
    'https://imasdk.googleapis.com/js/sdkloader/ima3.js',
    'https://c.amazon-adsystem.com/aax2/apstag.js',
    'https://cdn.btloader.com/player.js',
    'https://www.googletagmanager.com/gtag/js',
    'https://bat.bing.com/bat.js'
  ]) {
    assert.ok(check(url), `${url} should be blocked`);
  }
});

test('ad code served from an otherwise-essential host is still caught', () => {
  // This is the case an allowlist alone cannot see: a real ad library sitting
  // on the same CDN the game itself is loaded from.
  const verdict = check('https://cdn.example.com/prebid/prebid_123.js');
  assert.ok(verdict);
  assert.equal(verdict.reason, 'ad-path');
});

test('ordinary game assets are left alone', () => {
  for (const url of [
    'https://cdn.example.com/scripts/game.js',
    'https://img.example.com/thumb.png',
    'https://example.com/en/g/some-game'
  ]) {
    assert.equal(check(url), null, `${url} should load`);
  }
});

test('beacon-style resource types are dropped', () => {
  assert.ok(inspect('https://example.com/x', 'example.com', 'ping'));
  assert.ok(inspect('https://example.com/x', 'example.com', 'cspReport'));
});
