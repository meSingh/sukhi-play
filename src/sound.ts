/**
 * Every sound the railway makes, synthesised: no audio files to download or
 * license, and it works with no connection. Built the way Sukhi Colouring's
 * are, and in the same friendly scale, so everything sounds right together.
 *
 * Nothing plays until the first press, because a browser will not start audio
 * before a gesture.
 */

const KEY = 'sukhi-railway-sound';
/** C major pentatonic, for anything with a note in it. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor () {
    try { this.muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }
  }

  setMuted (muted: boolean): void {
    this.muted = muted;
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* fine */ }
  }

  /** Called on the first press, which is when a browser allows it. */
  wake (): void {
    if (!this.ctx) {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      // Half a second of white noise, for chuffs, rattles and splashes.
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate / 2, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private get ready (): AudioContext | null {
    return this.muted || !this.ctx ? null : this.ctx;
  }

  /** One note: a shape, a pitch that may slide, a length. */
  private tone (freq: number, when: number, gain: number, dur: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  /** A burst of filtered noise. */
  private hiss (when: number, gain: number, dur: number, freq: number, q = 1): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start(when, Math.random() * 0.3);
    src.stop(when + dur + 0.05);
  }

  /** A piece clicking into place. */
  place (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.hiss(now, 0.12, 0.05, 2400, 3);
    this.tone(659.25, now + 0.02, 0.07, 0.12);
    this.tone(987.77, now + 0.08, 0.06, 0.16);
  }

  /** A piece taken away, or undone. */
  remove (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(659.25, now, 0.07, 0.12);
    this.tone(440, now + 0.07, 0.07, 0.18);
  }

  /** The horn: two notes together, like a real train, on pressing Go. */
  toot (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    for (const f of [440, 554.37]) {
      this.tone(f, now, 0.06, 0.42, 'triangle');
      this.tone(f, now + 0.5, 0.06, 0.55, 'triangle');
    }
  }

  /** One chuff of the engine, soft enough to be under everything else. */
  chuff (strong: boolean): void {
    const ctx = this.ready; if (!ctx) return;
    this.hiss(ctx.currentTime, strong ? 0.07 : 0.04, 0.12, 900, 0.8);
  }

  /** The bell, rung as the train passes: a bright note with a slow ring. */
  bell (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.tone(1318.5, now + i * 0.28, 0.09, 0.9);
      this.tone(1318.5 * 2.76, now + i * 0.28, 0.02, 0.5);
    }
  }

  /** Wheels on a bridge: a quick run of clacks. */
  rattle (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) this.hiss(now + i * 0.09, 0.08, 0.04, 3000, 4);
  }

  /** Up over the ramp: a whistle that climbs. */
  whee (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(523.25, now, 0.08, 0.5, 'sine', 1567.98);
  }

  /** The bouncy pad. */
  boing (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(220, now, 0.12, 0.45, 'triangle', 660);
    this.tone(660, now + 0.2, 0.05, 0.3, 'sine', 330);
  }

  /** The car wash: a swish, then bubbles popping up the scale. */
  swish (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.hiss(now, 0.1, 0.6, 1500, 0.5);
    for (let i = 0; i < 5; i++) this.tone(SCALE[i], now + 0.2 + i * 0.09, 0.05, 0.1);
  }

  /** Arriving at the station: the two-note chime. */
  station (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(783.99, now, 0.09, 0.5);
    this.tone(659.25, now + 0.3, 0.09, 0.7);
  }

  /** Into the tunnel: a low hoot that echoes. */
  tunnel (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) this.tone(392, now + i * 0.22, 0.07 / (i + 1), 0.4, 'sine', 330);
  }

  /** The end of the line: a gentle bump, and the train backs up. */
  bump (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(196, now, 0.12, 0.18, 'triangle');
    this.tone(880, now + 0.25, 0.05, 0.12);
    this.tone(880, now + 0.45, 0.05, 0.12);
  }

  /** A passenger getting on or off. */
  hop (): void {
    const ctx = this.ready; if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(SCALE[2], now, 0.07, 0.1);
    this.tone(SCALE[4], now + 0.08, 0.07, 0.14);
  }
}
