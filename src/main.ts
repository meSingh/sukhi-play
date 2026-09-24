/**
 * Sukhi's Railway.
 *
 * Build a track, press go, and watch Sukhi drive it. For children of about
 * three to five who cannot read yet, so there is no text a child needs:
 * pictures, big targets, and something happening for every press.
 *
 * Laying track, two ways, because small hands manage one or the other:
 *
 *   tap      the piece picked in the tray goes in the square, turned to join
 *            the track beside it; a tap on it again turns it round
 *   drag     across squares lays track wherever the finger goes, straights
 *            and curves by themselves
 *
 * and a piece can be dragged out of the tray onto a square. Nothing is ever
 * wrong: undo is always there, the rubber takes pieces away, and any track at
 * all has somewhere for the train to go (see game.ts).
 *
 * Keyboard: Tab to the board, arrows move the square, Enter or Space puts the
 * piece there, Shift and an arrow lays track that way, Delete takes one away,
 * 1 to 9 pick a piece, and G is go.
 */
import './style.css';
import { KINDS, at, put, fitted, turned, extend, copy, emptyTrack, inside, STEP, type Edge, type Kind, type Track } from './track';
import { Game, faceSrc } from './game';
import { Sound } from './sound';
import { VEHICLES, type Vehicle } from './vehicles';
import { ICONS, piece as pieceIcon, VEHICLE } from './icons';
import * as store from './store';
import { install } from './install';

const LABEL: Record<Kind, string> = {
  straight: 'Straight track', curve: 'Curved track', station: 'Station', bridge: 'Bridge', tunnel: 'Tunnel',
  ramp: 'Ramp', bouncy: 'Bouncy pad', bell: 'Bell', wash: 'Car wash'
};
const VLABEL: Record<Vehicle, string> = { train: 'Train', car: 'Car', bus: 'Bus' };

const first = store.firstVisit();
const sound = new Sound();
const app = document.getElementById('app')!;

app.innerHTML = `
  <header class="top">
    <span class="brand"><img src="${faceSrc('grin')}" alt="" width="40" height="48"><span>Sukhi's Railway</span></span>
    <span class="grow"></span>
    <button type="button" class="round sound" aria-label="Sound"></button>
    <button type="button" class="pill tracks-btn" aria-label="My tracks">${ICONS.tracks}<span>My tracks</span></button>
  </header>
  <main class="stage">
    <div class="board"><canvas tabindex="0" aria-label="The board. Arrow keys move, Enter puts a piece, Shift and an arrow lays track."></canvas></div>
    <aside class="side">
      <div class="go-wrap">
        <button type="button" class="go" aria-label="Go"></button>
        <span class="hand" aria-hidden="true">${ICONS.hand}</span>
      </div>
      <div class="row vehicles" role="group" aria-label="What Sukhi drives">${VEHICLES.map((v) =>
        `<button type="button" class="chip" data-vehicle="${v}" aria-label="${VLABEL[v]}">${VEHICLE[v]}</button>`).join('')}</div>
      <div class="row" role="group" aria-label="Speed">
        <button type="button" class="chip" data-speed="slow" aria-label="Slow">${ICONS.slow}</button>
        <button type="button" class="chip" data-speed="fast" aria-label="Fast">${ICONS.fast}</button>
      </div>
      <div class="row">
        <button type="button" class="chip tool undo" aria-label="Undo">${ICONS.undo}</button>
        <button type="button" class="chip tool rubber" aria-label="Take pieces away" aria-pressed="false">${ICONS.rubber}</button>
      </div>
    </aside>
  </main>
  <nav class="tray" aria-label="Track pieces">${KINDS.map((k, i) =>
    `<button type="button" class="piece" data-kind="${k}" aria-label="${LABEL[k]} (${i + 1})">${pieceIcon(k)}</button>`).join('')}</nav>
  <div class="floating" aria-hidden="true"></div>`;

const canvas = app.querySelector('canvas')!;
const boardEl = app.querySelector<HTMLElement>('.board')!;
const goBtn = app.querySelector<HTMLButtonElement>('.go')!;
const floating = app.querySelector<HTMLElement>('.floating')!;

let kept = store.current();
const game = new Game(canvas, sound, kept.track);
game.vehicle = kept.vehicle;
game.reset();

let selected: Kind = 'straight';
let rubber = false;
const undoStack: Track[] = [];

