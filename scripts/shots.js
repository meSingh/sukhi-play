#!/usr/bin/env node
'use strict';

/**
 * Regenerates docs/screenshots from the real application.
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

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const SEED_IDS = ['poki', 'pbskids', 'scratch', 'toytheater', 'natgeokids', 'blockly'];

function electronBin () {
  const local = path.join(ROOT, 'node_modules', '.bin', 'electron');
  if (fs.existsSync(local)) return local;
  throw new Error('electron is not installed. Run `npm install` first.');
}

function seededProfile () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-shot-seeded-'));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8'));
  const all = Array.isArray(raw) ? raw : raw.sites || raw.suggestions || [];

  const apps = [];
  for (const id of SEED_IDS) {
    const s = all.find((x) => x.id === id);
    if (!s) {
      console.warn(`[shots] suggestion "${id}" is gone from config/suggestions.json, skipping`);
      continue;
    }
    apps.push({
      id: s.id,
      title: s.title,
      url: s.url,
      shape: s.shape,
      color: s.color,
      enabled: true,
      allowHosts: s.allowHosts,
      denyHosts: s.denyHosts || [],
      blockAds: s.blockAds !== false
    });
  }
  if (!apps.length) throw new Error('could not seed any apps from config/suggestions.json');

  // The catalog reader expects { apps: [...] }; a bare array parses to nothing
  // and produces screenshots of an empty screen.
  fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify({ apps }, null, 2));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
    kiosk: true, alwaysOnTop: false, refocusOnBlur: false, onboarded: true
  }, null, 2));
  return { dir, count: apps.length };
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

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'captions.json'), 'utf8'));
  const bad = manifest.filter((s) => s.error);
  console.log(`\n[shots] ${manifest.length - bad.length}/${manifest.length} captured into docs/screenshots`);
  for (const s of bad) console.error(`[shots] FAILED ${s.name}: ${s.error}`);

  // The metainfo screenshot list is generated from captions.json, so a new
  // capture has to be reflected there before it reaches a software centre.
  console.log('[shots] run `npm run metainfo` to refresh the AppStream list');
  process.exit(bad.length ? 1 : 0);
}

main();
