#!/usr/bin/env node
/**
 * How many times each release file has been downloaded from GitHub.
 *
 *   node scripts/downloads.mjs                 a table, newest release first
 *   node scripts/downloads.mjs --json          the same, for a machine
 *   node scripts/downloads.mjs --csv FILE      also add today's totals to FILE
 *   node scripts/downloads.mjs --summary       also write the table to the
 *                                              Actions job summary
 *
 * GitHub keeps a running count per file (download_count in the releases API)
 * and shows it nowhere in its own pages. The count never resets and has no
 * dates, so on its own it says "how many ever", not "how many this week".
 * The weekly workflow (.github/workflows/downloads.yml) runs this with --csv
 * and keeps the rows on the stats branch; the difference between two rows is
 * the downloads in between.
 *
 * Every request for a file counts, including a person pressing the button
 * twice, winget's validation pipeline fetching the installer, and anything
 * else that follows the link. Treat it as an upper bound. The website's
 * download_start events (see web/ANALYTICS.md) count people instead, but only
 * those who allowed Analytics.
 *
 * GITHUB_TOKEN is used when set, for the higher rate limit; the API is public
 * and works without it.
 */
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const REPO = 'meSingh/sukhi-play';
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const csvAt = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : null;

/** Which machine a file is for, and which of its downloads. */
function kind (name) {
  const n = name.toLowerCase();
  if (n === 'sha256sums.txt') return ['checksums', 'checksums'];
  if (/mac|\.dmg$/.test(n)) {
    const v = /catalina/.test(n) ? 'catalina' : /applesilicon|arm64/.test(n) ? 'apple-silicon' : 'intel';
    return ['macos', n.endsWith('.zip') ? `${v} zip` : v];
  }
  if (/win|\.exe$/.test(n)) return ['windows', /setup/.test(n) ? 'installer' : 'portable'];
  if (/linux|\.deb$|appimage/.test(n)) return ['linux', n.endsWith('.deb') ? 'deb' : 'appimage'];
  return ['other', n];
}

async function releases () {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'sukhi-play-downloads' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub said ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

const all = await releases();
const byPlatform = {};
const byVariant = {};
const byRelease = [];
let total = 0;

for (const r of all) {
  let n = 0;
  for (const a of r.assets) {
    const [platform, variant] = kind(a.name);
    const key = platform === variant ? platform : `${platform} ${variant}`;
    byVariant[key] = (byVariant[key] ?? 0) + a.download_count;
    if (platform === 'checksums') continue;
    byPlatform[platform] = (byPlatform[platform] ?? 0) + a.download_count;
    n += a.download_count;
  }
  total += n;
  byRelease.push({ tag: r.tag_name, published: r.published_at?.slice(0, 10), downloads: n });
}

const report = { total, byPlatform, byVariant, byRelease };

if (flag('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const rows = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k.padEnd(28)} ${String(v).padStart(6)}`).join('\n');
  console.log(`Downloads of every release file, all time: ${total} (not counting checksums)\n`);
  console.log(`By platform\n${rows(byPlatform)}\n`);
  console.log(`By file\n${rows(byVariant)}\n`);
  console.log(`By release\n${byRelease.map((r) => `  ${r.tag.padEnd(10)} ${r.published ?? ''}   ${String(r.downloads).padStart(6)}`).join('\n')}`);
}

if (flag('--summary') && process.env.GITHUB_STEP_SUMMARY) {
  const table = (head, o) => `| ${head} | Downloads |\n| --- | ---: |\n${Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    `## Downloads from GitHub Releases\n\n**${total}** in all, every release, not counting checksums.\n`,
    table('Platform', byPlatform),
    table('File', byVariant),
    table('Release', Object.fromEntries(byRelease.map((r) => [`${r.tag} (${r.published})`, r.downloads])))
  ].join('\n'));
}

if (csvAt) {
  const head = 'date,total,macos,windows,linux,checksums,latest,latest_downloads';
  if (!existsSync(csvAt)) writeFileSync(csvAt, `${head}\n`);
  const latest = byRelease.find((r) => r.published) ?? { tag: '', downloads: 0 };
  const row = [new Date().toISOString().slice(0, 10), total, byPlatform.macos ?? 0, byPlatform.windows ?? 0,
    byPlatform.linux ?? 0, byVariant.checksums ?? 0, latest.tag, latest.downloads];
  appendFileSync(csvAt, `${row.join(',')}\n`);
}