// ------------------------------------------------------------------ sizing

/** Fits the board to the space it has, in whole-pixel squares, sharp on any screen. */
function fit (): void {
  const box = boardEl.getBoundingClientRect();
  const t = game.track;
  const T = Math.max(24, Math.floor(Math.min(box.width / t.cols, box.height / t.rows)));
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = `${T * t.cols}px`;
  canvas.style.height = `${T * t.rows}px`;
  canvas.width = Math.round(T * t.cols * dpr);
  canvas.height = Math.round(T * t.rows * dpr);
}
new ResizeObserver(fit).observe(boardEl);

// ------------------------------------------------------------------ controls

function paint (): void {
  goBtn.innerHTML = game.running ? ICONS.stop : ICONS.go;
  goBtn.setAttribute('aria-label', game.running ? 'Stop' : 'Go');
  goBtn.classList.toggle('stopping', game.running);
  app.querySelectorAll<HTMLButtonElement>('[data-vehicle]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vehicle === game.vehicle)));
  app.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speed === game.speed)));
  app.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(!rubber && b.dataset.kind === selected)));
  app.querySelector('.rubber')!.setAttribute('aria-pressed', String(rubber));
  app.querySelector<HTMLButtonElement>('.undo')!.disabled = !undoStack.length;
  const snd = app.querySelector<HTMLButtonElement>('.sound')!;
  snd.innerHTML = sound.muted ? ICONS.mute : ICONS.sound;
  snd.setAttribute('aria-pressed', String(!sound.muted));
}
game.onChange = paint;
paint();

// The first press anywhere is when a browser lets sound start.
window.addEventListener('pointerdown', () => sound.wake(), { capture: true });
window.addEventListener('keydown', () => sound.wake(), { capture: true });

// On the very first visit, a hand shows him the big button.
if (first) app.classList.add('first');

goBtn.addEventListener('click', () => {
  app.classList.remove('first');
  store.seen();
  if (!game.toggle()) {
    // Nothing to drive on yet: the button shakes and the tray lights up.
    goBtn.classList.remove('shake'); void goBtn.offsetWidth; goBtn.classList.add('shake');
    app.querySelector('.tray')!.classList.add('glow');
    setTimeout(() => app.querySelector('.tray')!.classList.remove('glow'), 1600);
  }
});
app.querySelectorAll<HTMLButtonElement>('[data-vehicle]').forEach((b) => b.addEventListener('click', () => {
  game.setVehicle(b.dataset.vehicle as Vehicle);
  store.keep(game.track, game.vehicle);
}));
app.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.addEventListener('click', () => {
  game.speed = b.dataset.speed as 'slow' | 'fast';
  paint();
}));
app.querySelector('.rubber')!.addEventListener('click', () => { rubber = !rubber; paint(); });
app.querySelector('.undo')!.addEventListener('click', undo);
app.querySelector('.sound')!.addEventListener('click', () => { sound.setMuted(!sound.muted); paint(); });

// ------------------------------------------------------------------ changing the track

let before: Track | null = null;
let changed = false;

/** Starts a change: the track as it was, for undo, and the train stopped. */
function begin (): void {
  before = copy(game.track);
  changed = false;
  game.stop();
}

/** Ends a change: kept, undoable, and the train back at the start. */
function commit (): void {
  if (changed && before) {
    undoStack.push(before);
    if (undoStack.length > 60) undoStack.shift();
    game.reset();
    store.keep(game.track, game.vehicle);
  }
  before = null;
  changed = false;
  paint();
}

function undo (): void {
  const last = undoStack.pop();
  if (!last) return;
  game.stop();
  game.track = last;
  game.reset();
  store.keep(game.track, game.vehicle);
  sound.remove();
  fit();
  paint();
}

/** A tap on a square: put the picked piece there, or turn the one already there. */
function tapSquare (c: number, r: number): void {
  const t = game.track;
  const here = at(t, c, r);
  if (rubber) {
    if (here) { put(t, c, r, null); changed = true; sound.remove(); }
    return;
  }
  put(t, c, r, here && here.kind === selected ? turned(here) : fitted(t, c, r, selected));
  changed = true;
  sound.place();
}

function eraseSquare (c: number, r: number): void {
  if (at(game.track, c, r)) { put(game.track, c, r, null); changed = true; sound.remove(); }
}

