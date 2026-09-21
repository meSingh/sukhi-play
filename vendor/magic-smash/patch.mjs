/**
 * Turns the upstream Magic Smash into the copy Sukhi Play ships.
 *
 * One change. Upstream pulls Baloo 2 and Nunito from Google Fonts, which is a
 * request to somebody else's server every time a child opens it. Sukhi Play
 * refuses that request -- a bundled app has no network -- so the fonts would
 * never arrive anyway, and the page would sit through a timeout before falling
 * back. Removing the link makes the fallback immediate and honest.
 *
 * The fonts are not vendored instead: Baloo 2 and Nunito are both a few hundred
 * kilobytes per weight, and the app is playful enough without them.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: patch.mjs <checkout>');

const edit = (file, pairs) => {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`${file}: upstream changed, cannot find:\n${from}`);
    s = s.split(from).join(to);
  }
  fs.writeFileSync(p, s);
  console.log(`  patched ${file}`);
};

edit('index.html', [[
  `    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet" />
`,
  '    <!-- Web fonts removed: this app ships offline. See vendor/magic-smash/patch.mjs. -->\n'
]]);

// The stylesheet still names them first, which is right: if a machine happens
// to have them installed they are used, and otherwise the stack falls through.
edit('styles.css', [
  ['font-family: "Nunito", sans-serif;',
   'font-family: "Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;'],
  ['font-family: "Baloo 2", sans-serif;',
   'font-family: "Baloo 2", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;']
]);

console.log('patched.');
