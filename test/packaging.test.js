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

test('the snap declares the metadata a store listing shows', () => {
  // A bare listing was the original complaint. These travel inside the snap;
  // licence, links, icon and screenshots cannot and are set on the store page.
  for (const field of ['title', 'summary', 'description', 'category']) {
    assert.ok(builder.snap[field], `snap.${field} is not set, so the listing will be bare`);
  }
  assert.ok(builder.snap.summary.length <= 78,
    `snap.summary is ${builder.snap.summary.length} chars; the store limit is 78`);
  assert.equal(builder.snap.confinement, 'strict',
    'strict confinement is what makes the store report restricted permissions');
});
