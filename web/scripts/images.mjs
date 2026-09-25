#!/usr/bin/env node
/**
 * Makes the WebP copies the pages use, at each width a screen might want.
 *
 * Runs before every build and every dev server (npm's prebuild and predev),
 * and skips any copy already newer than its original, so after the first run
 * it takes a moment. A new picture dropped into public/assets or
 * public/screenshots is picked up with nothing to configure; use it on a page
 * through components/Img.astro.
 *
 * Also writes the small PNG icons the head links to, so a browser asking for
 * the favicon does not fetch the 1024px original.
 */
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { FOLDERS, copyPath, widthsFor } from '../src/images.mjs';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function* pictures (dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* pictures(p);
    // The GIF is the README's copy of the demo; the site uses the WebP.
    else if (/\.(png|jpe?g|webp)$/i.test(name)) yield p;
  }
}

const fresh = (out, src) => existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs;

let made = 0;
let kept = 0;
async function write (src, out, make) {
  if (fresh(out, src)) { kept++; return; }
  mkdirSync(dirname(out), { recursive: true });
  await make().toFile(out);
  made++;
}

for (const folder of FOLDERS) {
  for (const file of pictures(join(PUBLIC, folder))) {
    const src = '/' + relative(PUBLIC, file).split('\\').join('/');
    const meta = await sharp(file, { animated: true }).metadata();
    // An animation is served as video (see scripts/frames-to-anim.py), not as
    // resized copies of itself.
    if ((meta.pages ?? 1) > 1) continue;
    for (const w of widthsFor(meta.width)) {
      await write(file, join(PUBLIC, copyPath(src, w)), () =>
        sharp(file)
          .resize({ width: w, withoutEnlargement: true })
          // Screenshots are mostly flat colour and text: 82 keeps the text crisp.
          .webp({ quality: 82, effort: 5, smartSubsample: true }));
    }
  }
}

const ICON = join(PUBLIC, 'assets', 'sukhi-icon.png');
for (const [name, size] of [['favicon-64.png', 64], ['apple-touch-icon.png', 180]]) {
  await write(ICON, join(PUBLIC, 'img', name), () =>
    sharp(ICON).resize(size, size).png({ compressionLevel: 9, palette: true, quality: 90 }));
}

console.log(`Pictures: ${made} made, ${kept} already up to date.`);
