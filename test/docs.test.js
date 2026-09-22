'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(SHOTS, 'captions.json'), 'utf8'));

/**
 * The site's real pages, as built.
 *
 * Clean URLs mean a page is <name>/index.html, and the <name>.html files beside
 * them are one-line redirects for the addresses the site used to have. Reading
 * those as pages finds no navigation and no catalogue.
 */
function builtPages () {
  const docs = path.join(__dirname, '..', 'docs');
  const out = [{ name: 'index.html', file: path.join(docs, 'index.html') }];
  for (const entry of fs.readdirSync(docs, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(docs, entry.name, 'index.html');
    if (fs.existsSync(file)) out.push({ name: `${entry.name}/index.html`, file });
  }
  return out;
}

test('every screenshot in the manifest exists and captured cleanly', () => {
  assert.ok(manifest.length, 'captions.json is empty; run npm run shots');
  for (const shot of manifest) {
    assert.ok(!shot.error, `${shot.name} failed to capture: ${shot.error}`);
    const file = path.join(SHOTS, `${shot.name}.png`);
    assert.ok(fs.existsSync(file), `${shot.name}.png is in the manifest but not on disk`);
    assert.ok(fs.statSync(file).size > 1024, `${shot.name}.png is suspiciously small`);
    assert.ok(shot.caption && shot.caption.length > 10, `${shot.name} has no usable caption`);
  }
});

test('screenshot dimensions are inside the AppStream range', () => {
  // Software centres reject anything outside this, silently, and the listing
  // then shows no screenshots at all.
  for (const shot of manifest) {
    const buf = fs.readFileSync(path.join(SHOTS, `${shot.name}.png`));
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.ok(width >= 624 && width <= 3840, `${shot.name} is ${width}px wide`);
    assert.ok(height >= 351 && height <= 2160, `${shot.name} is ${height}px tall`);
  }
});

test('every image the README points at is actually there', () => {
  // Moving a screenshot used to leave a broken image in the README, which only
  // shows up once it is rendered on GitHub.
  const refs = [
    ...readme.matchAll(/(?:src="|srcset="|\]\()(docs\/[^")\s]+\.(?:png|svg|md))/g)
  ].map((m) => m[1]);
  assert.ok(refs.length, 'the README references nothing under docs/');
  for (const ref of new Set(refs)) {
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `README points at missing ${ref}`);
  }
});

test('the macOS download button is ours, not Apple\'s', () => {
  // Sukhi Play is not distributed through the Mac App Store. Apple's "Download
  // on the Mac App Store" badge would say it is, and using their marks would
  // imply an endorsement that does not exist, so the button is a local SVG.
  for (const variant of ['light', 'dark']) {
    const file = path.join(ROOT, 'docs', `badge-macos-${variant}.svg`);
    assert.ok(fs.existsSync(file), `docs/badge-macos-${variant}.svg is missing`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /not (?:from )?the App Store/i,
      'the button has to say it is not an App Store download');
    assert.ok(!/app ?store\.com|apple\.com|<image|xlink:href/i.test(svg),
      'the button must not pull in Apple artwork');
  }
  assert.ok(!/(?:mac_?app_?store|Download_on_the)/i.test(readme),
    'the README must not use Apple official badge artwork');
});

test('the Windows button is ours, not Microsoft\'s', () => {
  // Sukhi Play is not in the Microsoft Store, so their "Get it from Microsoft"
  // badge would claim a listing that does not exist.
  for (const variant of ['light', 'dark']) {
    const file = path.join(ROOT, 'docs', `badge-windows-${variant}.svg`);
    assert.ok(fs.existsSync(file), `docs/badge-windows-${variant}.svg is missing`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.match(svg, /not the Microsoft Store/i,
      'the button has to say it is not a Microsoft Store download');
    assert.ok(!/microsoft\.com|<image|xlink:href/i.test(svg),
      'the button must not pull in Microsoft artwork');
  }
});

test('the macOS page offers both architectures by their permanent names', () => {
  // The release job aliases the two disk images to version-free names so these
  // links keep working. If the names drift apart the page 404s silently.
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'macos.md'), 'utf8');
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
  for (const name of ['Sukhi-Play-macOS-AppleSilicon.dmg', 'Sukhi-Play-macOS-Intel.dmg']) {
    assert.ok(page.includes(`releases/latest/download/${name}`),
      `docs/macos.md does not link ${name}`);
    assert.ok(workflow.includes(name),
      `the release job does not produce ${name}, so the link would 404`);
  }

  const win = fs.readFileSync(path.join(ROOT, 'docs', 'windows.md'), 'utf8');
  for (const name of ['Sukhi-Play-Windows-Setup.exe', 'Sukhi-Play-Windows-Portable.exe']) {
    assert.ok(win.includes(`releases/latest/download/${name}`),
      `docs/windows.md does not link ${name}`);
    assert.ok(workflow.includes(name),
      `the release job does not produce ${name}, so the link would 404`);
  }
});

test('the metainfo generator lists every captured screenshot', () => {
  // The list software centres read is generated from the manifest. If that
  // wiring breaks, the store listing loses its screenshots and nothing fails
  // loudly.
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-metainfo.js')], { cwd: ROOT });
  const xml = fs.readFileSync(
    path.join(ROOT, 'build', 'linux', 'com.msingh.sukhi.play.metainfo.xml'), 'utf8'
  );
  for (const shot of manifest) {
    assert.ok(xml.includes(`${shot.name}.png`), `metainfo omits ${shot.name}.png`);
    assert.ok(xml.includes(shot.caption), `metainfo omits the caption for ${shot.name}`);
  }
  assert.ok(/<screenshot type="default">[\s\S]{0,200}01-launcher\.png/.test(xml),
    'the launcher must be the default screenshot; it is what the app is');
});

test('the published catalogue is built from the shipped list', () => {
  // Two copies of a list drift, and the one that drifts is the one a parent is
  // reading. The page is generated from config/suggestions.json for that
  // reason, and this catches anyone hand-editing the page instead.
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'suggestions.json'), 'utf8'));
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'catalogue', 'index.html'), 'utf8');
  for (const entry of data.suggestions) {
    const shown = entry.siteName || entry.title;
    assert.ok(page.includes(`>${shown}<`), `${shown} is missing from the page`);
  }
  const cards = (page.match(/class="cat-card"/g) || []).length;
  assert.equal(cards, data.suggestions.length, 'the page and the list disagree on how many sites');
});

