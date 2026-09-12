'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const library = require('../src/main/library');
const { summarise, normalizeUrl, prettyTitle } = require('../src/main/probe');

const tmpCatalog = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-')), 'catalog.json');

test('bundled suggestions are all valid and none is enabled', () => {
  const list = library.loadSuggestions(path.join(__dirname, '..', 'config', 'suggestions.json'));
  assert.ok(list.length >= 5, 'expected a useful number of suggestions');
  for (const s of list) {
    assert.equal(s.enabled, false, `${s.id} must not ship enabled`);
    assert.ok(s.allowHosts.length > 0, `${s.id} needs an allowlist`);
    assert.ok(/^https?:\/\//.test(s.url), `${s.id} needs a web url`);
  }
});

test('a site whose terms forbid ad blocking is shipped with filtering off', () => {
  const list = library.loadSuggestions(path.join(__dirname, '..', 'config', 'suggestions.json'));
  const yt = list.find((s) => s.id === 'youtubekids');
  assert.ok(yt, 'youtubekids suggestion should exist');
  assert.equal(yt.blockAds, false, 'YouTube Kids must be left as its operator intends');
});

test('adding a site writes it and refuses an exact duplicate', () => {
  const file = tmpCatalog();
  const first = library.addSite(file, { title: 'Test', url: 'https://example.com/', allowHosts: ['example.com'] });
  assert.ok(first.ok);
  assert.equal(first.app.enabled, true);

  const again = library.addSite(file, { title: 'Test', url: 'https://example.com/', allowHosts: ['example.com'] });
  assert.equal(again.ok, false);
  assert.match(again.message, /Already added/);
});

test('ids stay unique and tiles get distinct looks', () => {
  const file = tmpCatalog();
  const a = library.addSite(file, { title: 'Games', url: 'https://a.com/', allowHosts: ['a.com'] });
  const b = library.addSite(file, { title: 'Games', url: 'https://b.com/', allowHosts: ['b.com'] });
  assert.notEqual(a.app.id, b.app.id);
  assert.notEqual(a.app.shape, b.app.shape);
});

test('a junk url is refused rather than written', () => {
  const file = tmpCatalog();
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'steam://x']) {
    assert.equal(library.addSite(file, { title: 'x', url }).ok, false, `${url} must be refused`);
  }
});

test('updating and removing work', () => {
  const file = tmpCatalog();
  const { app } = library.addSite(file, { title: 'X', url: 'https://x.com/', allowHosts: ['x.com'] });
  assert.equal(library.updateSite(file, app.id, { enabled: false }).app.enabled, false);
  assert.ok(library.removeSite(file, app.id).ok);
  assert.equal(library.removeSite(file, app.id).ok, false);
});

test('a catalog written by the app survives being read back', () => {
  const file = tmpCatalog();
  library.addSite(file, { title: 'X', url: 'https://x.com/', allowHosts: ['x.com'] });
  const back = library.readCatalogFile(file);
  assert.equal(back.apps.length, 1);
  assert.equal(back.apps[0].url, 'https://x.com/');
});

test('the tile payload carries only enabled apps, with what a tile needs', () => {
  const payload = library.toTilePayload([
    { id: 'a', title: 'A', shape: 'star', color: '#111111', enabled: true, icon: '/tmp/a.png' },
    { id: 'b', title: 'B', shape: 'ball', color: '#222222', enabled: false },
    { id: 'c', title: 'C', shape: 'note', color: '#333333', enabled: true }
  ]);
  assert.deepEqual(payload.map((a) => a.id), ['a', 'c']);
  assert.deepEqual(payload[0], { id: 'a', title: 'A', shape: 'star', color: '#111111', icon: '/tmp/a.png' });
  assert.equal(payload[1].icon, null);
});

test('a newly added site appears in the tile payload straight away', () => {
  // The regression this guards: the app was written to disk correctly but the
  // launcher was never told, so the parent added a game and nothing appeared.
  const file = tmpCatalog();
  const before = library.toTilePayload(library.readCatalogFile(file).apps);
  assert.equal(before.length, 0);

  library.addSite(file, { title: 'New', url: 'https://new.example/', allowHosts: ['new.example'] });

  const after = library.toTilePayload(library.readCatalogFile(file).apps);
  assert.equal(after.length, 1);
  assert.equal(after[0].title, 'New');
});

test('turning a site off removes it from the tile payload', () => {
  const file = tmpCatalog();
  const { app } = library.addSite(file, { title: 'X', url: 'https://x.com/', allowHosts: ['x.com'] });
  library.updateSite(file, app.id, { enabled: false });
  assert.equal(library.toTilePayload(library.readCatalogFile(file).apps).length, 0);
});

test('probed hostnames collapse to a short allowlist', () => {
  assert.deepEqual(
    summarise(['a.poki-cdn.com', 'img.poki-cdn.com', 'poki.com', 'x.y.poki.com']),
    ['poki-cdn.com', 'poki.com']
  );
});

test('a typed domain becomes a usable url, and junk does not', () => {
  assert.equal(normalizeUrl('pbskids.org'), 'https://pbskids.org/');
  assert.equal(normalizeUrl('  https://a.com/x '), 'https://a.com/x');
  for (const bad of ['', 'notadomain', 'javascript:alert(1)', 'file:///etc']) {
    assert.equal(normalizeUrl(bad), null, `${bad} must be refused`);
  }
});

test('tile names stay short enough to read', () => {
  assert.equal(prettyTitle('PBS KIDS | Games', 'https://pbskids.org/'), 'PBS KIDS');
  // A long marketing title is dropped in favour of the domain.
  assert.equal(prettyTitle('The Very Best Free Online Games For Everyone', 'https://poki.com/'), 'Poki');
  assert.equal(prettyTitle('', 'https://scratch.mit.edu/'), 'Mit');
});
