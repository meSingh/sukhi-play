#!/usr/bin/env node
'use strict';

/**
 * Records the demo shown on the website and in the README.
 *
 * It drives the real app in a throwaway profile seeded with a one minute
 * session, so the clock running out on camera is the clock actually running
 * out. Frames come back as PNGs and are assembled into an animation by
 * scripts/frames-to-anim.py, which needs Python with Pillow.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { seedProfile, electronBin, ROOT } = require('./seed-profile');

const OUT = path.join(ROOT, 'docs', 'assets');
const SEED_IDS = ['poki', 'pbskids', 'scratch', 'toytheater', 'natgeokids', 'blockly'];

function main () {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-demo-frames-'));
  // One minute, so the recording waits about a minute rather than an hour.
  const seeded = seedProfile({
    prefix: 'sukhi-demo-',
    ids: SEED_IDS,
    // A window of a known size, not the whole screen: every frame has to be
    // the same shape or the animation cannot be assembled.
    settings: { sessionMinutes: 1, kiosk: false, fullscreenOnLaunch: false }
  });
  console.log(`[demo] seeded ${seeded.count} apps, session limit 1 minute`);

  const res = spawnSync(electronBin(), [
    '.', `--demo=${frames}`, `--user-data-dir=${seeded.dir}`
  ], { cwd: ROOT, encoding: 'utf8', timeout: 5 * 60 * 1000 });

  for (const line of (res.stdout || '').split('\n')) {
    if (line.startsWith('[DEMO]')) console.log('  ' + line.replace('[DEMO] ', ''));
  }
  if (res.status !== 0) {
    console.error((res.stderr || '').trim().split('\n').slice(-10).join('\n'));
    throw new Error(`recording failed with exit code ${res.status}`);
  }

  const count = fs.readdirSync(frames).filter((f) => f.endsWith('.png')).length;
  if (count < 60) throw new Error(`only ${count} frames were captured; something stopped early`);

  fs.mkdirSync(OUT, { recursive: true });
  const build = spawnSync('python3', [
    path.join(__dirname, 'frames-to-anim.py'), frames, OUT
  ], { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('[demo] frames are still in ' + frames);
    throw new Error('could not build the animation; is Pillow installed for python3?');
  }

  fs.rmSync(frames, { recursive: true, force: true });
  fs.rmSync(seeded.dir, { recursive: true, force: true });
  console.log('[demo] done');
}

main();
