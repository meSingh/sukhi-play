/**
 * The railway running: the train's place on its route, what each piece does
 * as it passes, Sukhi's face, and drawing it all, sixty times a second.
 *
 * The train is only a distance along the route (route.ts) and a direction.
 * On a loop it goes round for ever. On a line it goes to the end, bumps, and
 * backs up, pushing its carriages the way a real train does, so a track is
 * never "wrong": any track at all has somewhere to go.
 *
 * What pieces do, in the order a child will find them:
 *
 *   station   the train slows, stops, the chime plays; a passenger waiting
 *             gets on, and one riding gets off
 *   bridge    wheels rattle, water splashes
 *   tunnel    it disappears under the hill with a hoot, and comes out
 *   ramp      a little jump, and "wheee"
 *   bouncy    a bigger bounce, and a boing
 *   bell      the bell swings and rings
 *   wash      a swish, and bubbles all round it
 */
import { route as routeOf, pose, onRoute, type Route, type Step } from './route';
import { ground, track as drawTrack, over, ghost, cursor } from './draw';
import { part, seat, rider, offsets, lengthOf, type Vehicle } from './vehicles';
import { Sound } from './sound';
import type { Piece, Track } from './track';

import smiling from './assets/sukhi/smiling.webp';
import grin from './assets/sukhi/grin.webp';
import laughing from './assets/sukhi/laughing.webp';
import silly from './assets/sukhi/silly.webp';
import thinking from './assets/sukhi/thinking.webp';
import proud from './assets/sukhi/proud.webp';

export type Face = 'smiling' | 'grin' | 'laughing' | 'silly' | 'thinking' | 'proud';
const FACE_SRC: Record<Face, string> = { smiling, grin, laughing, silly, thinking, proud };
const faces = new Map<Face, HTMLImageElement>();
for (const [k, src] of Object.entries(FACE_SRC) as Array<[Face, string]>) {
  const im = new Image();
  im.src = src;
  faces.set(k, im);
}
export const faceSrc = (f: Face): string => FACE_SRC[f];

/** Squares a second. */
export const SPEEDS = { slow: 1.1, fast: 2.1 };
export type Speed = keyof typeof SPEEDS;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; age: number; kind: 'bubble' | 'splash' | 'star' | 'puff'; size: number }

export class Game {
  track: Track;
  vehicle: Vehicle = 'train';
  speed: Speed = 'slow';
  running = false;
  /** Called when something the controls show changes. */
  onChange: () => void = () => {};

  private rt: Route | null = null;
  private head = 0;
  private dir = 1;
  private parts = 1;
  private lastStep = -1;
  /** The station square the train will stop at when its front reaches the middle. */
  private pendingStop = -1;
  private dwell = 0;
  private face: Face = 'smiling';
  private faceFor = 0;
  private hop = { t: 1, h: 0 };
  private ring = new Map<number, number>();
  private particles: Particle[] = [];
  private chuffAt = 0;
  private chuffStrong = false;
  /** Who is waiting at each station square: an animal, by number. */
  private waiting = new Map<number, number>();
  private riders: number[] = [];
  private time = 0;
  private last = 0;

  /** For drawing: a piece being dragged from the tray, and the keyboard's square. */
  preview: { c: number; r: number; piece: Piece } | null = null;
  keyCursor: { c: number; r: number } | null = null;

  constructor (private canvas: HTMLCanvasElement, readonly sound: Sound, t: Track) {
    this.track = t;
    this.reset();
    requestAnimationFrame((now) => this.frame(now));
  }

  /** The track changed: work the route out again and put the train back at the start. */
  reset (): void {
    this.rt = routeOf(this.track);
    this.waiting = new Map(this.track.cells.flatMap((p, i) => (p?.kind === 'station' ? [[i, i] as [number, number]] : [])));
    this.riders = [];
    this.fitParts();
    // Parked: at the station on a loop (a loop starts there), at the start of a line.
    this.head = this.rt && !this.rt.loop ? lengthOf(this.vehicle, this.parts) : 0.5;
    this.dir = 1;
    this.dwell = 0;
    this.pendingStop = -1;
    this.lastStep = this.rt ? this.rt.steps.indexOf(pose(this.rt, this.head).step) : -1;
    if (this.rt) this.head = onRoute(this.rt, this.head);
  }

  /** On a short line, fewer carriages, so the train always fits on its track. */
  private fitParts (): void {
    const whole = this.vehicle === 'train' ? 3 : 1;
    this.parts = whole;
    if (!this.rt || this.rt.loop) return;
    while (this.parts > 1 && lengthOf(this.vehicle, this.parts) > this.rt.length - 0.1) this.parts--;
  }

  setVehicle (v: Vehicle): void {
    this.vehicle = v;
    this.fitParts();
    if (this.rt && !this.rt.loop) this.head = Math.max(this.head, lengthOf(v, this.parts));
    this.onChange();
  }