test('the catalogue page carries no third-party imagery and claims nothing', () => {
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'catalogue', 'index.html'), 'utf8');
  // Wrapped lines are still one sentence to a reader, so match on the text
  // rather than on where the editor happened to break it.
  const text = page.replace(/\s+/g, ' ');
  // The four things the page has to say, checked one by one rather than by
  // pinning a single sentence. The wording moved once already -- "compatible"
  // is in the heading now -- and the substance is what has to survive that.
  assert.match(text, /compatible sites/i, 'the list should be framed as compatibility');
  assert.match(text, /not connected to any of these sites/i);
  assert.match(text, /not endorsed by them/i);
  assert.match(text, /does not check what they show/i);
  // No logos, favicons or anything else loaded from somebody else's server.
  const external = [...page.matchAll(/(?:src|srcset)="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, [], `the page should load no remote images: ${external.join(', ')}`);
  for (const word of ['recommended', 'child-safe', 'vetted', 'approved by us', 'mesingh90@']) {
    assert.ok(!new RegExp(word, 'i').test(page), `"${word}" claims more than this project checks`);
  }
});

test('every page carries the same navigation', () => {
  const pages = builtPages();
  assert.ok(pages.length >= 8, 'the site should have all its pages built');

  // One <Nav> component renders into every page, so they must agree. Drift
  // here means the build did not run, not that somebody edited one copy.
  const navOf = (text) => {
    const from = text.indexOf('<header class="top">');
    const to = text.indexOf('</header>');
    assert.ok(from !== -1 && to !== -1, 'no header');
    return text.slice(from, to);
  };

  // Each page marks its own link and, on the download pages, lights the
  // download pill. Both are per-page state, so compare with them removed.
  const strip = (nav) => nav
    .replace(/ aria-current="page"/g, '')
    .replace(/class="nav-dl is-current"/g, 'class="nav-dl"');
  const first = strip(navOf(fs.readFileSync(pages[0].file, 'utf8')));

  for (const page of pages) {
    const nav = strip(navOf(fs.readFileSync(page.file, 'utf8')));
    assert.equal(nav, first,
      `${page.name} has a different navigation; run \`npm run site\``);
  }
});

