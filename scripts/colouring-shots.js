#!/usr/bin/env electron
'use strict';

/**
 * Regenerates the screenshots on the Sukhi Colouring page, from the real app.
 *
 *   npx electron scripts/colouring-shots.js
 *   npm run shots:colouring
 *
 * Same principle as scripts/shots.js: a picture of the application is only
 * worth putting on a website if the application actually produced it. Nothing
 * here is mocked up, composed or retouched -- every shot is the built app in
 * web/public/playground/colouring, driven into a state and captured.
 *
 * It is served over http rather than opened as a file. A file: page has an
 * opaque origin, so IndexedDB throws, and the shelf -- which is the whole
 * point of one of these shots -- would be empty in a way it never is for a
 * child.
 *
 * Captured at the size a laptop actually shows and displayed at half that on
 * the page, which is what makes them sharp on a retina screen. Asking Chromium
 * for a 2x scale factor instead would have given the same pixels of a
 * different layout -- a 2480px-wide window is a 2480px-wide desk, with the same
 * 54px buttons floating in it, and that is not the app anybody uses.
 *
 * One window throughout. A second BrowserWindow opened while the first was
 * tearing down took a helper process with it ("No rendezvous client, parent
 * died"), so the phone shot resizes this one and reloads instead.
 */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// web/public, not docs/. Both hold the same built app, but docs/ is emptied
// and rewritten by every site build, and a test in this repository refuses any
// script that reaches into it for exactly that reason.
const SERVE = path.join(ROOT, 'web', 'public', 'playground', 'colouring');
const OUT = path.join(ROOT, 'web', 'public', 'screenshots', 'colouring');

