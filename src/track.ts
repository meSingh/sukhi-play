/**
 * The track: a board of squares, each empty or holding one piece.
 *
 * Every piece joins two of its square's four edges. A straight joins opposite
 * edges, a curve two edges that meet at a corner. The special pieces (station,
 * bridge, tunnel, ramp, bouncy pad, bell, car wash) are all straights with
 * something on them, so a track is only ever straights and curves underneath,
 * and a train can always follow it.
 *
 * Two squares are joined when each has an edge facing the other. That is the
 * whole rule: there are no junctions, so a track is a line or a loop, and a
 * train on it always knows where to go next.
 */

/** The four edges of a square: north, east, south, west. */
export type Edge = 0 | 1 | 2 | 3;

export const N: Edge = 0;
export const E: Edge = 1;
export const S: Edge = 2;
export const W: Edge = 3;

export const opposite = (e: Edge): Edge => ((e + 2) % 4) as Edge;
/** Column and row steps for each edge. */
export const STEP: Record<Edge, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

export type Kind =
  | 'straight' | 'curve' | 'station' | 'bridge' | 'tunnel'
  | 'ramp' | 'bouncy' | 'bell' | 'wash';

/** The pieces in the tray, in order. The special ones only come as straights. */
export const KINDS: Kind[] = ['straight', 'curve', 'station', 'bridge', 'tunnel', 'ramp', 'bouncy', 'bell', 'wash'];

export const isCurve = (k: Kind): boolean => k === 'curve';

export interface Piece {
  kind: Kind;
  /** The two edges it joins. */
  a: Edge;
  b: Edge;
}

export interface Track {
  cols: number;
  rows: number;
  /** Row by row; null for an empty square. */
  cells: Array<Piece | null>;
}

export function emptyTrack (cols = 8, rows = 5): Track {
  return { cols, rows, cells: Array.from({ length: cols * rows }, () => null) };
}

export const at = (t: Track, c: number, r: number): Piece | null =>
  c < 0 || r < 0 || c >= t.cols || r >= t.rows ? null : t.cells[r * t.cols + c];

export const inside = (t: Track, c: number, r: number): boolean => c >= 0 && r >= 0 && c < t.cols && r < t.rows;

export function put (t: Track, c: number, r: number, p: Piece | null): void {
  if (inside(t, c, r)) t.cells[r * t.cols + c] = p;
}

export const has = (p: Piece | null, e: Edge): boolean => !!p && (p.a === e || p.b === e);

/** Whether the square at (c, r) is joined to its neighbour across edge e. */
export function joined (t: Track, c: number, r: number, e: Edge): boolean {
  const p = at(t, c, r);
  if (!has(p, e)) return false;
  const [dc, dr] = STEP[e];
  return has(at(t, c + dc, r + dr), opposite(e));
}

/** The edges around (c, r) whose neighbour has a piece facing this square. */
function wanted (t: Track, c: number, r: number): Edge[] {
  const out: Edge[] = [];
  for (const e of [N, E, S, W] as Edge[]) {
    const [dc, dr] = STEP[e];
    if (has(at(t, c + dc, r + dr), opposite(e))) out.push(e);
  }
  return out;
}

/** Every way a kind of piece can sit in a square. */
function orientations (kind: Kind): Array<[Edge, Edge]> {
  return isCurve(kind)
    ? [[W, S], [N, W], [E, N], [S, E]]
    : [[W, E], [N, S]];
}

/**
 * A piece of this kind, turned to join the track around it: as many
 * neighbours joined as it can, then (for a curve) turned to face along the
 * line it continues, then left to right.
 */
export function fitted (t: Track, c: number, r: number, kind: Kind): Piece {
  const want = wanted(t, c, r);
  let best: [Edge, Edge] = orientations(kind)[0];
  let score = -1;
  for (const o of orientations(kind)) {
    const s = (want.includes(o[0]) ? 1 : 0) + (want.includes(o[1]) ? 1 : 0);
    if (s > score) { score = s; best = o; }
  }
  return { kind, a: best[0], b: best[1] };
}

