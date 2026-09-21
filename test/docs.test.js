'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(SHOTS, 'captions.json'), 'utf8'));

test('every screenshot in the manifest exists and captured cleanly', () => {
  assert.ok(manifest.length, 'captions.json is empty; run npm run shots');
  for (const shot of manifest) {
    assert.ok(!shot.error, `${shot.name} failed to capture: ${shot.error}`);
    const file = path.join(SHOTS, `${shot.name}.png`);
    assert.ok(fs.existsSync(file), `${shot.name}.png is in the manifest but not on disk`);
    assert.ok(fs.statSync(file).size > 1024, `${shot.name}.png is suspiciously small`);
    assert.ok(shot.caption && shot.caption.length > 10, `${shot.name} has no usable caption`);
  }
});

test('screenshot dimensions are inside the AppStream range', () => {
  // Software centres reject anything outside this, silently, and the listing
  // then shows no screenshots at all.
  for (const shot of manifest) {
    const buf = fs.readFileSync(path.join(SHOTS, `${shot.name}.png`));
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.ok(width >= 624 && width <= 3840, `${shot.name} is ${width}px wide`);
    assert.ok(height >= 351 && height <= 2160, `${shot.name} is ${height}px tall`);
  }
});

test('every image the README points at is actually there', () => {
  // Moving a screenshot used to leave a broken image in the README, which only
  // shows up once it is rendered on GitHub.
  const refs = [
    ...readme.matchAll(/(?:src="|srcset="|\]\()(docs\/[^")\s]+\.(?:png|svg|md))/g)
  ].map((m) => m[1]);
  assert.ok(refs.length, 'the README references nothing under docs/');
  for (const ref of new Set(refs)) {
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `README points at missing ${ref}`);
  }
});

test('the macOS download button is ours, not Apple\'s', () => {
  // Sukhi Play is not distributed through the Mac App Store. Apple's "Download
  // on the Mac App Store" badge would say it is, and using their marks would
  // imply an endorsement that does not exist, so the button is a local SVG.
  for (const variant of ['light', 'dark']) {
    const file = path.join(ROOT, 'docs', `badge-macos-${variant}.svg`);
    assert.ok(fs.existsSync(file), `docs/badge-macos-${variant}.svg is missing`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /not (?:from )?the App Store/i,
      'the button has to say it is not an App Store download');
    assert.ok(!/app ?store\.com|apple\.com|<image|xlink:href/i.test(svg),
      'the button must not pull in Apple artwork');
  }
  assert.ok(!/(?:mac_?app_?store|Download_on_the)/i.test(readme),
    'the README must not use Apple official badge artwork');
});

test('the Windows button is ours, not Microsoft\'s', () => {
  // Sukhi Play is not in the Microsoft Store, so their "Get it from Microsoft"
  // badge would claim a listing that does not exist.
  for (const variant of ['light', 'dark']) {
    const file = path.join(ROOT, 'docs', `badge-windows-${variant}.svg`);
    assert.ok(fs.existsSync(file), `docs/badge-windows-${variant}.svg is missing`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /not the Microsoft Store/i,
      'the button has to say it is not a Microsoft Store download');
    assert.ok(!/microsoft\.com|<image|xlink:href/i.test(svg),
      'the button must not pull in Microsoft artwork');
  }
});

test('the macOS page offers both architectures by their permanent names', () => {
  // The release job aliases the two disk images to version-free names so these
  // links keep working. If the names drift apart the page 404s silently.
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'macos.md'), 'utf8');
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  for (const name of ['Sukhi-Play-macOS-AppleSilicon.dmg', 'Sukhi-Play-macOS-Intel.dmg']) {
    assert.ok(page.includes(`releases/latest/download/${name}`),
      `docs/macos.md does not link ${name}`);
    assert.ok(workflow.includes(name),
      `the release job does not produce ${name}, so the link would 404`);
  }

  const win = fs.readFileSync(path.join(ROOT, 'docs', 'windows.md'), 'utf8');
  for (const name of ['Sukhi-Play-Windows-Setup.exe', 'Sukhi-Play-Windows-Portable.exe']) {
    assert.ok(win.includes(`releases/latest/download/${name}`),
      `docs/windows.md does not link ${name}`);
    assert.ok(workflow.includes(name),
      `the release job does not produce ${name}, so the link would 404`);
  }
});

test('the metainfo generator lists every captured screenshot', () => {
  // The list software centres read is generated from the manifest. If that
  // wiring breaks, the store listing loses its screenshots and nothing fails
  // loudly.
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-metainfo.js')], { cwd: ROOT });
  const xml = fs.readFileSync(
    path.join(ROOT, 'build', 'linux', 'com.msingh.sukhi.play.metainfo.xml'), 'utf8'
  );
  for (const shot of manifest) {
    assert.ok(xml.includes(`${shot.name}.png`), `metainfo omits ${shot.name}.png`);
    assert.ok(xml.includes(shot.caption), `metainfo omits the caption for ${shot.name}`);
  }
  assert.ok(/<screenshot type="default">[\s\S]{0,200}01-launcher\.png/.test(xml),
    'the launcher must be the default screenshot; it is what the app is');
});

test('the published catalogue is built from the shipped list', () => {
  // Two copies of a list drift, and the one that drifts is the one a parent is
  // reading. The page is generated from config/suggestions.json for that
  // reason, and this catches anyone hand-editing the page instead.
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8'));
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'catalogue.html'), 'utf8');
  for (const entry of data.suggestions) {
    assert.ok(page.includes(`>${entry.title}<`), `${entry.title} is missing from the page`);
  }
  const cards = (page.match(/class="cat-card"/g) || []).length;
  assert.equal(cards, data.suggestions.length, 'the page and the list disagree on how many sites');
});

test('the catalogue page carries no third-party imagery and claims nothing', () => {
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'catalogue.html'), 'utf8');
  assert.match(page, /compatibility list, not a recommendation/i);
  assert.match(page, /not connected to any of these sites/i);
  // No logos, favicons or anything else loaded from somebody else's server.
  const external = [...page.matchAll(/(?:src|srcset)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, [], `the page should load no remote images: ${external.join(', ')}`);
  for (const word of ['recommended', 'child-safe', 'vetted', 'approved by us']) {
    assert.ok(!new RegExp(word, 'i').test(page), `"${word}" claims more than this project checks`);
  }
});
