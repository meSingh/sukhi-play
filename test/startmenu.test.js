'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'startmenu.js'), 'utf8');

test('Escape is only ever sent to the Windows shell, never to another app', () => {
  // A real dialog in front of the kiosk must never receive keys from us.
  const reclaim = source.slice(source.indexOf('public static string Reclaim'));
  const guard = reclaim.indexOf('Array.IndexOf(Shell, owner) < 0) return');
  const escape = reclaim.indexOf('Tap(0x1B)');
  assert.ok(guard > 0 && escape > 0, 'Reclaim must check the owner and press Escape');
  assert.ok(guard < escape, 'the owner check must come before Escape is pressed');
});

test('the helper does nothing outside Windows', () => {
  const startMenu = require('../src/main/startmenu.js');
  if (process.platform === 'win32') return;
  startMenu.start();
  assert.equal(startMenu.isReady(), false);
  startMenu.stop();
});

test('the shell hosts cover Start, Search and quick settings', () => {
  const { SHELL_HOSTS } = require('../src/main/startmenu.js');
  for (const name of ['StartMenuExperienceHost', 'SearchHost', 'ShellExperienceHost']) {
    assert.ok(SHELL_HOSTS.includes(name), `${name} missing`);
  }
});
