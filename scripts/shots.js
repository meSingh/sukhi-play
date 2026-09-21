#!/usr/bin/env node
'use strict';

/**
 * Regenerates the site's screenshots from the real application.
 *
 * Two passes are needed because the interesting states do not coexist. The
 * onboarding screens only exist before setup, and the tile screen only has
 * anything on it after, so each pass gets its own throwaway profile: one seeded
 * with a few apps, one completely empty.
 *
 * The seeded profile is built from config/suggestions.json rather than a
 * hand-written list, so the screenshots show real titles, colours and hosts and
 * cannot drift from what the app would actually produce.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { seedProfile, electronBin, ROOT } = require('./seed-profile');
// web/public for the copy the site serves, and web/src/images for the copy
// Astro optimises into the features page. docs/ is build output and is
// emptied by every build.
const OUT = path.join(ROOT, 'web', 'public', 'screenshots');
const IMAGES = path.join(ROOT, 'web', 'src', 'images');
const SEED_IDS = ['poki', 'pbskids', 'scratch', 'toytheater', 'natgeokids', 'musiclab'];

function seededProfile () {
  return seedProfile({ prefix: 'sukhi-shot-seeded-', ids: SEED_IDS });
}

function run (label, profile) {
  process.stdout.write(`[shots] ${label}\n`);
  const res = spawnSync(electronBin(), [
    '.', `--shots=${OUT}`, `--user-data-dir=${profile}`
  ], { cwd: ROOT, encoding: 'utf8' });

  for (const line of (res.stdout || '').split('\n')) {
    if (line.startsWith('[SHOT]')) console.log('  ' + line.replace('[SHOT] ', ''));
  }
  if (res.status !== 0) {
    console.error((res.stderr || '').trim().split('\n').slice(-8).join('\n'));
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
}

function main () {
  fs.mkdirSync(OUT, { recursive: true });

  const seeded = seededProfile();
  console.log(`[shots] seeded a profile with ${seeded.count} apps`);
  run('pass 1: the app in use', seeded.dir);

  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-shot-fresh-'));
  run('pass 2: first run', fresh);

  for (const dir of [seeded.dir, fresh]) fs.rmSync(dir, { recursive: true, force: true });

  // The features page imports these through astro:assets, which needs them in
  // src/. Copied rather than symlinked so a checkout without the site build
  // still has both, and so Astro's content hashing sees real files.
  fs.mkdirSync(IMAGES, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith('.png')) fs.copyFileSync(path.join(OUT, f), path.join(IMAGES, f));
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'captions.json'), 'utf8'));
  const bad = manifest.filter((s) => s.error);
  console.log(`\n[shots] ${manifest.length - bad.length}/${manifest.length} captured into web/public/screenshots`);
  for (const s of bad) console.error(`[shots] FAILED ${s.name}: ${s.error}`);

  // The metainfo screenshot list is generated from captions.json, so a new
  // capture has to be reflected there before it reaches a software centre.
  console.log('[shots] run `npm run metainfo` to refresh the AppStream list');
  process.exit(bad.length ? 1 : 0);
}

main();
