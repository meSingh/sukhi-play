'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sanitizeApp, parse } = require('../src/main/catalog');

test('only http and https entries are accepted', () => {
  // An entry that can launch another program would defeat the whole app.
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'steam://run/1',
                     'mailto:a@b.com', 'itms-apps://x', 'not a url']) {
    assert.equal(sanitizeApp({ id: 'x', url }, 0), null, `${url} must be rejected`);
  }
  assert.ok(sanitizeApp({ id: 'x', url: 'https://example.com' }, 0));
  assert.ok(sanitizeApp({ id: 'x', url: 'http://example.com' }, 0));
});

test('an entry with no allowlist falls back to its own host, never to wide open', () => {
  const app = sanitizeApp({ id: 'x', url: 'https://example.com/games' }, 0);
  assert.deepEqual(app.allowHosts, ['example.com']);
});

test('unknown shapes and colours fall back to valid defaults', () => {
  const app = sanitizeApp({ id: 'x', url: 'https://example.com', shape: 'dragon', color: 'red' }, 0);
  assert.equal(app.shape, 'star');
  assert.equal(app.color, '#3b82f6');
});

test('entries default to enabled only when not explicitly disabled', () => {
  assert.equal(sanitizeApp({ id: 'x', url: 'https://e.com' }, 0).enabled, true);
  assert.equal(sanitizeApp({ id: 'x', url: 'https://e.com', enabled: false }, 0).enabled, false);
});

test('duplicate ids are dropped', () => {
  const apps = parse(JSON.stringify({
    apps: [
      { id: 'a', url: 'https://e.com' },
      { id: 'a', url: 'https://other.com' }
    ]
  }));
  assert.equal(apps.length, 1);
  assert.equal(apps[0].url, 'https://e.com/');
});
