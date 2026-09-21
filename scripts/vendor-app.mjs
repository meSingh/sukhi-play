#!/usr/bin/env node
/**
 * Rebuilds one bundled app from its upstream source.
 *
 * The built files are committed rather than fetched at release time, because a
 * release must not depend on GitHub being up or on npm resolving the same tree
 * twice. This script is how those files are reproduced, and the patch beside
 * them is the record of everything we changed and why.
 *
 *   node scripts/vendor-app.mjs kids-coloring
 *   node scripts/vendor-app.mjs --all
 *
 * Each app has a folder under vendor/ holding:
 *   UPSTREAM   the repository and the exact commit
 *   patch.mjs  optional, our changes, applied to a fresh checkout
 *   build.json how to turn the checkout into servable files
 *   LICENSE    upstream's, copied out of the checkout
 *   app/       the result, which is what ships
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'vendor');

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function readUpstream (dir) {
  const text = fs.readFileSync(path.join(dir, 'UPSTREAM'), 'utf8');
  const get = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  const repo = get('repo');
  const commit = get('commit');
  if (!repo || !commit) throw new Error(`${dir}/UPSTREAM needs a repo and a commit`);
  return { repo, commit };
}

/**
 * Copies a checkout into app/, keeping only what a browser needs.
 *
 * An allowlist rather than a denylist: shipping somebody's whole repository
 * would put their CI config, tests and lockfiles inside a children's app, and
 * the first time that mattered we would not find out from a test.
 */
// Files every repository has and no browser needs. Shipping a lockfile or a
// linter config inside a children's app is harmless until the day it is not.
const NEVER = [
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'tsconfig.json', 'biome.json', 'eslint.config.js', '.eslintrc.json',
  'playwright.config.mjs', 'playwright.config.js', 'vite.config.ts',
  'vercel.json', 'CLAUDE.md', 'sw.js'
];

function copyTree (from, to, keep, skip) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const name = entry.name;
    if (skip.includes(name) || NEVER.includes(name) || name.startsWith('.')) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (entry.isDirectory()) {
      copyTree(src, dst, keep, skip);
      if (fs.readdirSync(dst).length === 0) fs.rmdirSync(dst);
    } else if (keep.includes(path.extname(name).toLowerCase())) {
      fs.copyFileSync(src, dst);
    }
  }
}

function vendor (name) {
  const dir = path.join(VENDOR, name);
  const { repo, commit } = readUpstream(dir);
  const recipe = JSON.parse(fs.readFileSync(path.join(dir, 'build.json'), 'utf8'));

  const work = fs.mkdtempSync(path.join(os.tmpdir(), `vendor-${name}-`));
  try {
    console.log(`${name}: cloning ${repo}`);
    run('git', ['clone', '--quiet', repo, work]);
    run('git', ['checkout', '--quiet', commit], work);

    const patch = path.join(dir, 'patch.mjs');
    if (fs.existsSync(patch)) {
      console.log(`${name}: patching`);
      process.stdout.write(run('node', [patch, work]));
    }

    let source = work;
    if (recipe.install) {
      console.log(`${name}: installing`);
      run('npm', ['ci', '--silent'], work);
    }
    if (recipe.build) {
      console.log(`${name}: building`);
      run('npm', ['run', recipe.build], work);
      source = path.join(work, recipe.out || 'dist');
    } else if (recipe.out) {
      source = path.join(work, recipe.out);
    }

    const app = path.join(dir, 'app');
    fs.rmSync(app, { recursive: true, force: true });
    copyTree(source, app,
      recipe.keep || ['.html', '.js', '.mjs', '.css', '.json', '.svg', '.png',
                      '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2',
                      '.ttf', '.mp3', '.ogg', '.wav', '.webmanifest'],
      recipe.skip || []);

    const licence = recipe.licence || 'LICENSE';
    fs.copyFileSync(path.join(work, licence), path.join(dir, 'LICENSE'));

    const size = run('du', ['-sh', app]).split(/\s/)[0];
    console.log(`${name}: ${size} in vendor/${name}/app`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const names = args.includes('--all')
  ? fs.readdirSync(VENDOR).filter((n) => fs.existsSync(path.join(VENDOR, n, 'UPSTREAM')))
  : args;

if (names.length === 0) {
  console.error('usage: vendor-app.mjs <name>... | --all');
  process.exit(1);
}
for (const name of names) vendor(name);
