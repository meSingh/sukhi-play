/**
 * Turns the upstream Kids Coloring into the copy Sukhi Play ships.
 *
 * Four changes, and no more than four. Every line we alter is a line we have
 * to re-apply when upstream moves, so the patch says what it does and stops.
 *
 *   1. English only. Upstream guesses from the browser and remembers a toggle;
 *      a child who presses the language button and lands in Korean cannot
 *      press it back.
 *   2. No language button, for the same reason.
 *   3. No service worker. The files are on disk already; a cache in front of
 *      them is a second copy that can go stale and nothing to gain.
 *   4. Relative asset paths, because it is served from a directory and not
 *      from the root of a host.
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

// 1. English, always. The stored preference goes with it, so a language the
//    child cannot read cannot be left behind for next time.
edit('src/i18n.ts', [
  [
    "let lang: Lang = readStoredLang() ?? (navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en')",
    "// Sukhi Play ships English only: see vendor/kids-coloring/patch.mjs.\nlet lang: Lang = 'en'"
  ],
  [
    `function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem('lang')
    return v === 'en' || v === 'ko' ? v : null
  } catch {
    return null
  }
}
`,
    ''
  ]
]);

// 2. No language button.
edit('src/ui/toolbar.ts', [
  [
    "import { t, bindTitle, bindText, getLang, toggleLang } from '../i18n'",
    "import { t, bindTitle } from '../i18n'"
  ],
  [`  // 언어 토글(EN ↔ 한) — 텍스트는 전환 대상 언어를 표시.
  const langBtn = el('button', 'btn-tool lang-btn', { type: 'button' })
  bindTitle(langBtn, 'language')
  bindText(langBtn, () => (getLang() === 'ko' ? 'EN' : '한'))
  langBtn.addEventListener('click', toggleLang)
  root.appendChild(langBtn)
`,
  '  // The language toggle is removed: Sukhi Play ships English only.\n'
  ]
]);

// 3. No service worker, and 4. relative paths.
edit('src/main.ts', [
  ["import { registerSW } from 'virtual:pwa-register'\n", ''],
  ['registerSW({ immediate: true })', '/* no service worker: the files are local */']
]);

const cfg = path.join(root, 'vite.config.ts');
fs.writeFileSync(cfg, `import { defineConfig } from 'vite'

// Sukhi Play serves this from a directory, not the root of a host, so asset
// paths are relative. The PWA plugin is gone with the service worker.
export default defineConfig({
  base: './',
  build: { target: 'es2020' }
})
`);
console.log('  rewrote vite.config.ts');

// The page's own chrome is in the HTML, where no translation reaches it.
edit('index.html', [
  ['<html lang="ko">', '<html lang="en">'],
  ['<title>색칠 놀이 🎨</title>', '<title>Colouring</title>'],
  ['aria-label="색깔 고르기"', 'aria-label="Pick a colour"'],
  ['aria-label="도구"', 'aria-label="Tools"'],
  ['aria-label="그림 고르기"', 'aria-label="Pick a picture"']
]);

console.log('patched.');