  /** Go, or stop. Returns false when there is nothing to drive on. */
  toggle (): boolean {
    if (this.running) {
      this.running = false;
      this.setFace('thinking', 1.5);
      this.onChange();
      return true;
    }
    if (!this.rt) this.reset();
    if (!this.rt) return false;
    this.running = true;
    this.sound.toot();
    this.setFace('grin', 1.2);
    this.onChange();
    return true;
  }

  stop (): void {
    if (this.running) { this.running = false; this.onChange(); }
  }

  private setFace (f: Face, seconds: number): void {
    this.face = f;
    this.faceFor = seconds;
  }

  private burst (x: number, y: number, kind: Particle['kind'], n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'splash' ? 1.4 + Math.random() : 0.4 + Math.random() * 0.6;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'splash' ? 1.2 : 0.2),
        life: kind === 'bubble' ? 1.6 : 0.9, age: 0, kind, size: 0.05 + Math.random() * 0.06
      });
    }
  }

  /** Something happens as the front of the train enters a square. */
  private arrive (s: Step): void {
    const x = s.c + 0.5;
    const y = s.r + 0.5;
    switch (s.kind) {
      case 'bridge': this.sound.rattle(); this.burst(x, y + 0.35, 'splash', 10); break;
      case 'tunnel': this.sound.tunnel(); this.setFace('silly', 1.4); break;
      case 'ramp': this.sound.whee(); this.hop = { t: 0, h: 0.28 }; this.setFace('laughing', 1.4); break;
      case 'bouncy': this.sound.boing(); this.hop = { t: 0, h: 0.5 }; this.setFace('silly', 1.4); this.burst(x, y, 'star', 6); break;
      case 'bell': this.sound.bell(); this.ring.set(s.r * this.track.cols + s.c, 0); this.setFace('grin', 1.2); break;
      case 'wash': this.sound.swish(); this.burst(x, y, 'bubble', 14); this.setFace('laughing', 1.6); break;
      default: break;
    }
  }

  /** At a station: stop, chime, and passengers change. */
  private stopAt (s: Step): void {
    const i = s.r * this.track.cols + s.c;
    this.dwell = 1.6;
    this.sound.station();
    this.setFace('proud', 1.8);
    const carries = this.vehicle !== 'car';
    const seats = this.vehicle === 'train' ? this.parts - 1 : this.vehicle === 'bus' ? 2 : 0;
    if (!carries) return;
    // One off, one on: a riding passenger gets off at a station with nobody waiting.
    if (this.waiting.has(i) && this.riders.length < seats) {
      this.riders.push(this.waiting.get(i)!);
      this.waiting.delete(i);
      setTimeout(() => this.sound.hop(), 350);
    } else if (!this.waiting.has(i) && this.riders.length) {
      this.waiting.set(i, this.riders.shift()!);
      setTimeout(() => this.sound.hop(), 350);
    }
    this.burst(s.c + 0.5, s.r + 0.3, 'star', 5);
  }

  private step (dt: number): void {
    this.time += dt;
    for (const [k, v] of this.ring) { if (v >= 1) this.ring.delete(k); else this.ring.set(k, v + dt / 1.4); }
    if (this.faceFor > 0) this.faceFor -= dt;
    else this.face = this.running ? (this.speed === 'fast' ? 'grin' : 'smiling') : 'smiling';
    if (this.hop.t < 1) this.hop.t = Math.min(1, this.hop.t + dt / 0.6);
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'splash') p.vy += 4 * dt;
      if (p.kind === 'bubble') p.vy -= 0.3 * dt;
      return p.age < p.life;
    });
    const rt = this.rt;
    if (!this.running || !rt) return;
    if (this.dwell > 0) { this.dwell -= dt; return; }

    this.chuffAt -= dt * (this.speed === 'fast' ? 1.7 : 1);
    if (this.chuffAt <= 0 && this.vehicle === 'train') {
      this.chuffAt = 0.34;
      this.chuffStrong = !this.chuffStrong;
      this.sound.chuff(this.chuffStrong);
      // From the chimney, near the front, rising behind everything.
      const chimney = pose(rt, this.head - 0.2);
      this.particles.push({ x: chimney.x, y: chimney.y - 0.3, vx: -Math.cos(chimney.angle) * 0.25, vy: -0.35, life: 1.1, age: 0, kind: 'puff', size: 0.07 });
    }

    const len = lengthOf(this.vehicle, this.parts);
    const before = this.head;
    let next = this.head + this.dir * SPEEDS[this.speed] * dt;
    if (!rt.loop) {
      // A line: bump at either end and back up.
      if (this.dir > 0 && next >= rt.length) { next = rt.length; this.dir = -1; this.sound.bump(); this.setFace('thinking', 1.2); }
      else if (this.dir < 0 && next - len <= 0) { next = len; this.dir = 1; this.sound.bump(); this.setFace('thinking', 1.2); }
    }
    this.head = rt.loop ? onRoute(rt, next) : next;

    // Entering a square, and reaching a station's middle going forwards.
    const now = pose(rt, this.head).step;
    const idx = rt.steps.indexOf(now);
    if (idx !== this.lastStep) {
      this.lastStep = idx;
      this.arrive(now);
      if (now.kind === 'station' && this.dir > 0) this.pendingStop = idx;
    }
    const midD = now.start + now.len / 2;
    if (this.pendingStop === idx && this.dir > 0 && this.head >= midD) {
      this.pendingStop = -1;
      this.head = midD;
      this.stopAt(now);
    }
    void before;
  }

  private frame (now: number): void {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.step(dt);
    this.draw();
    requestAnimationFrame((n) => this.frame(n));
  }

  /** Square size in pixels, for the canvas's current size. */
  get T (): number {
    return this.canvas.width / this.track.cols;
  }

  private draw (): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const T = this.T;
    ground(ctx, this.track, T);
    drawTrack(ctx, this.track, T, this.ring, this.waiting);
    this.drawParticles(ctx, T, true);
    this.drawVehicle(ctx, T);
    over(ctx, this.track, T, this.time);
    this.drawParticles(ctx, T, false);
    if (this.preview) ghost(ctx, this.preview.c, this.preview.r, this.preview.piece, T);
    if (this.keyCursor) cursor(ctx, this.keyCursor.c, this.keyCursor.r, T);
  }

  private drawVehicle (ctx: CanvasRenderingContext2D, T: number): void {
    const rt = this.rt;
    if (!rt) return;
    const lift = this.hop.t < 1 ? Math.sin(this.hop.t * Math.PI) * this.hop.h * T : 0;
    const offs = offsets(this.vehicle, this.parts);
    // Back to front, so the engine and Sukhi are on top.
    for (let k = offs.length - 1; k >= 0; k--) {
      const p = pose(rt, this.head - offs[k]);
      const x = p.x * T;
      const y = p.y * T;
      if (lift) {
        ctx.fillStyle = 'rgba(30,42,90,0.18)';
        ctx.beginPath(); ctx.ellipse(x, y + T * 0.12, T * 0.3, T * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      }
      const leftward = Math.cos(p.angle) < -0.01;
      ctx.save();
      ctx.translate(x, y - lift);
      ctx.rotate(p.angle);
      if (leftward) ctx.scale(1, -1);
      part(ctx, this.vehicle, k, T);
      ctx.restore();
      // Riders sit upright, whichever way it faces.
      const riderIndex = this.vehicle === 'train' ? k - 1 : this.vehicle === 'bus' ? k : -1;
      if (this.vehicle === 'train' && k >= 1 && this.riders[riderIndex] !== undefined) rider(ctx, x, y - lift - T * 0.2, T, this.riders[riderIndex]);
      if (k === 0) {
        if (this.vehicle === 'bus') this.riders.forEach((seed, n) => rider(ctx, x - Math.cos(p.angle) * T * (0.12 + n * 0.2), y - lift - T * 0.2, T, seed));
        // Along the vehicle to his seat, then straight up: always upright.
        const [sx, sy] = seat(this.vehicle, T);
        const hx = x + Math.cos(p.angle) * sx;
        const hy = y - lift + Math.sin(p.angle) * sx + sy;
        const im = faces.get(this.face);
        if (im?.complete && im.naturalWidth) {
          const h = T * 0.62;
          const w = h * (im.naturalWidth / im.naturalHeight);
          ctx.drawImage(im, hx - w / 2, hy - h * 0.72, w, h);
        }
      }
    }
  }

  /** Smoke goes behind the train (`smoke`), everything else in front of it. */
  private drawParticles (ctx: CanvasRenderingContext2D, T: number, smoke: boolean): void {
    for (const p of this.particles) {
      if ((p.kind === 'puff') !== smoke) continue;
      const f = 1 - p.age / p.life;
      const x = p.x * T;
      const y = p.y * T;
      const s = p.size * T;
      ctx.globalAlpha = Math.max(0, f);
      if (p.kind === 'bubble') {
        ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#3A8FC4'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, s * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (p.kind === 'splash') {
        ctx.fillStyle = '#7CC6F0';
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'star') {
        ctx.fillStyle = '#FFC93C';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 ? s * 0.5 : s * 1.4;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, f) * 0.7;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(x, y, s * (1 + p.age * 1.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** The face Sukhi has now, for the controls to show. */
  get currentFace (): Face { return this.face; }
  get hasRoute (): boolean { return !!this.rt; }
}