test('the navigation only points at pages that exist', () => {
  const docs = path.join(__dirname, '..', 'docs');
  const docsDir = path.join(__dirname, '..', 'docs');
  const text = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
  const nav = text.slice(text.indexOf('<header class="top">'), text.indexOf('</header>'));

  for (const href of (nav.match(/href="([^"]+)"/g) || []).map((m) => m.slice(6, -1))) {
    if (href.startsWith('http') || href.startsWith('/assets/')) continue;
    // Clean URLs: /debug/ is the directory holding that page's index.html.
    assert.ok(href === '/' || /^\/[a-z-]+\/(#.*)?$/.test(href),
      `${href} should be a clean path ending in a slash`);
    const dir = href === '/' ? '' : href.replace(/^\//, '').split('#')[0];
    assert.ok(fs.existsSync(path.join(docsDir, dir, 'index.html')),
      `the navigation links to ${href}, which is not there`);
  }
});

test('the old .html addresses still lead somewhere', () => {
  const docs = path.join(__dirname, '..', 'docs');
  // The site was live at these before the move to clean URLs, and GitHub
  // Pages forwards the github.io path to the custom domain keeping the path,
  // so an old link arrives here rather than at a 404.
  for (const name of ['catalogue', 'download', 'macos', 'windows', 'linux', 'debug']) {
    const file = path.join(docs, `${name}.html`);
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(),
      `docs/${name}.html should be a redirect file`);
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, new RegExp(`url=/${name}/`), `${name}.html should forward to /${name}/`);
  }
});

test('the built site keeps the files GitHub Pages needs', () => {
  const docs = path.join(__dirname, '..', 'docs');
  // Astro empties its output directory on every build. These live in
  // web/public/ so the build puts them back; without CNAME the custom domain
  // silently reverts to github.io on the next deploy.
  for (const name of ['CNAME', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(docs, name)),
      `docs/${name} is missing -- it belongs in web/public/`);
  }
  assert.equal(fs.readFileSync(path.join(docs, 'CNAME'), 'utf8').trim(), 'sukhiplay.com');
});

test('no script writes into docs, which the site build empties', () => {
  const dir = path.join(__dirname, '..', 'scripts');
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    // `npm run site` deletes docs/ and rebuilds it. A recorder that writes
    // there produces files that survive until the next build and then vanish,
    // which is a confusing way to lose a screenshot.
    const writes = text.match(/path\.join\([^)]*['"]docs['"]/g) || [];
    assert.deepEqual(writes, [],
      `scripts/${name} builds a path into docs/; put it in web/public instead`);
  }
});

test('the demo recording in the site source is the one that got published', () => {
  const root = path.join(__dirname, '..');
  for (const name of ['demo.webp', 'demo.gif', 'demo-poster.png']) {
    const src = path.join(root, 'web', 'public', 'assets', name);
    const out = path.join(root, 'docs', 'assets', name);
    assert.ok(fs.existsSync(src), `web/public/assets/${name} is missing`);
    assert.ok(fs.existsSync(out), `docs/assets/${name} is missing; run \`npm run site\``);
    assert.equal(fs.readFileSync(src).length, fs.readFileSync(out).length,
      `docs/assets/${name} is stale; run \`npm run site\``);
  }
});

test('every page carries the tags a search or answer engine needs', () => {
  for (const page of builtPages()) {
    const html = fs.readFileSync(page.file, 'utf8');
    const meta = (re) => (html.match(re) || [])[1];

    assert.ok(/<title>[^<]{10,}<\/title>/.test(html), `${page.name} has no useful title`);
    assert.ok((meta(/<meta name="description" content="([^"]+)"/) || '').length > 40,
      `${page.name} has no description worth showing in a result`);

    const canonical = meta(/<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical && canonical.startsWith('https://sukhiplay.com/'),
      `${page.name} has no absolute canonical`);

    // Social previews need absolute URLs: a relative og:image resolves against
    // whatever is doing the unfurling, which is never this site.
    const og = meta(/<meta property="og:image" content="([^"]+)"/);
    assert.ok(og && og.startsWith('https://'), `${page.name} has no absolute og:image`);
    for (const tag of ['og:title', 'og:description', 'og:url', 'twitter:card']) {
      assert.ok(html.includes(tag), `${page.name} is missing ${tag}`);
    }
  }
});

