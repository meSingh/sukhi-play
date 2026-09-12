'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createHostGate, matchesPattern, normalizeHost, hostFromUrl } = require('../src/main/hosts');

test('a pattern matches the host itself and its subdomains', () => {
  assert.ok(matchesPattern('example.com', 'example.com'));
  assert.ok(matchesPattern('a.example.com', 'example.com'));
  assert.ok(matchesPattern('a.b.example.com', 'example.com'));
});

test('matching is on label boundaries, so lookalike domains are refused', () => {
  // The whole point: "evil-example.com" must never satisfy "example.com".
  assert.equal(matchesPattern('evil-example.com', 'example.com'), false);
  assert.equal(matchesPattern('notexample.com', 'example.com'), false);
  assert.equal(matchesPattern('example.com.attacker.net', 'example.com'), false);
});

test('hosts are normalised for case and trailing dots', () => {
  assert.equal(normalizeHost('EXAMPLE.com.'), 'example.com');
  assert.ok(matchesPattern('EXAMPLE.COM', 'example.com'));
  assert.ok(matchesPattern('example.com.', 'example.com'));
});

test('deny entries override allow entries', () => {
  const gate = createHostGate({ allow: ['example.com'], deny: ['ads.example.com'] });
  assert.equal(gate.verdict('example.com'), 'allow');
  assert.equal(gate.verdict('cdn.example.com'), 'allow');
  assert.equal(gate.verdict('ads.example.com'), 'deny-explicit');
  assert.equal(gate.verdict('x.ads.example.com'), 'deny-explicit');
});

test('anything not on the allowlist is denied', () => {
  const gate = createHostGate({ allow: ['example.com'] });
  assert.equal(gate.verdict('tracker.net'), 'deny-not-allowed');
  assert.equal(gate.verdict(''), 'deny-no-host');
});

test('hostFromUrl copes with junk', () => {
  assert.equal(hostFromUrl('https://a.example.com/x?y=1'), 'a.example.com');
  assert.equal(hostFromUrl('not a url'), '');
});
