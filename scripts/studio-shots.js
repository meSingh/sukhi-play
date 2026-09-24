#!/usr/bin/env electron
'use strict';

/**
 * Regenerates the screenshots of Jazz's Studio, from the real app.
 *
 *   npx electron scripts/studio-shots.js
 *   npm run shots:studio
 *
 * Same principle as scripts/colouring-shots.js: every picture is the built app
 * in web/public/playground/studio, put into a state and captured. Served over
 * http, because a file: page has an opaque origin and IndexedDB throws there.
 *
 * The state is set the way the studio keeps it, in localStorage, before each
 * room is opened, so each shot shows a sheet she would really make rather than
 * whatever the last shot left behind. One window throughout, resized for the
 * phone shot: a second BrowserWindow takes a helper process down with it.
 *
 * Writes web/public/screenshots/studio/, and copies the ones its README uses
 * into playground/studio/media/ when the studio is checked out.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// web/public, not docs/: docs/ is rewritten by every site build.
const SERVE = path.join(ROOT, 'web', 'public', 'playground', 'studio');
const OUT = path.join(ROOT, 'web', 'public', 'screenshots', 'studio');
const STUDIO = path.join(ROOT, 'playground', 'studio');
const README = path.join(STUDIO, 'media');

const DESKTOP = { width: 1240, height: 800 };
const PHONE = { width: 402, height: 844 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json'
};

function serve () {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const wanted = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(SERVE, wanted === '/' ? 'index.html' : wanted);
      if (!file.startsWith(SERVE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('no');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Each shot: the file name, the room, and what the studio should remember first. */
const SHOTS = [
  { name: '01-hello', hash: '#/', state: {} },
  { name: '02-me-stickers', hash: '#/stationery/sticker-sheets', state: { 'jazz-studio-stationery': { kind: 'faces', me: true, pose: 'mix', words: { faces: 'Jazz' } } } },
  { name: '03-diary-cover', hash: '#/stationery/diary-set', state: { 'jazz-studio-stationery': { kind: 'cover', me: true, pose: 'portrait', words: {} } } },
  { name: '04-make-from-a-box', hash: '#/box', state: { 'jazz-studio-box': { project: 'pencil-pot', width: 15.5, height: 10, tab: true, words: 'Pens', me: true } } },
  { name: '05-my-brand', hash: '#/brand', state: { 'jazz-studio-brand-bench': { kind: 'cards', me: true, pose: 'portrait', words: {} } } },
  { name: '06-secret-codes', hash: '#/play/secret', state: { 'jazz-studio-secret': { message: 'Meet me at the treehouse after school' } } },
  { name: '07-make-it-yours', hash: '#/yours', state: {} },
  // Kept prints live in IndexedDB, so this one keeps a few first (see KEEP).
  { name: '09-my-prints', hash: '#/makes', state: {}, keep: true },
  { name: '08-on-a-phone', hash: '#/', state: {}, phone: true }
];

/**
 * The prints kept for 09-my-prints: each tool opened with these settings and
 * its Keep in My makes button pressed, the way she would keep one.
 */
const KEEP = [
  { hash: '#/stationery/signs', state: { 'jazz-studio-stationery': { kind: 'bookmarks', me: true, pose: 'mix', words: { bookmarks: 'Reading' } } } },
  { hash: '#/stationery/sticker-sheets', state: { 'jazz-studio-stationery': { kind: 'faces', me: true, pose: 'mix', words: { faces: 'Jazz' } } } },
  { hash: '#/box', state: { 'jazz-studio-box': { project: 'pencil-pot', width: 15.5, height: 10, tab: true, words: 'Pens', me: true, pose: '' } } },
  { hash: '#/play/poster', state: { 'jazz-studio-poster': { name: 'Jazz', line: 'Artist at work', pose: 'cool', dark: true } } },
  { hash: '#/play/secret', state: { 'jazz-studio-secret': { message: 'Meet me at the treehouse after school' } } }
];

/** Which shots the studio's own README shows, and what it calls them. */
const FOR_README = { '01-hello': 'home.png', '02-me-stickers': 'stickers.png', '04-make-from-a-box': 'box.png', '05-my-brand': 'brand.png', '09-my-prints': 'prints.png', '08-on-a-phone': 'phone.png' };

app.whenReady().then(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const win = new BrowserWindow({ show: false, ...DESKTOP, useContentSize: true });
  fs.mkdirSync(OUT, { recursive: true });

  const load = async (hash, state) => {
    await win.loadURL(base);
    await win.webContents.executeJavaScript(
      `localStorage.clear(); ${Object.entries(state).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join('')}`
    );
    // A query string makes this a new document. Only the hash changing would
    // keep the page, and the page read its remembered choices when it loaded.
    await win.loadURL(`${base}?shot=${Date.now()}${hash}`);
  };

  for (const shot of SHOTS) {
    if (shot.phone) win.setContentSize(PHONE.width, PHONE.height);
    if (shot.keep) {
      for (const k of [...KEEP].reverse()) {
        await load(k.hash, k.state);
        await new Promise((resolve) => setTimeout(resolve, 900));
        await win.webContents.executeJavaScript(
          "document.querySelector('.keep-it').click(); new Promise((r) => setTimeout(() => { document.querySelector('.ask-yes').click(); setTimeout(r, 1300); }, 300))"
        );
      }
    }
    await load(shot.hash, shot.state);
    // Every image decoded and the tiles' entrance animation finished.
    await win.webContents.executeJavaScript(
      'Promise.all([...document.images].map((i) => i.decode().catch(() => {}))).then(() => new Promise((r) => setTimeout(r, 1400)))'
    );
    const png = (await win.webContents.capturePage()).toPNG();
    fs.writeFileSync(path.join(OUT, `${shot.name}.png`), png);
    if (FOR_README[shot.name] && fs.existsSync(STUDIO)) {
      fs.mkdirSync(README, { recursive: true });
      fs.writeFileSync(path.join(README, FOR_README[shot.name]), png);
    }
    console.log(`${shot.name}.png`);
  }
  if (fs.existsSync(STUDIO)) fs.copyFileSync(path.join(SERVE, 'icon-512.png'), path.join(README, 'icon.png'));

  server.close();
  app.quit();
});
