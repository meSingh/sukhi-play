/**
 * The way a train goes round a track.
 *
 * Worked out from the pieces each time the track changes: find the piece to
 * start from, follow the joins from square to square, and stop at a dead end
 * or on arriving back where it started. The result is a list of steps, one
 * per square, each with the distance along the route where it begins, so a
 * train is just a distance, and its position and heading come from here.
 *
 * Distances are in squares: a straight is 1 long, a curve (a quarter circle
 * of radius half a square) a little less.
 */
import { at, has, joined, opposite, STEP, type Edge, type Kind, type Track } from './track';

export interface Step {
  c: number;
  r: number;
  kind: Kind;
  from: Edge;
  to: Edge;
  start: number;
  len: number;
}

export interface Route {
  steps: Step[];
  length: number;
  /** A loop goes round for ever; a line ends, and the train turns back. */
  loop: boolean;
}

const ARC = Math.PI / 4;

/** Where an edge's middle is, in board squares. */
function mid (c: number, r: number, e: Edge): [number, number] {
  return e === 0 ? [c + 0.5, r] : e === 1 ? [c + 1, r + 0.5] : e === 2 ? [c + 0.5, r + 1] : [c, r + 0.5];
}

/** The corner a curve bends round. */
function corner (c: number, r: number, a: Edge, b: Edge): [number, number] {
  const s = new Set([a, b]);
  if (s.has(0) && s.has(1)) return [c + 1, r];
  if (s.has(1) && s.has(2)) return [c + 1, r + 1];
  if (s.has(2) && s.has(3)) return [c, r + 1];
  return [c, r];
}

const other = (p: { a: Edge; b: Edge }, e: Edge): Edge => (p.a === e ? p.b : p.a);

/** Follows joins from a square entered by an edge, until the track ends or comes back. */
function walk (t: Track, c0: number, r0: number, entry: Edge): Route {
  const steps: Step[] = [];
  let c = c0;
  let r = r0;
  let from = entry;
  let dist = 0;
  let loop = false;
  for (let guard = 0; guard <= t.cells.length; guard++) {
    const p = at(t, c, r);
    if (!p || !has(p, from)) break;
    const to = other(p, from);
    const len = from === opposite(to) ? 1 : ARC;
    steps.push({ c, r, kind: p.kind, from, to, start: dist, len });
    dist += len;
    if (!joined(t, c, r, to)) break;
    const [dc, dr] = STEP[to];
    c += dc;
    r += dr;
    from = opposite(to);
    if (c === c0 && r === r0 && from === entry) { loop = true; break; }
  }
  return { steps, length: dist, loop };
}

/**
 * The route a train takes: on the track with a station, or else the longest
 * one; from the station on a loop, from an end on a line.
 */
export function route (t: Track): Route | null {
  const seen = new Set<number>();
  let best: { route: Route; station: boolean } | null = null;
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const i = r * t.cols + c;
      const p = t.cells[i];
      if (!p || seen.has(i)) continue;
      // Find an end to start from, walking backwards; a loop has none.
      let start: [number, number, Edge] = [c, r, p.a];
      const back = walk(t, c, r, p.b);
      const loop = back.loop;
      if (!loop) {
        const last = back.steps[back.steps.length - 1];
        start = [last.c, last.r, last.to];
      }
      let found = walk(t, start[0], start[1], start[2]);
      for (const s of found.steps) seen.add(s.r * t.cols + s.c);
      const station = found.steps.findIndex((s) => s.kind === 'station');
      if (loop && station > 0) {
        const s = found.steps[station];
        found = walk(t, s.c, s.r, s.from);
      }
      const better = !best
        || (station >= 0 && !best.station)
        || ((station >= 0) === best.station && found.length > best.route.length);
      if (better && found.steps.length) best = { route: found, station: station >= 0 };
    }
  }
  return best?.route ?? null;
}

/** The step a distance falls in. */
export function stepAt (rt: Route, d: number): Step {
  let lo = 0;
  let hi = rt.steps.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (rt.steps[m].start <= d) lo = m; else hi = m - 1;
  }
  return rt.steps[lo];
}

/** Brings a distance onto the route: round a loop, or held to a line's ends. */
export function onRoute (rt: Route, d: number): number {
  if (rt.loop) return ((d % rt.length) + rt.length) % rt.length;
  return Math.max(0, Math.min(rt.length, d));
}

/** Where on the board a distance along the route is, and which way it faces (radians). */
export function pose (rt: Route, dist: number): { x: number; y: number; angle: number; step: Step } {
  const d = onRoute(rt, dist);
  const s = stepAt(rt, d);
  const f = Math.max(0, Math.min(1, (d - s.start) / s.len));
  const [x0, y0] = mid(s.c, s.r, s.from);
  const [x1, y1] = mid(s.c, s.r, s.to);
  if (s.from === opposite(s.to)) {
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, angle: Math.atan2(y1 - y0, x1 - x0), step: s };
  }
  const [cx, cy] = corner(s.c, s.r, s.from, s.to);
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  // The short way round: a quarter turn.
  let da = a1 - a0;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  a1 = a0 + da;
  const a = a0 + da * f;
  const x = cx + Math.cos(a) * 0.5;
  const y = cy + Math.sin(a) * 0.5;
  return { x, y, angle: a + (da > 0 ? Math.PI / 2 : -Math.PI / 2), step: s };
}
