'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RENDERER = path.join(__dirname, '..', 'src', 'renderer');
const js = fs.readFileSync(path.join(RENDERER, 'app.js'), 'utf8');

/** Comments talk about ids that do not exist; only real code counts. */
const code = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
const html = fs.readFileSync(path.join(RENDERER, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(RENDERER, 'styles.css'), 'utf8');

test('every element the renderer reaches for actually exists', () => {
  // The bug this guards: restructuring the markup dropped one button, the
  // binding for it threw out of wire(), and the boot handler answered by
  // replacing the whole document -- so a single stale id blanked the interface.
  const used = new Set();
  for (const m of code.matchAll(/\bel\('([^']+)'\)/g)) used.add(m[1]);
  // Our own on(id, event, fn) only -- not api.on(event, fn), which takes an
  // event name rather than an element id.
  for (const m of code.matchAll(/(^|[^.\w])on\('([^']+)'\s*,\s*'/gm)) used.add(m[2]);

  assert.ok(used.size > 20, 'expected the renderer to reference many ids');

  const missing = [...used].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `ids missing from index.html: ${missing.join(', ')}`);
});

test('nothing binds a listener without going through the safe helper', () => {
  // Direct el('x').addEventListener throws on a missing element; on() does not.
  const direct = [...code.matchAll(/el\('[^']+'\)\.addEventListener/g)];
  assert.equal(direct.length, 0,
    'use on(id, event, fn) so a missing element cannot take down the interface');
});

test('a boot failure does not destroy the document', () => {
  assert.ok(!/document\.body\.textContent\s*=/.test(code),
    'replacing document.body wipes every element and turns one fault into a blank screen');
});

test('hidden elements stay hidden', () => {
  // Author styles beat the UA's [hidden] rule at equal specificity, so any
  // `.thing { display: ... }` in this file would otherwise pin it on screen.
  assert.ok(/\[hidden\]\s*{\s*display:\s*none\s*!important/.test(css),
    'styles.css needs [hidden] { display: none !important }');
});

test('every shape a catalog entry may use has artwork', () => {
  const { SHAPES } = require('../src/main/catalog');
  for (const shape of SHAPES) {
    assert.ok(html.includes(`id="shape-${shape}"`), `no artwork for shape "${shape}"`);
  }
});

test('the dated glass and blur treatments are gone', () => {
  assert.ok(!css.includes('backdrop-filter'), 'frosted glass reads as 2021');
  assert.ok(!/filter:\s*blur\(/.test(css), 'blurred background orbs read as 2021');
});
