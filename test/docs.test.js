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
  const refs = [...readme.matchAll(/(?:src="|\]\()(docs\/[^")\s]+\.png)/g)].map((m) => m[1]);
  assert.ok(refs.length, 'the README references no screenshots at all');
  for (const ref of new Set(refs)) {
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `README points at missing ${ref}`);
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
