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
