/**
 * The train, the car and the bus.
 *
 * Drawn side-on, as a child draws them, turned to follow the line, and
 * flipped when going left so their wheels stay underneath. Sukhi rides at the
 * front, drawn upright whichever way the vehicle faces, so he is always the
 * right way up; passengers ride upright behind him.
 */
import { C, passenger } from './draw';

export type Vehicle = 'train' | 'car' | 'bus';
export const VEHICLES: Vehicle[] = ['train', 'car', 'bus'];

/** How long each part is, in squares, front first; and the gap between parts. */
export const PARTS: Record<Vehicle, number[]> = {
  train: [0.78, 0.66, 0.66],
  car: [0.72],
  bus: [0.95]
};
export const GAP = 0.08;

/** How far behind the front each part's middle is, in squares. */
export function offsets (v: Vehicle, fits: number): number[] {
  const parts = PARTS[v].slice(0, Math.max(1, fits));
  const out: number[] = [];
  let back = 0;
  for (const len of parts) { out.push(back + len / 2); back += len + GAP; }
  return out;
}

/** The whole length, front to back. */
export const lengthOf = (v: Vehicle, fits = 9): number =>
  PARTS[v].slice(0, Math.max(1, fits)).reduce((a, b) => a + b + GAP, -GAP);

function wheel (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.navy;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFC93C';
  ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.fill();
}

/**
 * One part, drawn around (0, 0) facing +x, in pixels. `front` is the part
 * Sukhi drives; `spin` turns the wheels' dots so they look like they roll.
 */
export function part (ctx: CanvasRenderingContext2D, v: Vehicle, index: number, T: number): void {
  const len = PARTS[v][index] * T;
  const h = T * 0.36;
  ctx.lineJoin = 'round';
  if (v === 'train') {
    if (index === 0) {
      // The engine: a boiler in front, the cab behind, and a chimney.
      ctx.fillStyle = '#E8453C';
      ctx.beginPath(); ctx.roundRect(-len / 2, -h / 2, len * 0.7, h, h * 0.35); ctx.fill();
      ctx.fillStyle = '#C7322B';
      ctx.beginPath(); ctx.roundRect(-len / 2, -h * 0.95, len * 0.4, h * 1.45, h * 0.25); ctx.fill();
      ctx.fillStyle = C.navy;
      ctx.beginPath(); ctx.roundRect(len * 0.14, -h * 0.95, len * 0.14, h * 0.5, 3); ctx.fill();
      ctx.fillStyle = '#FFC93C';
      ctx.beginPath(); ctx.arc(len * 0.46, 0, h * 0.18, 0, Math.PI * 2); ctx.fill();
      wheel(ctx, -len * 0.28, h * 0.55, h * 0.3);
      wheel(ctx, len * 0.2, h * 0.55, h * 0.3);
    } else {
      ctx.fillStyle = index % 2 ? '#2F6FD6' : '#1F9D55';
      ctx.beginPath(); ctx.roundRect(-len / 2, -h * 0.55, len, h * 1.05, h * 0.25); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-len / 2 + 4, -h * 0.4, len - 8, h * 0.12);
      wheel(ctx, -len * 0.28, h * 0.55, h * 0.26);
      wheel(ctx, len * 0.28, h * 0.55, h * 0.26);
    }
  } else if (v === 'car') {
    ctx.fillStyle = '#FFC93C';
    ctx.beginPath();
    ctx.moveTo(-len / 2, h * 0.4);
    ctx.lineTo(-len / 2, -h * 0.1);
    ctx.lineTo(-len * 0.28, -h * 0.75);
    ctx.lineTo(len * 0.22, -h * 0.75);
    ctx.lineTo(len * 0.42, -h * 0.1);
    ctx.lineTo(len / 2, -h * 0.05);
    ctx.lineTo(len / 2, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#BFE3FA';
    ctx.beginPath(); ctx.roundRect(len * 0.02, -h * 0.62, len * 0.24, h * 0.45, 3); ctx.fill();
    wheel(ctx, -len * 0.28, h * 0.45, h * 0.3);
    wheel(ctx, len * 0.28, h * 0.45, h * 0.3);
  } else {
    ctx.fillStyle = '#0E9F9A';
    ctx.beginPath(); ctx.roundRect(-len / 2, -h * 0.85, len, h * 1.3, h * 0.3); ctx.fill();
    ctx.fillStyle = '#BFE3FA';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.roundRect(-len / 2 + len * (0.06 + k * 0.2), -h * 0.65, len * 0.15, h * 0.45, 3); ctx.fill(); }
    wheel(ctx, -len * 0.3, h * 0.45, h * 0.3);
    wheel(ctx, len * 0.3, h * 0.45, h * 0.3);
  }
}

/** Where on a part Sukhi's head goes, in the part's own coordinates, facing +x. */
export function seat (v: Vehicle, T: number): [number, number] {
  const len = PARTS[v][0] * T;
  if (v === 'train') return [-len * 0.3, -T * 0.34];
  if (v === 'car') return [len * 0.02, -T * 0.3];
  return [len * 0.3, -T * 0.34];
}

/** A passenger riding a part (the carriage, or the bus's back seats). */
export function rider (ctx: CanvasRenderingContext2D, x: number, y: number, T: number, seed: number): void {
  passenger(ctx, x, y - T * 0.08, T * 0.12, seed);
}
