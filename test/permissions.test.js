'use strict';

/**
 * What an app is allowed to ask the browser for.
 *
 * Two rules, both of which were wrong at some point and both of which are the
 * kind of wrong you do not notice by using the app:
 *
 *   - Fullscreen is refused. A page that takes the whole screen covers the top
 *     bar, which is the only thing telling a child how to get back.
 *   - A capability belongs to the one app that was given it, and the camera is
 *     not on offer to anybody.
 */
const test = require('node:test');
const assert = require('node:assert');
const { requireSecurity } = require('./helpers');
const catalog = require('../src/main/catalog');

test('nothing may take the whole screen away from the child', () => {
  const policy = requireSecurity().createPolicy();
  policy.setApp({ id: 'smash', allowHosts: ['smash'], denyHosts: [] });

  assert.equal(policy.allowsPermission('fullscreen'), false,
    'fullscreen hides the way out, so it is refused');
  // Pointer lock stays. A game hiding the cursor is not hiding the bar.
  assert.equal(policy.allowsPermission('pointerLock'), true);
});

test('a capability is granted to the app that asked for it, and to no other', () => {
  const policy = requireSecurity().createPolicy();
  const musicLab = {
    id: 'musiclab', allowHosts: ['x'], denyHosts: [], permissions: ['microphone']
  };
  const otherSite = { id: 'poki', allowHosts: ['y'], denyHosts: [] };

  policy.setApp(musicLab);
  assert.equal(policy.allowsPermission('audioCapture'), true);
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio'] }), true);

  // The camera is the point of this one. Chromium asks for microphone and
  // camera under a single 'media' permission and says which it wants in
  // mediaTypes, so granting the pair because a microphone was requested would
  // hand a child's webcam to a website.
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['video'] }), false,
    'video is never granted');
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio', 'video'] }), false,
    'asking for both is asking for the camera');

  policy.setApp(otherSite);
  assert.equal(policy.allowsPermission('audioCapture'), false,
    'a site that was not given the microphone does not inherit the last one');

  policy.clear();
  assert.equal(policy.allowsPermission('audioCapture'), false,
    'nothing open means nothing granted');
});

test('the catalog only carries capabilities it recognises', () => {
  const read = (permissions) => catalog.parse(JSON.stringify({
    apps: [{ id: 'x', title: 'X', url: 'https://example.com/', permissions }]
  }))[0];

  assert.deepEqual(read(['microphone']).permissions, ['microphone']);
  // A typo must leave a site without a microphone rather than with something
  // nobody meant to hand over.
  assert.deepEqual(read(['micraphone']).permissions, []);
  assert.deepEqual(read(['camera', 'geolocation', 'notifications']).permissions, [],
    'the camera is not grantable at all');
  assert.deepEqual(read(undefined).permissions, []);
});

// --- the microphone reaching a tile a parent actually made ---------------------
//
// 2.1 shipped with Music Lab's microphone in the catalogue and working in the
// policy, and still every experiment that listened was told no: the grown-up
// screen copies a suggestion into the parent's catalog field by field, and
// `permissions` was never one of the fields. The grant is now looked up from
// the checked site at launch, by host.

const SITES = require('../config/suggestions.json').suggestions;

test('a Music tile saved without the permissions field still gets the microphone', () => {
  const policy = requireSecurity().createPolicy();
  policy.setVetted(SITES);
  // Exactly what a parent's catalog holds after adding Music from the catalogue.
  policy.setApp({ id: 'music', url: 'https://musiclab.chromeexperiments.com/', allowHosts: ['chromeexperiments.com'], denyHosts: [] });
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio'] }), true,
    'Spectrogram and Voice Spinner are told the microphone is refused');
  assert.equal(policy.allowsPermission('audioCapture'), true);
});

test('a tile pointed at one experiment gets what the site was given', () => {
  const policy = requireSecurity().createPolicy();
  policy.setVetted(SITES);
  policy.setApp({ id: 'spectrogram', url: 'https://musiclab.chromeexperiments.com/Spectrogram/', allowHosts: ['chromeexperiments.com'], denyHosts: [] });
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio'] }), true);
});

test('the camera stays refused, even to the site given the microphone', () => {
  const policy = requireSecurity().createPolicy();
  policy.setVetted(SITES);
  policy.setApp({ id: 'music', url: 'https://musiclab.chromeexperiments.com/', allowHosts: [], denyHosts: [] });
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['video'] }), false);
  assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio', 'video'] }), false);
});

test('no other site picks the microphone up from the catalogue', () => {
  const policy = requireSecurity().createPolicy();
  policy.setVetted(SITES);
  for (const url of ['https://poki.com/', 'https://chromeexperiments.com/', 'https://evil-musiclab.chromeexperiments.com.example/']) {
    policy.setApp({ id: 'x', url, allowHosts: [], denyHosts: [] });
    assert.equal(policy.allowsPermission('media', { mediaTypes: ['audio'] }), false, `${url} must not hear the child`);
  }
});
