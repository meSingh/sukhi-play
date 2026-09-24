/**
 * Drawing the board, in layers, onto a canvas, in squares of `T` pixels:
 *
 *   ground   grass, the faint grid, ponds under bridges
 *   track    sleepers and rails, and the pieces' own things beside them
 *   (the train goes here: see game.ts)
 *   over     what the train passes under or through: tunnel hills, the car
 *            wash's spray, bridge railings
 *
 * All of it is shapes, so it is sharp at any size and there is no art to
 * download or license. Colours are the ones in the design.
 */
import { opposite, type Edge, type Piece, type Track } from './track';

export const C = {
  grass: '#BDE59A',
  grid: '#ADD98A',
  bush: '#8CC96A',
  bed: '#C99A6B',
  sleeper: '#8B6440',
  rail: '#6B4A2F',
  water: '#7CC6F0',
  waterLight: '#A9DBF6',
  hill: '#8CC96A',
  hillTop: '#9ED47A',
  mouth: '#3E5A2B',
  wash: '#9ED8F5',
  washLine: '#3A8FC4',
  bell: '#FFC93C',
  bellDark: '#B8860B',
  pink: '#FF7AA8',
  grey: '#6B7280',
  platform: '#EBD9BF',
  platformLine: '#B89A72',
  roof: '#E8453C',
  white: '#FFFFFF',
  navy: '#1E2A5A'
};

/** The middle of an edge, in pixels. */
function mid (c: number, r: number, e: Edge, T: number): [number, number] {
  return e === 0 ? [(c + 0.5) * T, r * T] : e === 1 ? [(c + 1) * T, (r + 0.5) * T] : e === 2 ? [(c + 0.5) * T, (r + 1) * T] : [c * T, (r + 0.5) * T];
}

function cornerOf (c: number, r: number, a: Edge, b: Edge, T: number): [number, number, number, number] {
  // The corner, and the angles from it to each edge's middle.
  const s = new Set([a, b]);
  let cx = c; let cy = r;
  if (s.has(0) && s.has(1)) { cx = c + 1; cy = r; }
  else if (s.has(1) && s.has(2)) { cx = c + 1; cy = r + 1; }
  else if (s.has(2) && s.has(3)) { cx = c; cy = r + 1; }
  const [ax, ay] = mid(c, r, a, T);
  const [bx, by] = mid(c, r, b, T);
  return [cx * T, cy * T, Math.atan2(ay - cy * T, ax - cx * T), Math.atan2(by - cy * T, bx - cx * T)];
}

/** Traces a piece's centre line, for stroking. */
function line (ctx: CanvasRenderingContext2D, c: number, r: number, p: Piece, T: number, offset = 0): void {
  ctx.beginPath();
  if (p.a === opposite(p.b)) {
    const [x0, y0] = mid(c, r, p.a, T);
    const [x1, y1] = mid(c, r, p.b, T);
    const nx = -(y1 - y0) / T;
    const ny = (x1 - x0) / T;
    ctx.moveTo(x0 + nx * offset, y0 + ny * offset);
    ctx.lineTo(x1 + nx * offset, y1 + ny * offset);
  } else {
    const [cx, cy, a0, a1] = cornerOf(c, r, p.a, p.b, T);
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    ctx.arc(cx, cy, T * 0.5 + offset, a0, a0 + da, da < 0);
  }
}

/** Sleepers across the line, then two rails along it. */
function rails (ctx: CanvasRenderingContext2D, c: number, r: number, p: Piece, T: number): void {
  ctx.lineCap = 'butt';
  line(ctx, c, r, p, T);
  ctx.strokeStyle = C.bed;
  ctx.lineWidth = T * 0.5;
  ctx.stroke();
  // Sleepers: dashes of a wide line.
  line(ctx, c, r, p, T);
  ctx.strokeStyle = C.sleeper;
  ctx.lineWidth = T * 0.4;
  ctx.setLineDash([T * 0.05, T * 0.12]);
  ctx.lineDashOffset = -T * 0.02;
  ctx.stroke();
  ctx.setLineDash([]);
  for (const o of [-0.12, 0.12]) {
    line(ctx, c, r, p, T, o * T);
    ctx.strokeStyle = C.rail;
    ctx.lineWidth = Math.max(2, T * 0.05);
    ctx.stroke();
  }
}

