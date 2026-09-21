#!/usr/bin/env node
'use strict';

/**
 * Writes the site header into every page.
 *
 * There are eight pages and one navigation. Keeping it in eight places meant
 * that adding a link was eight edits and forgetting one was invisible until
 * somebody clicked it, so the header lives here and the pages get a copy.
 *
 *   npm run nav
 *
 * Everything between the markers is replaced. Nothing outside them is touched.
 */

const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'docs');
const REPO = 'https://github.com/meSingh/sukhi-play';

const START = '<!-- nav:start -->';
const END = '<!-- nav:end -->';

// The plain links, in the order a parent needs them: what it is, what it can
// open, where to get it.
const LINKS = [
  { href: 'index.html', label: 'Overview' },
  { href: 'features.html', label: 'Features' },
  { href: 'catalogue.html', label: 'Catalogue' }
];

// Download is a button rather than a link, because it is the thing every page
// is ultimately for. The platforms hang underneath it: they were four more
// items in a row competing with everything else, and a parent who does not
// know whether they want the Intel or the Apple Silicon build is not helped
// by being shown both before they have asked.
const DOWNLOADS = [
  { href: 'download.html', label: 'All downloads', note: 'Every build, with checksums' },
  { href: 'macos.html', label: 'macOS', note: 'Apple Silicon, Intel, older Macs' },
  { href: 'windows.html', label: 'Windows', note: 'Installer or portable' },
  { href: 'linux.html', label: 'Linux', note: 'AppImage, deb, Snap' }
];

const GITHUB_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function header (page) {
  const current = (href) => (href === page ? ' aria-current="page"' : '');
  const inDownloads = DOWNLOADS.some((d) => d.href === page);

  const links = LINKS
    .map((l) => `    <a href="${l.href}"${current(l.href)}>${esc(l.label)}</a>`)
    .join('\n');

  const items = DOWNLOADS.map((d) => `        <a href="${d.href}"${current(d.href)}>
          <b>${esc(d.label)}</b><small>${esc(d.note)}</small>
        </a>`).join('\n');

  return `${START}
<header class="top">
  <a class="brand" href="index.html"><img src="assets/sukhi-icon.png" alt="">Sukhi Play</a>
  <button class="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
    <span></span><span></span><span></span>
  </button>
  <nav id="site-nav" tabindex="-1">
    <div class="nav-head"><img src="assets/sukhi-icon.png" alt="">Sukhi Play
      <button class="menu-close" type="button" aria-label="Close menu">&times;</button></div>
${links}
    <a class="nav-gh" href="${REPO}">${GITHUB_ICON}<span>GitHub</span></a>

    <!-- The download button, and the platforms under it. Without JavaScript
         the panel is simply always open, so every link still works. -->
    <div class="nav-dl${inDownloads ? ' is-current' : ''}">
      <button class="nav-cta" type="button" id="nav-dl-btn"
              aria-expanded="false" aria-controls="nav-dl-menu">
        <span>Download</span>
        <span class="nav-cta-sub">Free, no account</span>
        <svg class="nav-caret" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="nav-dl-menu" id="nav-dl-menu">
${items}
      </div>
    </div>
  </nav>
  <div class="nav-scrim" hidden></div>
</header>
<script>
(function () {
  var root = document.documentElement;

  // The slide-in menu. This used to live in each page's own script, which
  // meant a new page silently shipped a hamburger button that did nothing.
  // It belongs with the markup it drives. Opening is idempotent, so the older
  // pages binding it a second time is harmless.
  var menuBtn = document.querySelector('.menu-btn');
  var scrim = document.querySelector('.nav-scrim');
  var closeBtn = document.querySelector('.menu-close');
  if (menuBtn && scrim && closeBtn) {
    var setMenu = function (on) {
      root.classList.toggle('nav-open', on);
      menuBtn.setAttribute('aria-expanded', String(on));
      scrim.hidden = !on;
      if (on) document.getElementById('site-nav').focus({ preventScroll: true });
    };
    menuBtn.addEventListener('click', function () { setMenu(true); });
    closeBtn.addEventListener('click', function () { setMenu(false); menuBtn.focus(); });
    scrim.addEventListener('click', function () { setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('nav-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 621px)').addEventListener('change', function (m) {
      if (m.matches) setMenu(false);
    });
  }

  // The platform menu. Kept beside the markup it drives rather than in each
  // page's own script, so there is one copy of both.
  var wrap = document.querySelector('.nav-dl');
  var btn = document.getElementById('nav-dl-btn');
  if (!wrap || !btn) return;
  root.classList.add('has-nav-dl');

  var open = function (on) {
    wrap.classList.toggle('is-open', on);
    btn.setAttribute('aria-expanded', String(on));
  };
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    open(!wrap.classList.contains('is-open'));
  });
  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) open(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrap.classList.contains('is-open')) { open(false); btn.focus(); }
  });
})();
</script>
${END}`;
}

function main () {
  const pages = fs.readdirSync(DOCS).filter((f) => f.endsWith('.html'));
  let written = 0;

  for (const page of pages) {
    const file = path.join(DOCS, page);
    const text = fs.readFileSync(file, 'utf8');

    const from = text.indexOf(START);
    const to = text.indexOf(END);
    if (from === -1 || to === -1) {
      console.warn(`[nav] ${page} has no nav markers; skipped`);
      continue;
    }

    const next = text.slice(0, from) + header(page) + text.slice(to + END.length);
    if (next !== text) {
      fs.writeFileSync(file, next);
      written += 1;
    }
  }
  console.log(`[nav] ${written} of ${pages.length} page(s) updated`);
}

// build-catalogue.js generates its whole page, so it asks for the header
// rather than carrying a second copy of it.
module.exports = { header, START, END };

if (require.main === module) main();