/** A square from a pointer, or null off the board. */
function squareAt (x: number, y: number): [number, number] | null {
  const box = canvas.getBoundingClientRect();
  const T = box.width / game.track.cols;
  const c = Math.floor((x - box.left) / T);
  const r = Math.floor((y - box.top) / T);
  return inside(game.track, c, r) ? [c, r] : null;
}

/** The edge from one square to the next one along, stepping towards another square. */
function toward (from: [number, number], to: [number, number]): Edge {
  const dc = to[0] - from[0];
  const dr = to[1] - from[1];
  if (Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? 1 : 3;
  return dr > 0 ? 2 : 0;
}

// Drawing on the board with a finger or the mouse.
let press: { from: [number, number]; last: [number, number]; moved: boolean; id: number } | null = null;

canvas.addEventListener('pointerdown', (e) => {
  const sq = squareAt(e.clientX, e.clientY);
  if (!sq) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer that cannot be held still works */ }
  begin();
  press = { from: sq, last: sq, moved: false, id: e.pointerId };
  if (rubber) eraseSquare(sq[0], sq[1]);
});

canvas.addEventListener('pointermove', (e) => {
  if (!press || e.pointerId !== press.id) return;
  // Every point the pointer passed through since the last frame, not just the
  // last one: a quick flick on a slow tablet would otherwise cut its corners.
  const points = e.getCoalescedEvents?.() ?? [];
  for (const p of points.length ? points : [e]) follow(p.clientX, p.clientY);
});

/** Lays (or rubs out) track from the last square to the one under a point. */
function follow (x: number, y: number): void {
  if (!press) return;
  const sq = squareAt(x, y);
  if (!sq || (sq[0] === press.last[0] && sq[1] === press.last[1])) return;
  press.moved = true;
  // A fast finger can skip squares: walk through every one on the way.
  let cur = press.last;
  for (let guard = 0; guard < 20 && (cur[0] !== sq[0] || cur[1] !== sq[1]); guard++) {
    const dir = toward(cur, sq);
    const [dc, dr] = STEP[dir];
    const next: [number, number] = [cur[0] + dc, cur[1] + dr];
    if (rubber) eraseSquare(next[0], next[1]);
    else { extend(game.track, cur, dir); changed = true; sound.place(); }
    cur = next;
  }
  press.last = cur;
}

const endPress = (e: PointerEvent): void => {
  if (!press || e.pointerId !== press.id) return;
  if (!press.moved && !rubber) tapSquare(press.from[0], press.from[1]);
  press = null;
  commit();
};
canvas.addEventListener('pointerup', endPress);
canvas.addEventListener('pointercancel', endPress);

