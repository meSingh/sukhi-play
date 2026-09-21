#!/usr/bin/env node
'use strict';

/**
 * Writes docs/catalogue.html from config/suggestions.json.
 *
 * The page and the app read the same file, so the catalogue a parent sees on
 * the website is the catalogue the app ships. Kept generated rather than
 * hand-written for that reason alone: two copies of a list drift, and the one
 * that drifts is always the one somebody is reading.
 *
 * What the page deliberately does not do: no third-party logos or favicons, no
 * "recommended" or "safe", no analytics, no embeds, and no fonts or images from
 * anywhere else. It is a compatibility list, which is what the data actually
 * is: the hosts each site needs before it will work.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'catalogue.html');
const REPO = 'https://github.com/meSingh/sukhi-play';

const SHAPES = {
  star: '<path d="M50 8 62 38 94 41 70 62 77 93 50 76 23 93 30 62 6 41 38 38Z"/>',
  rocket: '<path d="M50 6c12 12 18 26 18 40v14H32V46c0-14 6-28 18-40Z"/><path d="M32 52 16 70l12-2 4 10Z"/><path d="M68 52l16 18-12-2-4 10Z"/><circle cx="50" cy="40" r="7" fill="#fff" fill-opacity=".55"/>',
  ball: '<circle cx="50" cy="50" r="40"/><path d="M22 34c18 10 38 10 56 0M22 66c18-10 38-10 56 0M50 10v80" stroke="#fff" stroke-opacity=".5" stroke-width="5" fill="none"/>',
  blocks: '<rect x="14" y="52" width="32" height="32" rx="6"/><rect x="54" y="52" width="32" height="32" rx="6"/><rect x="34" y="16" width="32" height="32" rx="6"/>',
  note: '<circle cx="34" cy="72" r="16"/><rect x="44" y="14" width="8" height="58" rx="4"/><path d="M52 14c14 4 24 10 26 22-6-8-14-12-26-14Z"/>',
  leaf: '<path d="M78 16C40 16 20 36 20 64c0 8 2 14 4 20 6-24 22-40 46-48-18 12-30 28-34 48 30 4 46-22 42-68Z"/>',
  drop: '<path d="M50 8c16 22 28 36 28 50a28 28 0 1 1-56 0c0-14 12-28 28-50Z"/>',
  bolt: '<path d="M56 6 24 54h20l-8 40 34-50H50Z"/>',
  heart: '<path d="M50 86C20 62 12 47 22 34c10-13 24-8 28 4 4-12 18-17 28-4 10 13 2 28-28 52Z"/>',
  cloud: '<circle cx="36" cy="58" r="16"/><circle cx="53" cy="44" r="21"/><circle cx="70" cy="58" r="14"/><rect x="30" y="54" width="44" height="20" rx="10"/>',
  moon: '<path d="M64 14a36 36 0 1 0 20 56A30 30 0 0 1 64 14Z"/>',
  flower: '<circle cx="50" cy="28" r="14"/><circle cx="72" cy="44" r="14"/><circle cx="63" cy="70" r="14"/><circle cx="37" cy="70" r="14"/><circle cx="28" cy="44" r="14"/><circle cx="50" cy="50" r="12" fill="#fff" fill-opacity=".55"/>',
  fish: '<ellipse cx="45" cy="50" rx="29" ry="19"/><path d="M74 50 94 33v34Z"/><circle cx="33" cy="44" r="4.5" fill="#fff" fill-opacity=".85"/>',
  book: '<path d="M20 24h24a8 8 0 0 1 8 8v46a11 11 0 0 0-8-4H20Z"/><path d="M80 24H56a8 8 0 0 0-8 8v46a11 11 0 0 1 8-4h24Z" fill-opacity=".6"/>',
  paint: '<path d="M50 16c19 0 34 13 34 29 0 11-9 14-15 16-6 2-9 5-9 10 0 7-6 12-13 12-18 0-31-15-31-33S31 16 50 16Z"/><circle cx="37" cy="39" r="5.5" fill="#fff" fill-opacity=".8"/><circle cx="56" cy="34" r="5.5" fill="#fff" fill-opacity=".8"/><circle cx="67" cy="49" r="5.5" fill="#fff" fill-opacity=".8"/>',
  car: '<path d="M24 58h52l-6-16a11 11 0 0 0-10-7H40a11 11 0 0 0-10 7Z"/><rect x="16" y="56" width="68" height="16" rx="8"/><circle cx="33" cy="76" r="8"/><circle cx="67" cy="76" r="8"/>'
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function host (url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

function card (entry) {
  const art = SHAPES[entry.shape] || SHAPES.star;
  const hosts = (entry.allowHosts || []).map((h) => `<code>${esc(h)}</code>`).join(' ');
  const ads = entry.adSupported
    ? (entry.blockAds === false
      ? '<span class="tagline tagline--warn">Ad supported, filtering off in this profile</span>'
      : '<span class="tagline">Ad supported, filtering on</span>')
    : '<span class="tagline tagline--ok">No advertising</span>';
  const terms = entry.termsUrl
    ? `<a href="${esc(entry.termsUrl)}" rel="nofollow noopener">Their terms</a>`
    : '';

  return `        <article class="cat-card">
          <header>
            <span class="cat-art" style="--art:${esc(entry.color)}" aria-hidden="true">
              <svg viewBox="0 0 100 100">${art}</svg>
            </span>
            <span>
              <b>${esc(entry.title)}</b>
              <small>${esc(host(entry.url))}</small>
            </span>
          </header>
          <p>${esc(entry.notes)}</p>
          <div class="cat-meta">
            <span class="tagline tagline--cat">${esc(entry.category || 'Other')}</span>
            ${ads}
          </div>
          <details>
            <summary>What it needs to work</summary>
            <div class="cat-hosts">${hosts || '<code>none recorded</code>'}</div>
          </details>
          <div class="cat-links">
            <a href="${esc(entry.url)}" rel="nofollow noopener">Visit the site</a>
            ${terms}
          </div>
        </article>`;
}

function main () {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8'));
  const list = raw.suggestions || [];
  const cards = list.map(card).join('\n');
  const nav = [
    ['index.html', 'Overview'],
    ['catalogue.html', 'Catalogue'],
    ['download.html', 'Download'],
    ['macos.html', 'macOS'],
    ['windows.html', 'Windows'],
    ['linux.html', 'Linux']
  ].map(([href, label]) =>
    `    <a href="${href}"${href === 'catalogue.html' ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n');

  const html = `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Sukhi Play catalogue</title>
<meta name="description" content="Sites that are known to work in Sukhi Play, with the hosts each one needs. A compatibility list, not a recommendation.">
<link rel="icon" href="assets/sukhi-icon.png">
<link rel="stylesheet" href="site.css">
<script>document.documentElement.classList.remove('no-js')</script>
</head>
<body>
<header class="top">
  <a class="brand" href="index.html"><img src="assets/sukhi-icon.png" alt="">Sukhi Play</a>
  <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
    <span></span><span></span><span></span>
  </button>
  <nav id="site-nav" tabindex="-1">
    <div class="nav-head"><img src="assets/sukhi-icon.png" alt="">Sukhi Play
      <button class="menu-close" type="button" aria-label="Close menu">&times;</button></div>
${nav}
    <a class="nav-gh" href="${REPO}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span>GitHub</span></a>
    <a class="nav-cta" href="download.html">Download, free</a>
  </nav>
  <div class="nav-scrim" hidden></div>
</header>

<main class="wrap">
  <div class="hero hero--page">
    <h1>The catalogue</h1>
    <p class="lede">Sites that are known to work, with the hosts each one needs
      already worked out. The same list ships inside the app.</p>
  </div>

  <div class="card warn reveal">
    <p><b>This is a compatibility list, not a recommendation.</b> Sukhi Play is
      not connected to any of these sites, is not endorsed by them, and does not
      check what they show your child. Every one of them can change what it
      publishes tomorrow. Read each site's own terms and decide for yourself,
      the same way you would before handing over any screen.</p>
  </div>

  <div class="cat-grid reveal d1">
${cards}
  </div>

  <div class="block">
    <h2 class="reveal">What the hosts are for</h2>
    <p class="reveal">Sukhi Play blocks every request a site makes unless you
      allowed the host it goes to. That is what stops a game carrying your child
      somewhere else. Each entry above lists the hosts that site needs before it
      works, which is the tedious part of setting one up and the reason this
      list exists.</p>
    <p class="reveal">Anything not on this list can still be added: type the
      address in the app and it opens the site once, watches what it asks for,
      and fills the hosts in for you.</p>
  </div>

  <div class="block">
    <h2 class="reveal">If you run one of these sites</h2>
    <p class="reveal">Tell us and we will remove your entry. No argument, no
      conditions: <a href="${REPO}/issues">open an issue</a> or write to
      <a href="mailto:mesingh90@gmail.com">mesingh90@gmail.com</a>. The same
      goes for anything here you think is wrong.</p>
  </div>
</main>
`;

  const foot = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  const madeby = foot.slice(foot.indexOf('<section class="madeby">'));

  fs.writeFileSync(OUT, html + '\n' + madeby);
  console.log(`[catalogue] ${list.length} entries -> docs/catalogue.html`);
}

main();
