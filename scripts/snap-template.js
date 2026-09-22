#!/usr/bin/env node
'use strict';

/**
 * Unpacks the snap template that electron-builder leaves packed, so the snap
 * it builds can actually start.
 *
 * electron-builder builds a core20 snap from a prebuilt template published at
 * electron-userland/electron-builder-binaries. That template carries the three
 * launcher scripts the snap's command.sh execs -- desktop-init.sh,
 * desktop-common.sh, desktop-gnome-specific.sh -- along with gnome-platform/,
 * data-dir/ and the libraries Electron needs that core20 does not ship
 * (libnss3, libnspr4, libXss, libappindicator).
 *
 * The template is published as snap-template-electron-4.0-2-amd64.tar.7z, a
 * tar inside a 7z. app-builder-lib's extractArchive runs 7za and stops, which
 * unwraps the 7z and leaves the .tar sitting there. buildWithTemplate then
 * passes the top-level entries of that directory to mksquashfs, so the snap
 * gets a 4.8MB .tar at its root and none of the contents. command.sh exec's a
 * file that is not there, bash exits 127, and the app never starts:
 *
 *   /snap/sukhi-play/14/command.sh: line 2:
 *     /snap/sukhi-play/14/desktop-init.sh: No such file or directory
 *
 * The .tar.xz branch of the same function does the second step; the .7z branch
 * does not. Until that is fixed upstream, this runs first, downloads the
 * template through electron-builder's own code so the checksum and cache
 * bookkeeping stay its own, unpacks the tar in place, and rewrites the cache
 * state. The build that follows finds a cache it considers complete and packs
 * the real contents.
 *
 * Entries in the tar are ./-prefixed and the tar's root is the snap's root, so
 * nothing is stripped.
 */

const fs = require('node:fs');
const path = require('node:path');

// Mirrors SNAP_TEMPLATES in app-builder-lib/out/targets/snap/coreLegacy.js.
// Only amd64: arm64 does not use a template, and armhf is not built here.
const TEMPLATE = {
  releaseName: 'snap-template-4.0-2',
  filenameWithExt: 'snap-template-electron-4.0-2-amd64.tar.7z',
  checksums: {
    'snap-template-electron-4.0-2-amd64.tar.7z':
      '5e3ab4e09364ac06f0072b1c2dab9138318c933f6b2c7374f893b5ec44d19e6f'
  },
  githubOrgRepo: 'electron-userland/electron-builder-binaries'
};

// The files that prove the template was unpacked. command.sh exec's the first
// of these, so its absence is the whole bug.
const LAUNCHERS = ['desktop-init.sh', 'desktop-common.sh', 'desktop-gnome-specific.sh'];

async function main () {
  if (process.platform !== 'linux') {
    console.log('[snap-template] not Linux; a snap cannot be built here anyway');
    return;
  }

  // Reached through app-builder-lib so the download, the checksum and the
  // cache layout are whatever electron-builder itself would do.
  const { downloadBuilderToolset } = require('app-builder-lib/out/util/electronGet');
  const cacheState = require('app-builder-lib/out/util/cacheState');
  const tar = require('tar');

  const dir = await downloadBuilderToolset(TEMPLATE);
  console.log(`[snap-template] template cache: ${dir}`);

  const present = LAUNCHERS.filter((f) => fs.existsSync(path.join(dir, f)));
  if (present.length === LAUNCHERS.length) {
    console.log('[snap-template] already unpacked, nothing to do');
    return;
  }

  const tarball = fs.readdirSync(dir).find((f) => f.endsWith('.tar'));
  if (!tarball) {
    // Either upstream fixed the extraction and changed the layout, or the
    // download produced something unexpected. Either way, guessing would
    // produce another snap that does not start.
    throw new Error(
      `no .tar and no launcher scripts in ${dir}; ` +
      `found: ${fs.readdirSync(dir).join(', ') || '(nothing)'}`);
  }

  console.log(`[snap-template] unpacking ${tarball}`);
  await tar.extract({ file: path.join(dir, tarball), cwd: dir });
  fs.rmSync(path.join(dir, tarball));

  const missing = LAUNCHERS.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) {
    throw new Error(`the template unpacked without ${missing.join(', ')}`);
  }
  // The scripts are exec'd directly by command.sh.
  for (const f of LAUNCHERS) fs.chmodSync(path.join(dir, f), 0o755);

  // electron-builder trusts this file over the directory: a stale count makes
  // it throw the unpacked template away and re-extract the broken one.
  const meta = await cacheState.computeCacheMetadata(dir);
  await cacheState.writeCacheState(dir, cacheState.CacheState.complete, meta, true);

  console.log(`[snap-template] unpacked ${meta.fileCount} files; ` +
              `launchers: ${LAUNCHERS.join(', ')}`);
}

main().catch((err) => {
  console.error(`[snap-template] ${err.message}`);
  process.exit(1);
});