test('the structured data on every page is valid and says what it is', () => {
  for (const page of builtPages()) {
    const html = fs.readFileSync(page.file, 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length >= 1, `${page.name} has no JSON-LD`);

    const types = blocks.map((m) => {
      // Invalid JSON-LD is worse than none: a parser drops the lot silently.
      const data = JSON.parse(m[1]);
      assert.equal(data['@context'], 'https://schema.org');
      return data['@type'];
    });
    assert.ok(types.includes('SoftwareApplication'),
      `${page.name} does not say what this software is`);
  }
});

test('llms.txt follows the shape the proposal asks for', () => {
  const file = path.join(__dirname, '..', 'docs', 'llms.txt');
  assert.ok(fs.existsSync(file), 'docs/llms.txt is missing');
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  // llmstxt.org: an H1 with the name first, then a blockquote summary, then
  // any prose, then H2 sections of annotated links.
  assert.match(lines[0], /^# \S/, 'the first line must be the H1 name');
  assert.ok(lines.slice(1, 6).some((l) => l.startsWith('> ')), 'no blockquote summary');
  assert.ok(lines.some((l) => l.startsWith('## ')), 'no link sections');

  const links = lines.filter((l) => /^- \[.+\]\(https?:\/\/\S+\): .+/.test(l));
  assert.ok(links.length >= 10, `only ${links.length} annotated links`);
});

test('the markdown twin of every doc page is served', () => {
  const docsDir = path.join(__dirname, '..', 'docs', 'docs');
  const pages = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const slug of pages) {
    const md = path.join(docsDir, `${slug}.md`);
    // llms.txt points at these. A missing one sends a reader to a 404.
    assert.ok(fs.existsSync(md), `docs/docs/${slug}.md is missing`);
    const text = fs.readFileSync(md, 'utf8');
    assert.match(text, /^# \S/, `${slug}.md does not start with its title`);
  }

  const llms = fs.readFileSync(path.join(__dirname, '..', 'docs', 'llms.txt'), 'utf8');
  for (const m of llms.matchAll(/\]\(https:\/\/sukhiplay\.com(\/docs\/[^)]+\.md)\)/g)) {
    const local = path.join(__dirname, '..', 'docs', m[1]);
    assert.ok(fs.existsSync(local), `llms.txt links ${m[1]}, which is not built`);
  }
});

test('robots.txt points at a sitemap that exists and lists real pages', () => {
  const root = path.join(__dirname, '..', 'docs');
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  assert.match(robots, /^Sitemap: https:\/\/sukhiplay\.com\/sitemap-index\.xml$/m);
  assert.ok(fs.existsSync(path.join(root, 'sitemap-index.xml')));

  const urls = [...fs.readFileSync(path.join(root, 'sitemap-0.xml'), 'utf8')
    .matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length >= 15, `the sitemap lists only ${urls.length} pages`);

  for (const url of urls) {
    const rel = url.replace('https://sukhiplay.com/', '');
    const file = rel === '' ? 'index.html' : path.join(rel, 'index.html');
    assert.ok(fs.existsSync(path.join(root, file)), `the sitemap lists ${url}, which is not built`);
    // The .html stubs are redirects; indexing them would rank a meta-refresh.
    assert.ok(!/\.html$/.test(rel), `the sitemap lists the redirect stub ${url}`);
  }
});