const DESKTOP = { width: 1240, height: 800 };
const PHONE = { width: 402, height: 844 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

/** Serves the built app, and only the built app. */
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

/**
 * The driving is done in the page, because that is where the app is. Each of
 * these is the same thing a child does: press a tool, press a colour, drag.
 */
const HELPERS = `
  window.__s = {
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    btn: (label) => [...document.querySelectorAll('.rail--right .btn, .eraser-slot .btn')]
      .find((n) => n.getAttribute('aria-label') === label),
    swatch: (hex) => [...document.querySelectorAll('.rail--left .swatch')]
      .find((n) => n.getAttribute('aria-label') === hex),
    drag (points) {
      const cv = document.querySelector('.sheet-canvas');
      const b = cv.getBoundingClientRect();
      const at = (t, p) => cv.dispatchEvent(new PointerEvent(t, {
        bubbles: true, pointerId: 1, isPrimary: true, buttons: 1, pointerType: 'mouse',
        clientX: b.left + b.width * p[0], clientY: b.top + b.height * p[1]
      }));
      at('pointerdown', points[0]);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const c = points[i];
        for (let s = 1; s <= 12; s++) {
          at('pointermove', [a[0] + (c[0] - a[0]) * s / 12, a[1] + (c[1] - a[1]) * s / 12]);
        }
      }
      at('pointerup', points[points.length - 1]);
    },
    tap (x, y) {
      const cv = document.querySelector('.sheet-canvas');
      const b = cv.getBoundingClientRect();
      for (const t of ['pointerdown', 'pointerup']) {
        cv.dispatchEvent(new PointerEvent(t, {
          bubbles: true, pointerId: 1, isPrimary: true, buttons: 1, pointerType: 'mouse',
          clientX: b.left + b.width * x, clientY: b.top + b.height * y
        }));
      }
    },
    closePanels () {
      for (const n of [...document.querySelectorAll('button')]
        .filter((b) => b.getAttribute('aria-label') === 'Close')) n.click();
    }
  };
  'ready'
`;

/**
 * Places outline `pick` and colours it in.
 *
 * The regions are found rather than guessed at, because guessing produced a
 * butterfly with nothing in it. A tap has three possible outcomes and only one
 * of them is wanted:
 *
 *   nothing      the tap was on the outline's own stroke
 *   a region     a wing, a petal, the thing we are after
 *   the page     the tap was in the background, and fill is not bounded by the
 *                outline, so it takes nearly every pixel there is
 *
 * So this sweeps a grid, fills, and reads the canvas back. A change too large
 * to be a region is the whole page, and gets undone before moving on. The
 * measurement is what tells them apart; there is no way to know from the
 * coordinate alone, because the picture is centred and scaled to the shape of
 * the window.
 *
 * It returns how many took, and the caller refuses to save a shot of a picture
 * that did not colour in.
 */
const colourSomething = (pick, colours, fill = true) => `
  (async () => {
    const s = window.__s;
    const cv = document.querySelector('.sheet-canvas');
    const ctx = cv.getContext('2d');
    const ink = () => {
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 248 || d[i + 1] < 248 || d[i + 2] < 248) n++;
      }
      return n;
    };

    s.btn('Pictures').click();
    await s.wait(500);
    document.querySelectorAll('.panel-body .card')[${pick}].click();
    await s.wait(900);

    const want = ${JSON.stringify(null)} || ${JSON.stringify([])};
    const colours = ${JSON.stringify(null)};
    const palette = ${JSON.stringify(colours)};

    const useFill = ${fill ? "true" : "false"};

    s.btn('Fill').click();
    await s.wait(80);

    // A grid over the middle of the picture, and no further.
    //
    // It used to start at the top of the page, which put the first two rows
    // above the outline. Two things live up there. The paper itself floods to
    // 94% and undoes cleanly. The square of backdrop behind the outline floods
    // to about 35% and does NOT undo -- the history keeps the paper, and a fill
    // inside a picture goes on the picture's own layer -- so a page that hits
    // it is finished, and the only thing to do is start over. Staying inside
    // the outline means neither is ever reached.
    //
    // Worked from the middle outwards, because the middle is where the regions
    // a child would actually fill are.
    const points = [];
    for (let y = 0.38; y <= 0.72; y += 0.05) {
      for (let x = 0.26; x <= 0.74; x += 0.05) points.push([x, y]);
    }
    points.sort((a, b) =>
      (Math.hypot(a[0] - 0.5, a[1] - 0.5)) - (Math.hypot(b[0] - 0.5, b[1] - 0.5)));

    const all = cv.width * cv.height;
    let taken = 0;
    let mark = ink();
    const log = [];
    for (const [x, y] of (useFill ? points : [])) {
      if (taken >= palette.length) break;
      s.swatch(palette[taken]).click();
      await s.wait(40);
      s.tap(x, y);
      await s.wait(340);

      const now = ink();
      const grew = now - mark;

      // A wing or a petal is a few per cent of the page. The two things that
      // are not -- the paper, and the square of backdrop behind the outline --
      // are both an order of magnitude bigger, and the second of them is a
      // legitimate region, which is why the ceiling has to be this low rather
      // than merely below 'the whole canvas'.
      if (grew > all * 0.07) {
        // Undone, and checked. Reading the button's disabled state was the
        // obvious way to know whether undo was available and it lies: the rail
        // is rebuilt on every change, and the copy in hand a moment after a
        // fill has been seen still carrying the state from before it. Nine
        // floods reverted and the tenth did not, which is how a screenshot of
        // a solid purple square nearly went on the website.
        let back = mark;
        for (let tries = 0; tries < 4; tries++) {
          const undo = s.btn('Back');
          if (undo) undo.click();
          await s.wait(320);
          back = ink();
          if (back <= mark + 1500) break;
        }
        log.push(x.toFixed(2) + ',' + y.toFixed(2) + ' flooded ' +
                 (grew / all * 100).toFixed(1) + '%, left ' +
                 ((back - mark) / all * 100).toFixed(1) + '%');
        if (back > mark + all * 0.02) { window.__log = log; return -1; }
        mark = back;
        continue;
      }
      // Anything smaller than this is the outline catching a tap on its own
      // stroke.
      if (grew > 1500) {
        log.push(x.toFixed(2) + ',' + y.toFixed(2) + ' took ' + (grew / all * 100).toFixed(1) + '%');
        taken++;
        mark = now;
      }
    }
    window.__log = log;

    // A stroke or two over the top, so it reads as a page somebody was at
    // rather than a page a bucket was at.
    s.swatch('#8BD64B').click();
    s.btn('Pencil').click();
    await s.wait(80);
    s.drag([[.08, .88], [.3, .82], [.52, .89], [.74, .82], [.93, .88]]);
    await s.wait(300);

    s.swatch('#FFBE18').click();
    s.btn('Stars').click();
    await s.wait(80);
    s.drag([[.09, .15], [.2, .09], [.33, .14]]);
    await s.wait(400);

    if (!useFill) {
      // A few more, over the picture itself, since nothing was filled.
      s.swatch('#FF5C5C').click();
      s.btn('Pencil').click();
      await s.wait(80);
      s.drag([[.34, .44], [.46, .40], [.58, .45]]);
      await s.wait(200);
      s.swatch('#7BB6FF').click();
      await s.wait(60);
      s.drag([[.34, .58], [.48, .54], [.62, .59]]);
      await s.wait(300);
      return ink() > mark + 1500 ? 3 : 0;
    }
    return taken;
  })()
`;

async function shoot (win, name) {
  const image = await win.webContents.capturePage();
  const file = path.join(OUT, name);
  fs.writeFileSync(file, image.toPNG());
  const { width, height } = image.getSize();
  console.log(`[SHOT] ${name.padEnd(26)} ${width}x${height}`);
}

async function main () {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(path.join(SERVE, 'index.html'))) {
    throw new Error(`${SERVE} is empty. Run "npm run playground" first.`);
  }

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;

  const win = new BrowserWindow({ ...DESKTOP, show: false, useContentSize: true });
  const js = (code) => win.webContents.executeJavaScript(code);

  /** Loads the app fresh and waits out the splash, which is not what these are of. */
  const start = async (size) => {
    if (size) win.setContentSize(size.width, size.height);
    await win.loadURL(base);
    await js(HELPERS);
    await new Promise((r) => setTimeout(r, 2600));
  };

  /**
   * Colours a picture in, starting the page over if a fill gets stuck.
   *
   * -1 comes back when a flood could not be undone, which leaves the page
   * solid and unusable for a shot. There is nothing to salvage at that point,
   * so it reloads and tries a different picture rather than saving something
   * that misrepresents the app.
   */
  const colour = async (pick, palette, fill = true) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const taken = await js(colourSomething(pick + attempt, palette, fill));
      for (const line of await js('window.__log')) console.log('   ' + line);
      if (taken >= 3) return taken;
      console.log(`[shots] picture ${pick + attempt} gave ${taken}; starting over`);
      await start();
    }
    throw new Error('could not colour a picture in; the shot would misrepresent the app');
  };

  // --- the desk -----------------------------------------------------------
  await start();

  const filled = await colour(5, ['#FF8FC0', '#7BB6FF', '#FFBE18', '#D96FD6']);
  console.log(`[shots] filled ${filled} regions`);
  await shoot(win, '01-a-page-in-progress.png');

  await js('window.__s.btn("Pictures").click(); "opened"');
  await new Promise((r) => setTimeout(r, 700));
  await shoot(win, '02-forty-pictures.png');
  await js('window.__s.closePanels(); "closed"');
  await new Promise((r) => setTimeout(r, 400));

  // Keep a few, so the shelf has something on it. Each one is a real save of
  // a real page, which is why they are coloured first.
  const shelf = [[11, ['#FF5C5C', '#FFBE18', '#8BD64B']],
                 [23, ['#7BB6FF', '#8B5CF6', '#FF8FC0']],
                 [31, ['#10D6A0', '#FF8A3D', '#2FB8C8']]];
  for (const [pick, palette] of shelf) {
    await js('window.__s.btn("Start again").click(); "asked"');
    await new Promise((r) => setTimeout(r, 400));
    await js('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Yes, clear it").click(); "cleared"');
    await new Promise((r) => setTimeout(r, 700));
    await colour(pick, palette);
    await js('window.__s.btn("Keep it").click(); "kept"');
    await new Promise((r) => setTimeout(r, 900));
  }

  await js('window.__s.btn("My pictures").click(); "shelf"');
  await new Promise((r) => setTimeout(r, 900));
  await shoot(win, '03-the-shelf.png');

  // --- a phone ------------------------------------------------------------
  await start(PHONE);
  // Pens rather than fill. A phone's page is portrait, so the outline is small
  // and centred and almost every tap between two parts of it lands on the
  // backdrop, which is the one fill that cannot be undone. Drawing always
  // works, and this shot is about the layout anyway.
  await colour(2, [], false);
  await new Promise((r) => setTimeout(r, 400));
  await shoot(win, '04-on-a-phone.png');

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
