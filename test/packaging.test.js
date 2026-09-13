'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const builder = yaml.load(fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8'));
const release = yaml.load(fs.readFileSync(
  path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8'));

test('electron-builder.yml validates against electron-builder\'s own schema', () => {
  // An unrecognised key does not warn, it invalidates the block it sits in.
  // A stray `desktopName` under linux: once silently broke the build for all
  // three platforms, and `snapcraft:` without its required `base` made the
  // whole config invalid. Both were found by a failing build rather than here.
  const Ajv = require('ajv');
  const schema = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'node_modules', 'app-builder-lib', 'scheme.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

  if (!validate(builder)) {
    const detail = validate.errors
      .map((e) => `${e.instancePath || '(root)'} ${e.keyword} ${JSON.stringify(e.params)}`)
      .join('\n    ');
    assert.fail(`electron-builder.yml does not match the schema:\n    ${detail}`);
  }
});

test('every dist script CI runs refuses to publish', () => {
  // electron-builder's default publish policy is onTagOrDraft. On a tag it
  // inferred a Snap Store publish from the snap target and tried to upload
  // from inside the build job, where no store credential exists, which failed
  // the whole Linux build and so the release. Building and publishing are
  // separate jobs here and electron-builder only builds.
  for (const name of ['dist:mac', 'dist:win', 'dist:linux', 'dist:linux:all', 'dist:snap']) {
    const script = pkg.scripts[name];
    assert.ok(script, `package.json has no ${name} script`);
    assert.match(script, /--publish never/,
      `${name} must pass --publish never, or a tagged build will try to publish itself`);
  }
});

test('the snap is built by the same script whose artifacts are collected', () => {
  const linux = release.jobs.build.strategy.matrix.include.find((m) => m.name === 'Linux');
  assert.ok(linux, 'no Linux leg in the release matrix');
  assert.ok(pkg.scripts[linux.script], `matrix runs ${linux.script}, which does not exist`);
  assert.match(pkg.scripts[linux.script], /\bsnap\b/,
    'the Linux leg collects dist/*.snap, so its script has to build one');
  assert.match(linux.artifacts, /\*\.snap/,
    'the Linux leg builds a snap, so it has to be uploaded as an artifact');
});

test('the store upload is guarded and cannot fail a credential-less run', () => {
  // Without the guard a fork, or a run before the secret is added, fails the
  // release after every platform has already built successfully.
  const job = release.jobs.release;
  assert.ok(job.env && job.env.SNAPCRAFT_STORE_CREDENTIALS,
    'the credential must be job-level env; a step env is not visible to its own if');

  const step = job.steps.find((s) => /Snap Store/.test(s.name || ''));
  assert.ok(step, 'no Snap Store publish step in the release job');
  assert.match(step.if, /SNAPCRAFT_STORE_CREDENTIALS != ''/,
    'the publish step must skip when no credential is configured');
  assert.ok(!step.env, 'the credential is job-level; a step-level copy shadows the guard');
});

test('snapcraft is available in the job that builds the snap', () => {
  // electron-builder shells out to snapcraft while building, not only while
  // publishing. Without it the Linux build dies with spawn snapcraft ENOENT.
  const step = release.jobs.build.steps.find((s) => /Linux packaging tools/.test(s.name || ''));
  assert.ok(step, 'no Linux packaging tools step');
  assert.match(step.run, /snap install snapcraft/,
    'the build job installs snapcraft, because electron-builder invokes it to pack');
});

test('the snap declares the metadata a fresh store listing would use', () => {
  // A bare listing was the original complaint. These are carried by the snap,
  // but the store only adopts them until the listing is edited by hand, and
  // this one has been, so they matter for a fresh listing rather than for the
  // current one. Licence, links, icon and screenshots are never carried by the
  // snap and are set on the store page.
  // Reads the snap: block. It is deprecated, and staying: snapcraft.core24
  // builds in a container that cannot be made to work on a GitHub runner.
  // electron-builder.yml explains why. Whichever block is in use, these
  // fields have to be in it.
  const snap = builder.snap || (builder.snapcraft && builder.snapcraft.core24);
  assert.ok(snap, 'no snap or snapcraft.core24 block in electron-builder.yml');

  for (const field of ['title', 'summary', 'description', 'category']) {
    assert.ok(snap[field], `snapcraft.core24.${field} is not set, so a fresh listing is bare`);
  }
  assert.ok(snap.summary.length <= 78,
    `summary is ${snap.summary.length} chars; the store limit is 78`);
  assert.equal(snap.confinement, 'strict',
    'strict confinement is what makes the store report restricted permissions');
});

test('the Catalina build pins an Electron that can actually run on 10.15', () => {
  // Electron sets the minimum macOS version, not this project. Measured by
  // building each and reading LSMinimumSystemVersion out of the bundle:
  // 30, 31 and 32 give 10.15; 33 and 37 give 11.0; 44 gives 13.0. BaseWindow
  // and WebContentsView, which this app is built on, arrived in Electron 30.
  // So 30 to 32 is the only window, and pinning outside it silently ships a
  // build that Catalina refuses to open, which is the bug this exists to fix.
  const legacy = yaml.load(fs.readFileSync(
    path.join(ROOT, 'electron-builder.catalina.yml'), 'utf8'));

  const pinned = String(legacy.electronVersion || '');
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'electronVersion must be pinned exactly');

  const major = Number(pinned.split('.')[0]);
  assert.ok(major >= 30, `Electron ${major} predates BaseWindow, added in 30`);
  assert.ok(major <= 32, `Electron ${major} requires macOS 11 or later, so not Catalina`);

  assert.ok(!legacy.extends,
    'extending the main config merged its target list instead of replacing it');
  assert.equal(legacy.mac.artifactName, 'Sukhi-Play-macOS-Intel-Catalina.dmg');
  assert.deepEqual(legacy.mac.target[0].arch, ['x64'], 'Catalina Macs are Intel');
});

test('the release collects the Catalina build', () => {
  const mac = release.jobs.build.strategy.matrix.include.find((m) => m.name === 'macOS');
  assert.match(pkg.scripts[mac.script], /dist:mac:catalina/,
    'the macOS leg has to build the Catalina dmg, not just the normal one');
  assert.match(mac.artifacts, /dist-catalina/,
    'the Catalina dmg has to be uploaded as an artifact or it never reaches the release');
});
