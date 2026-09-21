'use strict';

/**
 * Loads src/main/security.js in a plain Node process.
 *
 * It requires `electron` at the top for one thing -- wrapping shell.openExternal
 * so an accidental call is loud -- and requiring the electron module outside
 * Electron resolves the binary and throws if it is not installed. That is not a
 * useful thing for a unit test about policy to depend on: the tests here are
 * about what the rules decide, and they were passing locally only because a
 * developer machine happens to have the binary sitting there.
 *
 * This was worked out once in blocklist.test.js and then not used by the next
 * test that needed it, which is what a copied trick does. It lives here now.
 */
function requireSecurity () {
  const Module = require('node:module');
  const realLoad = Module._load;
  Module._load = (request, ...rest) =>
    request === 'electron'
      ? { shell: { openExternal: async () => {} } }
      : realLoad(request, ...rest);
  try {
    // Dropped from the cache so the stub is what it binds to, whatever ran first.
    delete require.cache[require.resolve('../src/main/security')];
    return require('../src/main/security');
  } finally {
    Module._load = realLoad;
  }
}

module.exports = { requireSecurity };
