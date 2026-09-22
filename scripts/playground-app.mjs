#!/usr/bin/env node
/**
 * Builds one of our own apps out of playground/ and puts the result where the
 * rest of the project expects to find it.
 *
 *   node scripts/playground-app.mjs colouring
 *   node scripts/playground-app.mjs --all
 *
 * Two destinations, from one build:
 *
 *   apps/<name>/app/              what ships inside the download. Committed,
 *                                 for the same reason vendor/*\/app is: a
 *                                 release must not depend on npm resolving the
 *                                 same tree twice, or on a machine that has
 *                                 the playground checked out at all.
 *   web/public/playground/<name>/ what the website serves at
 *                                 sukhiplay.com/playground/<name>/. Not
 *                                 committed -- the site build regenerates it,
 *                                 and docs/ is where the published copy lives.
 *
 * The sources under playground/ are separate repositories and the parent
 * ignores them, so this reads a working copy that may not be there. When it is
 * not, and apps/<name>/app already is, that is fine and this says so: the
 * committed build is the one that ships, and somebody without the playground
 * checked out can still build a release.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'playground');
const SHIPPED = path.join(ROOT, 'apps');
const SERVED = path.join(ROOT, 'web', 'public', 'playground');

/** Everything under playground/ that looks like an app we can build. */
function known () {
  if (!fs.existsSync(SOURCES)) return [];
  return fs.readdirSync(SOURCES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SOURCES, e.name, 'package.json')))
    .map((e) => e.name);
}

function copyTree (from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function count (dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size;
  }
  return { files, bytes };
}

function build (name) {
  const source = path.join(SOURCES, name);
  const shipped = path.join(SHIPPED, name, 'app');

  if (!fs.existsSync(source)) {
    if (fs.existsSync(shipped)) {
      console.log(`${name}: no working copy under playground/; keeping the committed build`);
      // Still needs to reach the website, which does not commit its copy.
      copyTree(shipped, path.join(SERVED, name));
      return;
    }
    throw new Error(
      `playground/${name} is not here and apps/${name}/app is not either. ` +
      'Nothing to build and nothing to ship.'
    );
  }

  if (!fs.existsSync(path.join(source, 'node_modules'))) {
    console.log(`${name}: installing dependencies`);
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: source, stdio: 'inherit' });
  }

  console.log(`${name}: building`);
  execFileSync('npm', ['run', 'build'], { cwd: source, stdio: 'inherit' });

  const dist = path.join(source, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`${name}: the build produced no dist/index.html`);
  }

  copyTree(dist, shipped);
  copyTree(dist, path.join(SERVED, name));

  // The licence travels with what ships, next to app/, where the packager and
  // the tests expect it. Copied rather than written here, so it can never say
  // something different from the one in the app's own repository.
  const licence = path.join(source, 'LICENSE');
  if (fs.existsSync(licence)) fs.copyFileSync(licence, path.join(SHIPPED, name, 'LICENSE'));

  const { files, bytes } = count(shipped);
  console.log(`${name}: ${files} files, ${(bytes / 1024).toFixed(0)} kB`);
  console.log(`  ships from   apps/${name}/app/`);
  console.log(`  served from  web/public/playground/${name}/`);
}

const args = process.argv.slice(2);
const wanted = args.includes('--all') ? known() : args.filter((a) => !a.startsWith('-'));

if (!wanted.length) {
  console.error('Which app? Try --all, or one of: ' + (known().join(', ') || '(none)'));
  process.exit(1);
}
for (const name of wanted) build(name);
