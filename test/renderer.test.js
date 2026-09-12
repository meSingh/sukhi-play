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

test('every function the renderer calls is actually defined', () => {
  // The gap this closes: the id test checks elements, not functions. Removing
  // helper functions while callers remained left calls to row() and button()
  // that only blew up at runtime, in the middle of the setup walkthrough.
  const KEYWORDS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
    'await', 'new', 'delete', 'void', 'in', 'of', 'do', 'else', 'yield',
    'async', 'throw', 'case', 'instanceof'
  ]);
  const GLOBALS = new Set([
    'console', 'document', 'window', 'navigator', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'requestAnimationFrame', 'fetch', 'alert',
    'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Promise', 'Set', 'Map',
    'URL', 'URLSearchParams', 'Error', 'RegExp', 'Symbol', 'Proxy', 'Reflect',
    'encodeURIComponent', 'decodeURIComponent', 'structuredClone', 'queueMicrotask'
  ]);

  const defined = new Set();
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
  // destructured and parameter names, kept loose on purpose
  for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/[=:].*$/, '').replace(/[{}\[\].]/g, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
    }
  }

  const called = new Set();
  for (const m of code.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/gm)) called.add(m[2]);

  const undefinedCalls = [...called].filter((name) =>
    !defined.has(name) && !KEYWORDS.has(name) && !GLOBALS.has(name));

  assert.deepEqual(undefinedCalls, [],
    `called but never defined: ${undefinedCalls.join(', ')}`);
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