/** Whether a straight runs across (east to west) rather than up and down. */
const across = (p: Piece): boolean => p.a === 1 || p.a === 3;

function rounded (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
}

/** A small scattering of bushes in empty squares, the same every time for the same square. */
function bushes (ctx: CanvasRenderingContext2D, t: Track, T: number): void {
  ctx.fillStyle = C.bush;
  for (let i = 0; i < t.cells.length; i++) {
    if (t.cells[i]) continue;
    const h = (i * 2654435761) >>> 0;
    if (h % 7 !== 0) continue;
    const c = i % t.cols;
    const r = Math.floor(i / t.cols);
    const x = (c + 0.25 + ((h >> 8) % 50) / 100) * T;
    const y = (r + 0.3 + ((h >> 16) % 40) / 100) * T;
    ctx.beginPath();
    ctx.arc(x, y, T * 0.16, 0, Math.PI * 2);
    ctx.arc(x + T * 0.14, y + T * 0.04, T * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function ground (ctx: CanvasRenderingContext2D, t: Track, T: number): void {
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, t.cols * T, t.rows * T);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let c = 1; c < t.cols; c++) { ctx.moveTo(c * T, 0); ctx.lineTo(c * T, t.rows * T); }
  for (let r = 1; r < t.rows; r++) { ctx.moveTo(0, r * T); ctx.lineTo(t.cols * T, r * T); }
  ctx.stroke();
  bushes(ctx, t, T);
  // Water under every bridge, a little wider than its square so ponds join up.
  t.cells.forEach((p, i) => {
    if (p?.kind !== 'bridge') return;
    const c = i % t.cols;
    const r = Math.floor(i / t.cols);
    const cx = (c + 0.5) * T;
    const cy = (r + 0.5) * T;
    ctx.fillStyle = C.water;
    ctx.beginPath();
    ctx.ellipse(cx, cy, across(p) ? T * 0.55 : T * 0.62, across(p) ? T * 0.62 : T * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.waterLight;
    ctx.beginPath();
    ctx.ellipse(cx - T * 0.18, cy + T * 0.2, T * 0.14, T * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Each piece's rails, and what sits beside them. `ring` is how far through its ring each bell is (0 to 1). */
export function track (ctx: CanvasRenderingContext2D, t: Track, T: number, ring: Map<number, number>, waiting: Map<number, number>): void {
  t.cells.forEach((p, i) => {
    if (!p) return;
    const c = i % t.cols;
    const r = Math.floor(i / t.cols);
    const x = c * T;
    const y = r * T;
    if (p.kind === 'station') {
      // The platform beside the line, below it or to its right, with a roof.
      ctx.fillStyle = C.platform;
      ctx.strokeStyle = C.platformLine;
      ctx.lineWidth = 2;
      if (across(p)) { rounded(ctx, x + T * 0.08, y + T * 0.76, T * 0.84, T * 0.2, 4); }
      else { rounded(ctx, x + T * 0.76, y + T * 0.08, T * 0.2, T * 0.84, 4); }
      ctx.fill(); ctx.stroke();
    }
    rails(ctx, c, r, p, T);
    const cx = x + T / 2;
    const cy = y + T / 2;
    switch (p.kind) {
      case 'station': {
        ctx.fillStyle = C.roof;
        ctx.beginPath();
        if (across(p)) { ctx.moveTo(x + T * 0.12, y + T * 0.8); ctx.lineTo(cx, y + T * 0.66); ctx.lineTo(x + T * 0.88, y + T * 0.8); }
        else { ctx.moveTo(x + T * 0.8, y + T * 0.12); ctx.lineTo(x + T * 0.66, cy); ctx.lineTo(x + T * 0.8, y + T * 0.88); }
        ctx.closePath();
        ctx.fill();
        if (waiting.has(i)) passenger(ctx, across(p) ? x + T * 0.3 : x + T * 0.86, across(p) ? y + T * 0.86 : y + T * 0.3, T * 0.14, waiting.get(i)!);
        break;
      }
      case 'ramp': {
        // A little hump: a lighter wedge on the bed, and chevrons pointing up it.
        ctx.save();
        ctx.translate(cx, cy);
        if (!across(p)) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(-T * 0.5, T * 0.25); ctx.lineTo(T * 0.2, -T * 0.25); ctx.lineTo(T * 0.5, -T * 0.25); ctx.lineTo(T * 0.5, T * 0.25);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.white;
        ctx.lineWidth = T * 0.05;
        ctx.lineCap = 'round';
        for (const dx of [-0.2, 0.05]) {
          ctx.beginPath(); ctx.moveTo(dx * T, -T * 0.12); ctx.lineTo((dx + 0.1) * T, 0); ctx.lineTo(dx * T, T * 0.12); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'bouncy': {
        // A pink pad on the line, on a spring.
        ctx.save();
        ctx.translate(cx, cy);
        if (!across(p)) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = C.pink;
        rounded(ctx, -T * 0.22, -T * 0.2, T * 0.44, T * 0.4, T * 0.08);
        ctx.fill();
        ctx.strokeStyle = C.white;
        ctx.lineWidth = T * 0.04;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { ctx.moveTo(-T * 0.14 + k * T * 0.09, -T * 0.12); ctx.lineTo(-T * 0.1 + k * T * 0.09, T * 0.12); }
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'bell': {
        // A bell on a post beside the line, swinging while it rings.
        const bx = across(p) ? cx : x + T * 0.84;
        const by = across(p) ? y + T * 0.16 : cy;
        const swing = Math.sin((ring.get(i) ?? 0) * Math.PI * 6) * (1 - (ring.get(i) ?? 0)) * 0.6;
        ctx.save();
        ctx.translate(bx, by - T * 0.1);
        ctx.rotate(swing);
        ctx.fillStyle = C.bell;
        ctx.strokeStyle = C.bellDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-T * 0.14, 0, -T * 0.12, T * 0.16, -T * 0.16, T * 0.2);
        ctx.lineTo(T * 0.16, T * 0.2);
        ctx.bezierCurveTo(T * 0.12, T * 0.16, T * 0.14, 0, 0, 0);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.bellDark;
        ctx.beginPath(); ctx.arc(0, T * 0.23, T * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      default:
        break;
    }
  });
}

/** What the train goes under or through, drawn after it. */
export function over (ctx: CanvasRenderingContext2D, t: Track, T: number, time: number): void {
  t.cells.forEach((p, i) => {
    if (!p) return;
    const c = i % t.cols;
    const r = Math.floor(i / t.cols);
    const x = c * T;
    const y = r * T;
    const cx = x + T / 2;
    const cy = y + T / 2;
    if (p.kind === 'tunnel') {
      // A hill over the square, with a dark mouth where the line goes in and out.
      ctx.fillStyle = C.hill;
      ctx.beginPath();
      ctx.ellipse(cx, cy, T * 0.56, T * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.hillTop;
      ctx.beginPath();
      ctx.ellipse(cx - T * 0.06, cy - T * 0.08, T * 0.3, T * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const e of [p.a, p.b]) {
        const [mx, my] = mid(c, r, e, T);
        const inward = Math.atan2(cy - my, cx - mx);
        ctx.save();
        ctx.translate(mx + Math.cos(inward) * T * 0.04, my + Math.sin(inward) * T * 0.04);
        ctx.rotate(inward - Math.PI / 2);
        ctx.fillStyle = C.mouth;
        ctx.beginPath();
        ctx.moveTo(-T * 0.2, 0);
        ctx.arc(0, 0, T * 0.2, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (p.kind === 'wash') {
      ctx.fillStyle = 'rgba(158,216,245,0.55)';
      ctx.strokeStyle = C.washLine;
      ctx.lineWidth = 3;
      rounded(ctx, x + T * 0.12, y + T * 0.12, T * 0.76, T * 0.76, T * 0.14);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.white;
      ctx.strokeStyle = C.washLine;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = time * 0.8 + k * 1.7;
        const bx = cx + Math.cos(a) * T * 0.22;
        const by = cy + Math.sin(a * 1.3) * T * 0.22;
        ctx.beginPath(); ctx.arc(bx, by, T * (0.05 + (k % 2) * 0.03), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (p.kind === 'bridge') {
      ctx.strokeStyle = C.white;
      ctx.lineWidth = Math.max(3, T * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (across(p)) {
        for (const yy of [y + T * 0.2, y + T * 0.8]) { ctx.moveTo(x + T * 0.05, yy); ctx.lineTo(x + T * 0.95, yy); }
        for (const xx of [0.2, 0.5, 0.8]) { ctx.moveTo(x + xx * T, y + T * 0.2); ctx.lineTo(x + xx * T, y + T * 0.26); ctx.moveTo(x + xx * T, y + T * 0.74); ctx.lineTo(x + xx * T, y + T * 0.8); }
      } else {
        for (const xx of [x + T * 0.2, x + T * 0.8]) { ctx.moveTo(xx, y + T * 0.05); ctx.lineTo(xx, y + T * 0.95); }
      }
      ctx.stroke();
    }
  });
}

/** A waiting animal: a rabbit, a bear or a cat, chosen by the square, so each station has its own. */
export function passenger (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const kind = seed % 3;
  const fur = ['#F2F2F2', '#C8956A', '#F6B45A'][kind];
  ctx.fillStyle = fur;
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = Math.max(1.5, s * 0.14);
  if (kind === 0) {
    for (const dx of [-0.35, 0.35]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - s * 1.1, s * 0.25, s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else {
    for (const dx of [-0.7, 0.7]) {
      ctx.beginPath();
      if (kind === 1) ctx.arc(x + dx * s, y - s * 0.75, s * 0.35, 0, Math.PI * 2);
      else { ctx.moveTo(x + dx * s - s * 0.3, y - s * 0.5); ctx.lineTo(x + dx * s, y - s * 1.2); ctx.lineTo(x + dx * s + s * 0.3, y - s * 0.5); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
    }
  }
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.navy;
  for (const dx of [-0.35, 0.35]) { ctx.beginPath(); ctx.arc(x + dx * s, y - s * 0.1, s * 0.12, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath();
  ctx.lineWidth = Math.max(1.2, s * 0.1);
  ctx.arc(x, y + s * 0.2, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** A see-through piece following the pointer while one is dragged from the tray. */
export function ghost (ctx: CanvasRenderingContext2D, c: number, r: number, p: Piece, T: number): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  rails(ctx, c, r, p, T);
  ctx.restore();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 4;
  ctx.setLineDash([T * 0.12, T * 0.08]);
  rounded(ctx, c * T + 4, r * T + 4, T - 8, T - 8, T * 0.14);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The keyboard's square. */
export function cursor (ctx: CanvasRenderingContext2D, c: number, r: number, T: number): void {
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 4;
  rounded(ctx, c * T + 3, r * T + 3, T - 6, T - 6, T * 0.14);
  ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2;
  rounded(ctx, c * T + 7, r * T + 7, T - 14, T - 14, T * 0.12);
  ctx.stroke();
}
