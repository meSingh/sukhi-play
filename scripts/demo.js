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
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { seedProfile, electronBin, ROOT } = require('./seed-profile');

const OUT = path.join(ROOT, 'docs', 'assets');
const SEED_IDS = ['poki', 'pbskids', 'scratch', 'toytheater', 'natgeokids', 'blockly'];

/**
 * Serves the little page the recording plays on.
 *
 * A recording has to show a child actually playing, and using somebody else's
 * website to advertise this one would be taking a liberty with their brand.
 * So the demo opens a page of ours, served from 127.0.0.1 for the length of
 * the recording, through the app's ordinary site machinery: allowlist, ad
 * filtering, bar and all.
 */
function serveDemoSite () {
  const file = fs.readFileSync(path.join(__dirname, 'demo-site', 'index.html'));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(file);
  });
  // listen() is asynchronous: the port does not exist until it is listening.
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main () {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'sukhi-demo-frames-'));
  const server = await serveDemoSite();
  const port = server.address().port;
  const seeded = seedProfile({
    prefix: 'sukhi-demo-',
    ids: SEED_IDS,
    extraApps: [{
      id: 'shapes',
      title: 'Shapes',
      url: `http://127.0.0.1:${port}/`,
      shape: 'ball',
      color: '#3B6BFF',
      enabled: true,
      allowHosts: ['127.0.0.1'],
      denyHosts: [],
      blockAds: true
    }],
    // Two minutes, so the one minute warning lands while a child is playing
    // rather than before the recording starts. A window of a known size, not
    // the whole screen: every frame has to be the same shape.
    settings: { sessionMinutes: 2, kiosk: false, fullscreenOnLaunch: false }
  });
  console.log(`[demo] seeded ${seeded.count} apps, session limit 2 minutes`);

  // spawn, not spawnSync: the demo page is served from this process, and a
  // synchronous wait here would block the server the app is trying to load.
  const res = await new Promise((resolve, reject) => {
    const child = spawn(electronBin(), [
      '.', `--demo=${frames}`, `--user-data-dir=${seeded.dir}`
    ], { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const cap = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('error', reject);
    child.on('close', (status) => {
      clearTimeout(cap);
      resolve({ status, stdout, stderr });
    });
  });
  server.close();

  for (const line of (res.stdout || '').split('\n')) {
    if (line.startsWith('[DEMO]')) console.log('  ' + line.replace('[DEMO] ', ''));
  }
  for (const line of (res.stdout || '').split('\n')) {
    if (line.startsWith('[game]') || line.startsWith('[policy]')) console.log('  ' + line);
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

main().catch((err) => {
  console.error(`[demo] ${err.message}`);
  process.exit(1);
});
