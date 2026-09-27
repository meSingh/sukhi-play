#!/usr/bin/env node
/**
 * Fails when a page on the built site ships a picture that is too heavy.
 *
 *   node web/scripts/check-images.mjs          reads docs/, the built site
 *   node web/scripts/check-images.mjs DIR      reads another built copy
 *
 * Reads every page in docs/ (not the playground apps, which are their own
 * projects) and checks the pictures it points at:
 *
 *   - a PNG, JPEG or GIF in an <img> has a WebP <source> beside it, so no
 *     browser that can show WebP downloads the heavy original;
 *   - every file a browser might pick (src, each srcset candidate, a video's
 *     poster and sources) is under its budget;
 *   - every <img> has a width and height, so the page does not jump as
 *     pictures arrive.
 *
 * It needs nothing but Node and runs in a second, so it goes first in CI and
 * is worth running before a commit. Lighthouse (lighthouserc.js) measures
 * the pages as a phone would see them; this is the part that should never be
 * noisy.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const BUDGET = { image: 250 * 1024, video: 1024 * 1024 };

function* pages (dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // The apps under /playground/<app>/ are built and checked on their own.
      if (relative(ROOT, p).split('/').length === 2 && relative(ROOT, p).startsWith('playground')) continue;
      yield* pages(p);
    } else if (name.endsWith('.html')) yield p;
  }
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const local = (url) => url && url.startsWith('/') && !url.startsWith('//');
const candidates = (srcset) => (srcset ?? '').split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);

const problems = [];
const seen = new Map();

function weigh (page, url, kind) {
  if (!local(url)) return;
  const file = join(ROOT, decodeURI(url.split(/[?#]/)[0]));
  if (!existsSync(file)) { problems.push(`${page}: ${url} is missing`); return; }
  const size = statSync(file).size;
  seen.set(url, size);
  if (size > BUDGET[kind]) problems.push(`${page}: ${url} is ${Math.round(size / 1024)} KB, over the ${BUDGET[kind] / 1024} KB budget for an ${kind}`);
}

for (const file of pages(ROOT)) {
  const page = '/' + relative(ROOT, file).replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  if (/http-equiv="refresh"/.test(html)) continue;

  const pictures = [...html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)];
  const inPicture = (i) => pictures.some((m) => i > m.index && i < m.index + m[0].length);

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = attr(tag, 'src');
    if (!local(src)) continue;
    if (!attr(tag, 'width') || !attr(tag, 'height')) problems.push(`${page}: <img src="${src}"> has no width and height`);
    const heavy = /\.(png|jpe?g|gif)$/i.test(src);
    if (heavy && !inPicture(m.index)) {
      problems.push(`${page}: ${src} is served as ${src.split('.').pop().toUpperCase()} with no WebP copy (use components/Img.astro)`);
      weigh(page, src, 'image');
    }
    if (!heavy) weigh(page, src, 'image');
    for (const c of candidates(attr(tag, 'srcset'))) weigh(page, c, 'image');
  }
  for (const m of html.matchAll(/<source\b[^>]*>/g)) {
    for (const c of candidates(attr(m[0], 'srcset'))) weigh(page, c, 'image');
    const src = attr(m[0], 'src');
    if (src) weigh(page, src, 'video');
  }
  for (const m of html.matchAll(/<video\b[^>]*>/g)) weigh(page, attr(m[0], 'poster'), 'image');
}

const total = [...seen.values()].reduce((a, b) => a + b, 0);
console.log(`Checked ${seen.size} pictures and videos across the site (${Math.round(total / 1024)} KB in all).`);
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log('Every picture has a WebP copy, a size, and fits its budget.');
