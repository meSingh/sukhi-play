#!/usr/bin/env electron
'use strict';

/**
 * The screenshots of Sukhi's Railway on the website, from the real app.
 *
 *   npx electron scripts/railway-shots.js
 *   npm run shots:railway
 *
 * Same rule as the colouring and studio shots: the built app in
 * web/public/playground/railway, driven and captured, nothing mocked up. The
 * track is the one a first visit opens on, with Go pressed, so what the
 * picture shows is what a child sees in the first ten seconds.
 *
 * Served over http, because a file: page has an opaque origin and the app
 * keeps its tracks in localStorage. Background throttling is off, or a hidden
 * window stops the animation frames the train is drawn in.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SERVE = path.join(ROOT, 'web', 'public', 'playground', 'railway');
const OUT = path.join(ROOT, 'web', 'public', 'screenshots', 'railway');

const DESKTOP = { width: 1240, height: 800 };
const PHONE = { width: 402, height: 844 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot (win, name) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name), image.toPNG());
  const { width, height } = image.getSize();
  console.log(`[SHOT] ${name.padEnd(22)} ${width}x${height}`);
}

async function main () {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(path.join(SERVE, 'index.html'))) {
    throw new Error(`${SERVE} is empty. Run "node scripts/playground-app.mjs railway" first.`);
  }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;

  const win = new BrowserWindow({
    ...DESKTOP, show: false, useContentSize: true,
    webPreferences: { backgroundThrottling: false }
  });
  const js = (code) => win.webContents.executeJavaScript(code);

  /** A fresh first visit, with Go pressed and the train given time to move off. */
  const run = async (size, name, ms) => {
    win.setContentSize(size.width, size.height);
    await win.loadURL(base);
    await js('localStorage.clear(); "cleared"');
    await win.loadURL(base);
    await wait(900);
    await js('document.querySelector("button.go").click(); "go"');
    await wait(ms);
    await shoot(win, name);
  };

  await run(DESKTOP, '01-a-track.png', 2600);
  await run(PHONE, '02-on-a-phone.png', 2200);

  server.close();
  console.log(`[shots] written to ${path.relative(ROOT, OUT)}`);
}

app.whenReady()
  .then(main)
  .then(() => app.exit(0))
  .catch((err) => {
    console.error(err);
    app.exit(1);
  });