test('no page reaches Google before somebody agrees to it', () => {
  for (const page of builtPages()) {
    const html = fs.readFileSync(page.file, 'utf8');

    // A script tag, a preconnect or a dns-prefetch would all contact Google
    // on load, which is the thing consent is supposed to gate.
    const eager = [
      /<script[^>]+src="[^"]*(?:googletagmanager|google-analytics)/i,
      /<link[^>]+(?:preconnect|dns-prefetch|preload)[^>]*google/i,
      /<img[^>]+src="[^"]*google/i
    ];
    for (const re of eager) {
      assert.equal(re.test(html), false,
        `${page.name} contacts Google before consent: ${(html.match(re) || [])[0]}`);
    }

    // The id may appear only inside the banner's own script, which runs it
    // after a click and never before.
    const idHits = (html.match(/G-[A-Z0-9]{8,}/g) || []).length;
    if (idHits) {
      assert.ok(html.includes('sukhi-analytics'),
        `${page.name} names a GA id outside the consent gate`);
    }
  }
});

test('prior consent is required exactly where the law requires it', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

  // The region test runs in the page, so lift it out and run it here rather
  // than trusting a reading of it. Time zones, because a geo-IP lookup means
  // telling a third party where somebody lives in order to decide how
  // carefully to treat their privacy.
  const fn = html.match(/function mustAsk\(\) \{[\s\S]*?\n    \}/);
  assert.ok(fn, 'the region test is missing from the page');
  // eslint-disable-next-line no-new-func
  const mustAsk = new Function('Intl', `${fn[0]}; return mustAsk;`);

  const ask = (tz) => mustAsk({
    DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) })
  })();

  // The EU and EEA, the UK and Switzerland all require opt-in. The UK's
  // statistical-purposes exemption of February 2026 does not reach Google
  // Analytics, because that sends the data to a third party.
  for (const tz of [
    'Europe/London', 'Europe/Dublin', 'Europe/Berlin', 'Europe/Paris',
    'Europe/Madrid', 'Europe/Rome', 'Europe/Warsaw', 'Europe/Stockholm',
    'Europe/Zurich', 'Europe/Oslo', 'Atlantic/Reykjavik', 'Atlantic/Canary',
    'Asia/Nicosia', 'America/Martinique'
  ]) {
    assert.equal(ask(tz), true, `${tz} must be asked first`);
  }

  // Everywhere else may start and offer an opt-out.
  for (const tz of [
    'America/New_York', 'America/Los_Angeles', 'America/Sao_Paulo',
    'Asia/Calcutta', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney',
    'Africa/Lagos', 'Pacific/Auckland'
  ]) {
    assert.equal(ask(tz), false, `${tz} should not need prior consent`);
  }

  // A browser that will not say errs towards asking, which costs a click.
  assert.equal(ask(''), false, 'an empty zone falls through to the list');
  assert.equal(mustAsk({ DateTimeFormat: () => { throw new Error('no Intl'); } })(), true,
    'a browser that refuses to answer should be asked');
});

test('turning analytics off clears what it already set', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  // "Off" has to mean off, not "off from now on": GA's existing cookies go,
  // and its own disable flag is set for the rest of the page's life.
  assert.match(html, /Max-Age=0/, 'opting out must expire the cookies GA set');
  assert.match(html, /ga-disable-/, "opting out must set GA's disable flag");
});

test('the banner offers a real choice and remembers it', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

  assert.ok(html.includes('id="consent-yes"') && html.includes('id="consent-no"'),
    'the banner must offer both answers');
  // Consent that was nudged is not consent, so refusing must be as easy as
  // agreeing: same element, same weight, no hidden link.
  assert.match(html, /id="consent-no"[^>]*class="consent-btn"/,
    'the refuse button must be an ordinary button');

  // A stated preference is an answer already given.
  assert.ok(html.includes('doNotTrack') && html.includes('globalPrivacyControl'),
    'Do Not Track and Global Privacy Control must be honoured without asking');

  // The answer lives in the visitor's own browser, not in a cookie -- so the
  // consent mechanism itself never needs consent.
  assert.ok(html.includes('localStorage'), 'the choice should be stored locally');

  // It does touch document.cookie, but only to expire GA's. Every write must
  // be a deletion; one that sets a real value would be a tracking cookie
  // smuggled in by the thing meant to prevent them.
  const writes = [...html.matchAll(/document\.cookie\s*=\s*([^;]+;)/g)].map((m) => m[0]);
  for (const w of writes) {
    assert.match(w, /=\s*'?\s*$|=[^=]*\+\s*'=;/,
      `the banner writes a cookie with a value: ${w}`);
  }
  assert.ok(html.includes('Max-Age=0'), 'cookie writes should be expiries');
});