// The tray: a tap picks a piece; dragging one out puts it where it is dropped.
app.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => {
  const kind = b.dataset.kind as Kind;
  let drag: { x: number; y: number; on: boolean; id: number } | null = null;
  b.addEventListener('click', () => { selected = kind; rubber = false; paint(); });
  b.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, on: false, id: e.pointerId };
    try { b.setPointerCapture(e.pointerId); } catch { /* fine */ }
  });
  b.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) {
      drag.on = true;
      selected = kind; rubber = false; paint();
      floating.innerHTML = pieceIcon(kind);
      floating.classList.add('on');
    }
    if (!drag.on) return;
    floating.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 40}px)`;
    const sq = squareAt(e.clientX, e.clientY);
    game.preview = sq ? { c: sq[0], r: sq[1], piece: fitted(game.track, sq[0], sq[1], kind) } : null;
    floating.classList.toggle('over', !!sq);
  });
  const done = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDrag = drag.on;
    drag = null;
    floating.classList.remove('on', 'over');
    game.preview = null;
    if (!wasDrag) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    begin();
    put(game.track, sq[0], sq[1], fitted(game.track, sq[0], sq[1], kind));
    changed = true;
    sound.place();
    commit();
  };
  b.addEventListener('pointerup', done);
  b.addEventListener('pointercancel', done);
});

// ------------------------------------------------------------------ keyboard

let cur: [number, number] = [0, 0];
canvas.addEventListener('focus', () => { game.keyCursor = { c: cur[0], r: cur[1] }; });
canvas.addEventListener('blur', () => { game.keyCursor = null; });
canvas.addEventListener('keydown', (e) => {
  const dirs: Record<string, Edge> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  if (e.key in dirs) {
    e.preventDefault();
    const dir = dirs[e.key];
    const [dc, dr] = STEP[dir];
    const next: [number, number] = [cur[0] + dc, cur[1] + dr];
    if (!inside(game.track, next[0], next[1])) return;
    if (e.shiftKey) { begin(); extend(game.track, cur, dir); changed = true; sound.place(); commit(); }
    cur = next;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); begin(); tapSquare(cur[0], cur[1]); commit();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault(); begin(); eraseSquare(cur[0], cur[1]); commit();
  } else if (/^[1-9]$/.test(e.key)) {
    selected = KINDS[Number(e.key) - 1]; rubber = false; paint();
  } else if (e.key === 'g' || e.key === 'G') {
    goBtn.click();
  }
  game.keyCursor = { c: cur[0], r: cur[1] };
});
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
});

// ------------------------------------------------------------------ my tracks

function openTracks (): void {
  document.querySelector('dialog.tracks')?.remove();
  const d = document.createElement('dialog');
  d.className = 'tracks';
  d.setAttribute('aria-label', 'My tracks');
  const list = store.all();
  d.innerHTML = `<div class="tracks-head"><span class="brand"><img src="${faceSrc('proud')}" alt="" width="44" height="54"><span>My tracks</span></span>
      <button type="button" class="round close" aria-label="Close">${ICONS.close}</button></div>
    <div class="shelf">
      <button type="button" class="kept new" aria-label="A new track">${ICONS.plus}</button>
      ${list.map((k) => `<div class="kept-wrap"><button type="button" class="kept" data-open="${k.id}" aria-label="Open this track"${k.id === kept.id ? ' aria-current="true"' : ''}><canvas width="240" height="150"></canvas></button>
        <button type="button" class="round bin" data-bin="${k.id}" aria-label="Throw this track away">${ICONS.bin}</button></div>`).join('')}
    </div>`;
  document.body.append(d);
  // Each track drawn small, as it is.
  d.querySelectorAll<HTMLCanvasElement>('[data-open] canvas').forEach((cv, i) => {
    const t = list[i].track;
    const T = Math.min(cv.width / t.cols, cv.height / t.rows);
    const ctx = cv.getContext('2d')!;
    ctx.translate((cv.width - T * t.cols) / 2, (cv.height - T * t.rows) / 2);
    import('./draw').then(({ ground, track }) => { ground(ctx, t, T); track(ctx, t, T, new Map(), new Map()); });
  });
  const close = (): void => { d.close(); d.remove(); };
  d.querySelector('.close')!.addEventListener('click', close);
  d.addEventListener('click', (e) => { if (e.target === d) close(); });
  d.addEventListener('cancel', () => d.remove());
  d.querySelector('.new')!.addEventListener('click', () => {
    const wide = boardEl.clientWidth >= boardEl.clientHeight;
    kept = store.start(wide ? emptyTrack(8, 5) : emptyTrack(5, 7));
    load();
    close();
  });
  d.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) => b.addEventListener('click', () => {
    kept = store.open(b.dataset.open!);
    load();
    close();
  }));
  d.querySelectorAll<HTMLButtonElement>('[data-bin]').forEach((b) => b.addEventListener('click', () => {
    // A question first, in pictures and words: throwing a track away has no undo.
    const ask = document.createElement('dialog');
    ask.className = 'ask';
    ask.setAttribute('aria-label', 'Throw this track away?');
    ask.innerHTML = `<p>Throw this track away?</p><div class="ask-row">
      <button type="button" class="chip big no" aria-label="No, keep it">${ICONS.close}</button>
      <button type="button" class="chip big yes" aria-label="Yes, throw it away">${ICONS.bin}</button></div>`;
    document.body.append(ask);
    ask.showModal();
    const shut = (): void => { ask.close(); ask.remove(); };
    ask.querySelector('.no')!.addEventListener('click', shut);
    ask.querySelector('.yes')!.addEventListener('click', () => {
      kept = store.remove(b.dataset.bin!);
      load();
      shut();
      close();
      openTracks();
    });
    ask.addEventListener('cancel', () => ask.remove());
  }));
  d.showModal();
}
app.querySelector('.tracks-btn')!.addEventListener('click', openTracks);

/** Opens the kept track on the board. */
function load (): void {
  game.stop();
  game.track = kept.track;
  game.vehicle = kept.vehicle;
  game.reset();
  undoStack.length = 0;
  fit();
  paint();
}

install();