/** The same piece turned to its next way round, for a tap on a piece already there. */
export function turned (p: Piece): Piece {
  const all = orientations(p.kind);
  const i = all.findIndex((o) => (o[0] === p.a && o[1] === p.b) || (o[0] === p.b && o[1] === p.a));
  const next = all[(i + 1) % all.length];
  return { kind: p.kind, a: next[0], b: next[1] };
}

/**
 * Laying track by dragging from one square into the next: the square left
 * turns to face the new one, and the new one gets a piece facing back. A
 * straight becomes a curve (and a curve a straight) as the line bends. A
 * special piece keeps its straight, so a drag does not undo a station.
 */
export function extend (t: Track, from: [number, number], dir: Edge): void {
  const [c, r] = from;
  const [dc, dr] = STEP[dir];
  const nc = c + dc;
  const nr = r + dr;
  if (!inside(t, nc, nr)) return;

  const here = at(t, c, r);
  if (here && !has(here, dir)) {
    // Keep the edge that is already joined to something, and turn the other.
    const keep = joined(t, c, r, here.a) ? here.a : joined(t, c, r, here.b) ? here.b : here.a === opposite(dir) ? here.a : here.b;
    const special = here.kind !== 'straight' && here.kind !== 'curve';
    const straightNow = keep === opposite(dir);
    if (!special || straightNow) {
      put(t, c, r, { kind: special ? here.kind : straightNow ? 'straight' : 'curve', a: keep, b: dir });
    }
  } else if (!here) {
    put(t, c, r, { kind: 'straight', a: opposite(dir), b: dir });
  }

  const there = at(t, nc, nr);
  const back = opposite(dir);
  if (!there) {
    put(t, nc, nr, { kind: 'straight', a: back, b: dir });
  } else if (!has(there, back)) {
    const keep = joined(t, nc, nr, there.a) ? there.a : joined(t, nc, nr, there.b) ? there.b : null;
    const special = there.kind !== 'straight' && there.kind !== 'curve';
    if (keep === null) {
      // Nothing holds it: face back along the drag, and on the way it was going.
      put(t, nc, nr, special ? fitted(t, nc, nr, there.kind) : { kind: 'straight', a: back, b: dir });
    } else if (!special || keep === opposite(back)) {
      put(t, nc, nr, { kind: special ? there.kind : keep === opposite(back) ? 'straight' : 'curve', a: keep, b: back });
    }
  }
}

/** A deep copy, for undo. */
export const copy = (t: Track): Track => ({ cols: t.cols, rows: t.rows, cells: t.cells.map((p) => (p ? { ...p } : null)) });

/** How many pieces a track has. */
export const count = (t: Track): number => t.cells.filter(Boolean).length;

/**
 * The track a first visit opens on, so pressing Go does something straight
 * away: a loop with a station, a bridge over the pond and a bell.
 */
export function starter (): Track {
  const t = emptyTrack(8, 5);
  const loop: Array<[number, number, Kind, Edge, Edge]> = [
    [1, 1, 'curve', E, S], [2, 1, 'straight', W, E], [3, 1, 'wash', W, E], [4, 1, 'tunnel', W, E], [5, 1, 'straight', W, E], [6, 1, 'curve', W, S],
    [6, 2, 'bell', N, S],
    [6, 3, 'curve', N, W], [5, 3, 'straight', E, W], [4, 3, 'bridge', E, W], [3, 3, 'straight', E, W], [2, 3, 'station', E, W], [1, 3, 'curve', E, N],
    [1, 2, 'straight', S, N]
  ];
  for (const [c, r, kind, a, b] of loop) put(t, c, r, { kind, a, b });
  return t;
}

/**
 * The same track turned on its side, for an upright screen: columns become
 * rows. Each edge swaps with its neighbour across the diagonal (north with
 * west, east with south), so every join still joins.
 */
export function transpose (t: Track): Track {
  const swap: Record<Edge, Edge> = { 0: 3, 3: 0, 1: 2, 2: 1 };
  const out = emptyTrack(t.rows, t.cols);
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const p = at(t, c, r);
      if (p) put(out, r, c, { kind: p.kind, a: swap[p.a], b: swap[p.b] });
    }
  }
  return out;
}