test('the privacy page says what is collected, and can be reached', () => {
  const root = path.join(__dirname, '..', 'docs');
  const file = path.join(root, 'privacy', 'index.html');
  assert.ok(fs.existsSync(file), 'there is no privacy page');

  const text = fs.readFileSync(file, 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const claim of [
    /sends nothing anywhere/i,          // the application
    /Google Analytics/i,                // named, not implied
    /Do Not Track/i,
    /localStorage/i
  ]) {
    assert.match(text, claim, `the privacy page does not mention ${claim}`);
  }

  // Reachable from anywhere, or nobody reads it.
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(home.includes('href="/privacy/"'), 'the footer should link the privacy page');
});

test('the cookie choice can still be reopened once it has been answered', () => {
  const root = path.join(__dirname, '..', 'docs');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  // The script returns early for anyone with a stored answer -- which is
  // everyone the footer link exists for. So the listener that reopens the
  // choice has to be attached above that return, not below it.
  const listener = html.indexOf("closest('[data-consent-reopen]')");
  const earlyReturn = html.indexOf("if (answer === 'no'");
  assert.ok(listener !== -1, 'nothing listens for the reopen link');
  assert.ok(earlyReturn !== -1, 'the stored-answer shortcut has moved or gone');
  assert.ok(listener < earlyReturn,
    'the reopen listener is attached after the early return, so the link does nothing');

  // And without JavaScript it should go somewhere, rather than jumping the
  // reader to the top of the page they were already reading.
  for (const page of ['index.html', path.join('privacy', 'index.html')]) {
    const text = fs.readFileSync(path.join(root, page), 'utf8');
    for (const m of text.matchAll(/<a[^>]*data-consent-reopen[^>]*>/g)) {
      assert.doesNotMatch(m[0], /href="#"/, `${page} has a reopen link that goes nowhere`);
      assert.match(m[0], /href="[^"]+"/, `${page} has a reopen link with no href`);
    }
  }
});

test('nothing sharing an element with .wrap shorthands away its gutter', () => {
  // .wrap is the only thing holding the page off the edge of a phone, and it
  // does it with padding-inline. Any class set on the same element that uses
  // the `padding:` shorthand silently resets that to whatever its own second
  // value is -- usually 0 -- and the text goes edge to edge. This is what
  // `.docs-shell { padding: 44px 0 80px }` did to the whole manual.
  const root = path.join(__dirname, '..', 'docs');
  const css = fs.readdirSync(path.join(root, 'build'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => fs.readFileSync(path.join(root, 'build', f), 'utf8'))
    .join('\n');

  const pages = [];
  (function walk (dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(root);

  const companions = new Set();
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    for (const m of html.matchAll(/class="([^"]*\bwrap\b[^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/)) if (cls && cls !== 'wrap') companions.add(cls);
    }
  }
  assert.ok(companions.size, 'no element combines another class with .wrap');

  for (const cls of companions) {
    // The rule for the bare class, as the minifier writes it.
    const rule = css.match(new RegExp(`(?:^|[,}])\\.${cls}\\{([^}]*)\\}`));
    if (!rule) continue;
    const shorthand = rule[1].match(/(?:^|;)padding:([^;]*)/);
    if (!shorthand) continue;
    assert.strictEqual(shorthand[1].trim().split(/\s+/).length, 1,
      `.${cls} shares an element with .wrap and shorthands padding ` +
      `(${shorthand[1].trim()}), which wipes out the page gutter`);
  }
});
