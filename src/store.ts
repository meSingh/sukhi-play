/**
 * His tracks, kept on this device.
 *
 * A track is a few hundred bytes, so they live in localStorage, all together:
 * which one is open, and every one he has made. Saved on every change, so
 * nothing is lost if the window closes. Nothing leaves the device.
 */
import { starter, transpose, type Track } from './track';
import type { Vehicle } from './vehicles';

export interface Kept {
  id: string;
  track: Track;
  vehicle: Vehicle;
  made: number;
}

interface Shelf { open: string; tracks: Kept[] }

const KEY = 'sukhi-railway-tracks';

/** The first track, the shape of the screen: on its side on an upright phone. */
function fresh (): Shelf {
  const upright = typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.1;
  const first: Kept = { id: crypto.randomUUID(), track: upright ? transpose(starter()) : starter(), vehicle: 'train', made: Date.now() };
  return { open: first.id, tracks: [first] };
}

let shelf: Shelf = load();

function load (): Shelf {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Shelf;
      if (s.tracks?.length && s.tracks.some((t) => t.id === s.open)) return s;
    }
  } catch { /* storage off, or something unreadable: start again */ }
  return fresh();
}

function save (): void {
  try { localStorage.setItem(KEY, JSON.stringify(shelf)); } catch { /* keep it for this visit */ }
}

const SEEN = 'sukhi-railway-seen';

/** Whether he has never pressed Go, for showing him what to press. */
export const firstVisit = (): boolean => {
  try { return localStorage.getItem(SEEN) === null; } catch { return false; }
};

/** He has pressed Go: the hand is not needed again. */
export function seen (): void {
  try { localStorage.setItem(SEEN, '1'); } catch { /* fine */ }
}

export const current = (): Kept => shelf.tracks.find((t) => t.id === shelf.open)!;
export const all = (): Kept[] => [...shelf.tracks].sort((a, b) => b.made - a.made);

export function keep (track: Track, vehicle: Vehicle): void {
  const k = current();
  k.track = track;
  k.vehicle = vehicle;
  save();
}

export function open (id: string): Kept {
  if (shelf.tracks.some((t) => t.id === id)) shelf.open = id;
  save();
  return current();
}

/** A new empty track, the shape of the screen it is made on. */
export function start (track: Track): Kept {
  const k: Kept = { id: crypto.randomUUID(), track, vehicle: current().vehicle, made: Date.now() };
  shelf.tracks.push(k);
  shelf.open = k.id;
  save();
  return k;
}

export function remove (id: string): Kept {
  shelf.tracks = shelf.tracks.filter((t) => t.id !== id);
  if (!shelf.tracks.length) shelf = fresh();
  if (!shelf.tracks.some((t) => t.id === shelf.open)) shelf.open = shelf.tracks[0].id;
  save();
  return current();
}
