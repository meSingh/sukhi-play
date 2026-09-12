'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RENDERER = path.join(__dirname, '..', 'src', 'renderer');
const js = fs.readFileSync(path.join(RENDERER, 'app.js'), 'utf8');

/** Comments mention ids that do not exist; only real code counts. */
const code = js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

/**
 * The same source with string PROSE removed, for scanning call sites.
 *
 * Quoted text can read like a call: "the latest version (1.0.1)" looked like a
 * call to version(). The id scan needs those quotes intact, so this is a second
 * view rather than a change to the first.
 */
const callSites = code
  .replace(/`(?:\\.|[^`\\])*`/g, (lit) => {
    const parts = [...lit.matchAll(/\$\{([^{}]*)\}/g)].map((m) => m[1]);
    return parts.length ? '(' + parts.join(',') + ')' : '0';
  })
  .replace(/'(?:\\.|[^'\\])*'/g, '0')
  .replace(/"(?:\\.|[^"\\])*"/g, '0');

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
  for (const m of callSites.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for (const m of callSites.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
  // destructured and parameter names, kept loose on purpose
  for (const m of callSites.matchAll(/\(([^)]*)\)\s*=>/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/[=:].*$/, '').replace(/[{}\[\].]/g, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name);
    }
  }

  const called = new Set();
  for (const m of callSites.matchAll(/(^|[^.\w$'"`])([A-Za-z_$][\w$]*)\s*\(/gm)) called.add(m[2]);

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

test('the launcher bar cannot be scrolled under the top edge', () => {
  // The bar clipped at the top of the screen on Linux for two releases. The
  // cause was structural, not a number that needed nudging: the bar was
  // `position: sticky` inside a launcher that scrolled, so where it landed
  // depended on a scroll offset. And the launcher always had one, because a
  // 76px bar sat above a body with `min-height: calc(100% - 74px)` -- a
  // permanent 2px overflow. Both halves are asserted here because fixing
  // either one alone leaves the bar's position a function of scroll state.
  const bar = css.match(/^\.top \{([^}]*)\}/m);
  assert.ok(bar, 'no .top rule in styles.css');
  assert.ok(!/position:\s*sticky/.test(bar[1]),
    '.top must not be sticky: a sticky bar moves with its scroll container');
  assert.ok(/flex:\s*0 0 auto/.test(bar[1]),
    '.top needs flex: 0 0 auto, or a squeezed bar clips its own 44px controls');

  const launcher = css.match(/^#launcher \{([^}]*)\}/m);
  assert.ok(launcher, 'no #launcher rule in styles.css');
  assert.ok(/overflow:\s*hidden/.test(launcher[1]),
    '#launcher must not scroll; .launcher-inner is the scroller');

  const inner = css.match(/^\.launcher-inner \{([^}]*)\}/m);
  assert.ok(inner, 'no .launcher-inner rule in styles.css');
  assert.ok(/overflow-y:\s*auto/.test(inner[1]),
    '.launcher-inner must be the scrolling element');
  assert.ok(!/calc\(100% - \d+px\)/.test(inner[1]),
    'a height guessed against the bar drifts the moment the bar changes');
  assert.ok(/justify-content:\s*safe center/.test(inner[1]),
    'plain centring puts overflow above the scroll origin, out of reach');
});

test('every shape a catalog entry may use has artwork', () => {
  const { SHAPES } = require('../src/main/catalog');
  for (const shape of SHAPES) {
    assert.ok(html.includes(`id="shape-${shape}"`), `no artwork for shape "${shape}"`);
  }
});

test('opening the editor resets the delete button completely', () => {
  // The bug this guards: delete set `disabled = true` and, on success, closed
  // the form without ever clearing it. Every app opened afterwards showed a
  // dead Delete button, which looked exactly like certain apps being
  // undeletable.
  const openForm = code.slice(code.indexOf('function openForm'), code.indexOf('function closeForm'));
  assert.ok(openForm.length > 100, 'openForm should be findable');

  for (const reset of ['disabled = false', "dataset.armed = 'no'", 'classList.remove']) {
    assert.ok(openForm.includes(reset),
      `openForm must reset the delete button: missing ${reset}`);
  }
});

test('a card opens the editor and the switch does not', () => {
  assert.ok(code.includes("openForm('edit'"), 'cards should open the editor');
  assert.ok(/stopPropagation/.test(code),
    'the switch inside a clickable card must stop its click bubbling');
});

test('no em dashes in anything a person reads', () => {
  // They are the clearest tell that a machine wrote the text, and this is a
  // product for parents, not a generated artefact.
  const offenders = [];
  for (const [name, text] of [['index.html', html], ['app.js', js], ['styles.css', css]]) {
    if (text.includes('\u2014')) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `em dashes found in: ${offenders.join(', ')}`);
});

test('the dated glass and blur treatments are gone', () => {
  assert.ok(!css.includes('backdrop-filter'), 'frosted glass reads as 2021');
  assert.ok(!/filter:\s*blur\(/.test(css), 'blurred background orbs read as 2021');
});

test('BAR_HEIGHT matches the stylesheet --bar-h', () => {
  // These drifted: the constant said 72 and --bar-h said 76, so in playing
  // mode the shell view was given 72px for a 76px bar. The bottom 4px was
  // clipped and the game view was drawn over it. The running app reads the
  // property, but the constant is the fallback and must not be wrong.
  const { BAR_HEIGHT } = require('../src/main/windowing');
  const declared = css.match(/--bar-h:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(declared, 'styles.css no longer declares --bar-h');
  assert.strictEqual(BAR_HEIGHT, Math.ceil(Number(declared[1])),
    `BAR_HEIGHT is ${BAR_HEIGHT} but --bar-h is ${declared[1]}px`);
});

test('the in-game bar and the launcher bar are not confused for each other', () => {
  // They are different elements with different heights: #bar is the in-game
  // strip sized by --bar-h, .top is the launcher header sized by its contents.
  // BAR_HEIGHT governs only the first. Conflating them sends the game view the
  // wrong way, so keep the two selectors distinguishable.
  assert.ok(/^#bar \{[^}]*height:\s*var\(--bar-h\)/m.test(css),
    '#bar must take its height from --bar-h');
  const top = css.match(/^\.top \{([^}]*)\}/m);
  assert.ok(top && !/height:\s*var\(--bar-h\)/.test(top[1]),
    '.top must not be sized by --bar-h; it is not the in-game bar');
});
