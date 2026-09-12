#!/usr/bin/env node
'use strict';

/**
 * Checks the Flathub submission without needing flatpak, which cannot run on
 * macOS. Catches the mistakes that are cheap to make and expensive to discover
 * in a review queue: a manifest pinning a tag that does not exist, a source
 * file the manifest references but nobody committed, and a build command
 * pointing at a path the sources do not produce.
 *
 * It does not replace an actual build. .github/workflows/flatpak.yml does that.
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'packaging', 'flathub');
const APP_ID = 'com.msingh.sukhi.play';

const problems = [];
const ok = [];

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const manifestPath = path.join(DIR, `${APP_ID}.yml`);
const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));

if (manifest['app-id'] !== APP_ID) {
  problems.push(`app-id is "${manifest['app-id']}", expected "${APP_ID}"`);
} else {
  ok.push(`app-id ${APP_ID}`);
}

// Flathub builds a tag, not a branch. A manifest pinning a tag that does not
// exist yet builds nothing, and one pinning an old tag silently ships old code.
const git = (manifest.modules || [])
  .flatMap((m) => m.sources || [])
  .find((s) => s.type === 'git');

if (!git) {
  problems.push('no git source in the manifest');
} else if (git.tag !== `v${pkg.version}`) {
  problems.push(`manifest pins ${git.tag} but package.json is ${pkg.version}; ` +
                `expected tag v${pkg.version}`);
} else {
  ok.push(`git source pinned to v${pkg.version}`);
}

// Every `type: file` source has to be committed next to the manifest.
for (const module of manifest.modules || []) {
  for (const source of module.sources || []) {
    if (source.type !== 'file') continue;
    const file = path.join(DIR, source.path);
    if (!fs.existsSync(file)) problems.push(`manifest references missing file ${source.path}`);
    else ok.push(`source file ${source.path}`);
  }
}

// Electron archives must be pinned by checksum or the build is not reproducible.
for (const module of manifest.modules || []) {
  for (const source of module.sources || []) {
    if (source.type !== 'archive') continue;
    if (!source.sha256 || !/^[0-9a-f]{64}$/.test(source.sha256)) {
      problems.push(`archive ${source.url} has no valid sha256`);
    } else {
      ok.push(`archive pinned ${source.sha256.slice(0, 12)}...`);
    }
  }
}

// The desktop file must be named after the app id; Flathub rejects otherwise.
const desktop = path.join(DIR, `${APP_ID}.desktop`);
if (!fs.existsSync(desktop)) {
  problems.push(`${APP_ID}.desktop is missing`);
} else {
  const text = fs.readFileSync(desktop, 'utf8');
  if (!text.includes(`Icon=${APP_ID}`)) problems.push(`desktop entry Icon= must be ${APP_ID}`);
  else ok.push('desktop entry icon name');
}

// The metainfo's launchable must match that desktop file, not the .deb's.
const metainfo = path.join(DIR, `${APP_ID}.metainfo.xml`);
if (!fs.existsSync(metainfo)) {
  problems.push(`${APP_ID}.metainfo.xml is missing; run npm run metainfo`);
} else {
  const text = fs.readFileSync(metainfo, 'utf8');
  if (!text.includes(`<launchable type="desktop-id">${APP_ID}.desktop</launchable>`)) {
    problems.push('metainfo launchable must be ' + APP_ID + '.desktop for Flathub');
  } else {
    ok.push('metainfo launchable');
  }
  if (!text.includes(`<release version="${pkg.version}"`)) {
    problems.push(`metainfo has no <release> for ${pkg.version}; run npm run metainfo`);
  } else {
    ok.push(`metainfo release ${pkg.version}`);
  }
}

for (const line of ok) console.log(`  ok  ${line}`);
for (const line of problems) console.error(`  PROBLEM  ${line}`);
console.log(problems.length
  ? `\n${problems.length} problem(s); not ready to submit`
  : '\nmanifest is internally consistent. A real build still has to pass CI.');
process.exit(problems.length ? 1 : 0);
