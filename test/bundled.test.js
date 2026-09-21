'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const bundled = require('../src/main/bundled');
const { sanitizeApp } = require('../src/main/catalog');
const { requireSecurity } = require('./helpers');

const ROOT = path.join(__dirname, '..');

/** A throwaway vendor tree with one real app in it. */
function fakeVendor (apps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-bundled-'));
  for (const [folder, files] of Object.entries(apps)) {
    const appDir = path.join(dir, folder, 'app');
    fs.mkdirSync(appDir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      fs.writeFileSync(path.join(appDir, name), body);
    }
  }
  return dir;
}

function manifest (apps) {
  const file = path.join(os.tmpdir(), `sukhi-manifest-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ apps }));
  return file;
}

test('a manifest entry with no files on disk is dropped', () => {
  const vendor = fakeVendor({});
  const list = bundled.load(manifest([{ id: 'ghost', title: 'Ghost' }]), vendor);
  assert.deepEqual(list, [], 'a tile that opens nothing must not be offered');
});

test('an id that is not hostname-safe is refused', () => {
  const vendor = fakeVendor({ 'Bad Name': { 'index.html': '<html></html>' } });
  for (const id of ['Bad Name', '../escape', 'UPPER', '-leading', 'has/slash']) {
    const list = bundled.load(manifest([{ id, dir: 'Bad Name' }]), vendor);
    assert.deepEqual(list, [], `${id} must not become a hostname`);
  }
});

test('the folder may differ from the id', () => {
  const vendor = fakeVendor({ 'kids-coloring': { 'index.html': '<html></html>' } });
  const list = bundled.load(
    manifest([{ id: 'colouring', dir: 'kids-coloring', title: 'Colouring' }]), vendor);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'colouring');
  assert.equal(list[0].url, 'sukhiplay://colouring/index.html');
});

test('two entries cannot claim the same id', () => {
  const vendor = fakeVendor({ one: { 'index.html': 'a' }, two: { 'index.html': 'b' } });
  const list = bundled.load(manifest([
    { id: 'same', dir: 'one' },
    { id: 'same', dir: 'two' }
  ]), vendor);
  assert.equal(list.length, 1);
});

test('a bundled url belongs only to its own app', () => {
  assert.equal(bundled.belongsTo('sukhiplay://colouring/index.html', 'colouring'), true);
  assert.equal(bundled.belongsTo('sukhiplay://colouring/index.html', 'music'), false);
  assert.equal(bundled.belongsTo('https://colouring/index.html', 'colouring'), false);
  // No app open is not the same as every app open.
  assert.equal(bundled.belongsTo('sukhiplay://colouring/index.html', null), false);
  assert.equal(bundled.isBundledUrl('sukhiplay://x/'), true);
  assert.equal(bundled.isBundledUrl('https://example.com/'), false);
  assert.equal(bundled.isBundledUrl('not a url'), false);
});

test('the catalog accepts a bundled url and marks it bundled', () => {
  const app = sanitizeApp({
    id: 'colouring', title: 'Colouring', url: 'sukhiplay://colouring/index.html'
  }, 0);
  assert.equal(app.bundled, true);
  // With no allowlist of its own it falls back to its own host, which for a
  // bundled app is the app id -- so it can never reach a real hostname.
  assert.deepEqual(app.allowHosts, ['colouring']);
});

test('an ordinary site is not marked bundled', () => {
  const app = sanitizeApp({ id: 'x', title: 'X', url: 'https://example.com/' }, 0);
  assert.equal(app.bundled, false);
});

test('schemes other than http, https and ours are still refused', () => {
  for (const url of ['file:///etc/passwd', 'mailto:a@b.c', 'steam://run/1',
                     'sukhiplayx://a/', 'javascript:alert(1)']) {
    assert.equal(sanitizeApp({ id: 'x', title: 'X', url }, 0), null, url);
  }
});

test('every app in the real manifest is on disk and credited', () => {
  const list = bundled.load(
    path.join(ROOT, 'config', 'bundled.json'), path.join(ROOT, 'vendor'));
  assert.ok(list.length > 0, 'the manifest should describe at least one app');

  const notice = fs.readFileSync(path.join(ROOT, 'NOTICE'), 'utf8');
  for (const app of list) {
    assert.ok(app.credit, `${app.id} ships without a credit`);
    assert.ok(app.licence, `${app.id} ships without a licence`);
    assert.ok(app.sourceUrl, `${app.id} ships without a link to its source`);
    assert.ok(notice.includes(app.sourceUrl),
      `${app.id} is not credited in NOTICE`);

    // Somebody else's licence has to travel with their code.
    const folder = path.dirname(app.dir);
    assert.ok(fs.existsSync(path.join(folder, 'LICENSE')),
      `${app.id} ships without the upstream licence file`);
    assert.ok(fs.existsSync(path.join(folder, 'UPSTREAM')),
      `${app.id} does not record which commit it was built from`);
  }
});

test('nothing bundled loads anything from the network', () => {
  const list = bundled.load(
    path.join(ROOT, 'config', 'bundled.json'), path.join(ROOT, 'vendor'));

  // Things that make the browser go and fetch something. A plain <a href> is
  // deliberately not one of them: the credit link back to an author's own
  // repository stays, and the kiosk refuses to follow it anyway.
  const FETCHES = [
    [/\bsrc\s*=\s*["']https?:/i, 'a remote src'],
    [/<link\b[^>]*\bhref\s*=\s*["']https?:/i, 'a remote stylesheet or preload'],
    [/url\(\s*["']?https?:/i, 'a remote url() in CSS'],
    [/@import\s+(url\()?["']https?:/i, 'a remote @import'],
    [/\b(fetch|importScripts|import)\s*\(\s*["']https?:/i, 'a remote fetch or import'],
    [/\bnew\s+(Image|Audio|Worker|EventSource|WebSocket)\s*\(\s*["']?(https?|wss?):/i,
      'a remote resource constructor']
  ];

  for (const app of list) {
    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(html|js|mjs|css|json|webmanifest)$/i.test(e.name)) files.push(full);
      }
    };
    walk(app.dir);
    assert.ok(files.length > 0, `${app.id} has no files`);

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [pattern, what] of FETCHES) {
        // The point of a bundled app is that it works on a train. One remote
        // font or script would make that false without anyone noticing.
        const hit = text.match(pattern);
        assert.equal(hit, null,
          `${path.relative(ROOT, file)} has ${what}: ${hit && hit[0]}`);
      }
    }
  }
});

test('bundled apps do not reuse a catalogue shape or colour', () => {
  const list = bundled.load(
    path.join(ROOT, 'config', 'bundled.json'), path.join(ROOT, 'vendor'));
  const sites = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8')).suggestions;

  // They sit in one grid, so a repeated shape or colour is two tiles a child
  // cannot tell apart -- and telling them apart by picture is the whole point
  // of not using favicons.
  const shapes = new Map();
  const colours = new Map();
  for (const e of [...sites, ...list]) {
    assert.ok(!shapes.has(e.shape),
      `${e.id} and ${shapes.get(e.shape)} both use the shape "${e.shape}"`);
    assert.ok(!colours.has(e.color),
      `${e.id} and ${colours.get(e.color)} both use the colour ${e.color}`);
    shapes.set(e.shape, e.id);
    colours.set(e.color, e.id);
  }
});

test('every bundled shape is one the app can actually draw', () => {
  const list = bundled.load(
    path.join(ROOT, 'config', 'bundled.json'), path.join(ROOT, 'vendor'));
  const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
  for (const app of list) {
    assert.ok(html.includes(`id="shape-${app.shape}"`),
      `${app.id} asks for the shape "${app.shape}", which has no drawing`);
  }
});

test('only a bundled app may save, and only a picture', () => {
  // Stubbed, not required directly: security.js pulls in electron at the top,
  // and that throws in a plain Node process without the binary installed.
  const security = requireSecurity();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-saves-'));
  const policy = security.createPolicy();
  policy.setSaveDir(dir);

  const item = (mime, name) => ({ getMimeType: () => mime, getFilename: () => name });

  // A website: nothing may be written, whatever it claims to be.
  policy.setApp({ id: 'site', url: 'https://example.com/', allowHosts: ['example.com'] });
  assert.equal(policy.savePathFor(item('image/png', 'ok.png')), null);

  // Nothing open at all: also nothing.
  policy.clear();
  assert.equal(policy.savePathFor(item('image/png', 'ok.png')), null);

  policy.setApp({
    id: 'anything', url: 'sukhiplay://colouring/index.html',
    bundled: true, allowHosts: ['colouring']
  });

  // A picture, named after the bundle rather than after whatever the page
  // asked for -- a filename from content is a path, and a path can hold "..".
  const png = policy.savePathFor(item('image/png', '../../../etc/passwd'));
  assert.equal(path.dirname(png), dir);
  assert.ok(path.basename(png).startsWith('colouring-'));
  assert.ok(png.endsWith('.png'));

  // Anything that is not a picture is refused.
  for (const bad of ['application/x-msdownload', 'text/html', 'application/pdf', '']) {
    assert.equal(policy.savePathFor(item(bad, 'x.exe')), null, bad);
  }

  // A blob with no type falls back to the extension, checked against the same
  // short list rather than trusted.
  assert.ok(String(policy.savePathFor(item('', 'drawing.png'))).endsWith('.png'));
  assert.equal(policy.savePathFor(item('', 'drawing.exe')), null);

  // Three saves in the same second is what a delighted child does.
  const names = new Set();
  for (let i = 0; i < 3; i += 1) {
    const p = policy.savePathFor(item('image/png', 'a.png'));
    fs.writeFileSync(p, 'x');
    names.add(p);
  }
  assert.equal(names.size, 3, 'each save gets its own file');
});
