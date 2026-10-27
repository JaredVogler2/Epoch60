/**
 * Procedural audio (Web Audio). Everything is synthesised at runtime from oscillators and noise — no sample files, no
 * licensing questions. One engine per page: `init()` is idempotent, nothing is created before a user gesture (iOS),
 * the context is suspended while the game is paused or the tab is hidden, and every sound respects the mute switch.
 *
 * What is verified: node graph construction, gain routing, unlock/suspend behaviour and event→sound mapping (unit tests
 * with a fake context). What is NOT verified: how it sounds — no one has listened to it yet.
 */

export type Sfx =
  | 'click'
  | 'place'
  | 'complete'
  | 'research'
  | 'warning'
  | 'story'
  | 'begin'
  | 'fire'
  | 'flood'
  | 'quake'
  | 'ash'
  | 'found'
  | 'victory'
  | 'defeat'
  | 'error';

export interface AudioSettings {
  sound: boolean;
  musicVolume: number;
  sfxVolume: number;
}

/** The minimal surface of the Web Audio API this module needs, so tests can substitute a recording fake. */
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  setTargetAtTime(v: number, t: number, k: number): unknown;
}
export interface AudioNodeLike {
  connect(n: unknown): unknown;
  disconnect?(): unknown;
}
export interface OscLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(t?: number): void;
  stop(t?: number): void;
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface FilterLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
}
export interface BufferSourceLike extends AudioNodeLike {
  buffer: unknown;
  loop: boolean;
  start(t?: number): void;
  stop(t?: number): void;
}
export interface CtxLike {
  currentTime: number;
  sampleRate: number;
  state: string;
  destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close?(): Promise<void>;
  createOscillator(): OscLike;
  createGain(): GainLike;
  createBiquadFilter(): FilterLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, rate: number): { getChannelData(i: number): Float32Array };
}

type Factory = () => CtxLike;

/** Pitches (Hz) of a minor-ish pentatonic that never clashes, whatever order the melody wanders through it. */
const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392];

export class AudioEngine {
  private ctx: CtxLike | null = null;
  private master: GainLike | null = null;
  private music: GainLike | null = null;
  private sfx: GainLike | null = null;
  private noise: { getChannelData(i: number): Float32Array } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private tension = 0;
  private era = 0;
  private playing = false;
  settings: AudioSettings = { sound: true, musicVolume: 0.5, sfxVolume: 0.7 };
  /** Names of sounds requested (test hook; bounded). */
  readonly log: Sfx[] = [];

  constructor(private readonly make: Factory | null) {}

  get unlocked(): boolean {
    return this.ctx !== null;
  }
  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Create the context on a user gesture. Safe to call any number of times. */
  unlock(): void {
    if (this.ctx || !this.make) {
      if (this.ctx && this.ctx.state === 'suspended' && this.playing) void this.ctx.resume();
      return;
    }
    const ctx = this.make();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(ctx.destination);
    // One second of white noise, reused by every noisy sound.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 22695477;
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      d[i] = ((s >>> 8) / 0x800000 - 1) * 0.9;
    }
    this.noise = buf;
    this.applyVolumes();
    this.playing = true;
    if (ctx.state === 'suspended') void ctx.resume();
    this.startMusic();
  }

  configure(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.music || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.sound ? 0.9 : 0, t, 0.03);
    this.music.gain.setTargetAtTime(this.settings.musicVolume * 0.35, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.settings.sfxVolume, t, 0.03);
  }

  /** Stop all sound and release the audio hardware while the game is paused or hidden. */
  setActive(active: boolean): void {
    this.playing = active;
    if (!this.ctx) return;
    if (active) {
      void this.ctx.resume();
      this.startMusic();
    } else {
      this.stopMusic();
      void this.ctx.suspend();
    }
  }

  /** Era and approaching danger (0..1) steer the music. */
  setMood(era: number, tension: number): void {
    this.era = era;
    this.tension = Math.max(0, Math.min(1, tension));
  }

  /* ------------------------------ music ------------------------------ */

  private startMusic(): void {
    if (this.timer || !this.ctx) return;
    this.timer = setInterval(() => this.musicStep(), 1400);
  }

  private stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** A slow, sparse generative line: each age leans on a different register; tension adds a beating second voice. */
  private musicStep(): void {
    const c = this.ctx;
    if (!c || !this.music || !this.playing || !this.settings.sound || this.settings.musicVolume <= 0) return;
    this.step++;
    const base = this.era * 2;
    const idx = (this.step * 3 + base + (this.step % 4 === 0 ? 2 : 0)) % SCALE.length;
    const f = SCALE[idx]!;
    this.tone(this.music, f, 'triangle', 2.4, 0.5, 0.35);
    if (this.step % 4 === 0) this.tone(this.music, f / 2, 'sine', 3.6, 0.6, 0.5);
    if (this.tension > 0.05) {
      // a flat second voice a few cents off: the closer the catastrophe, the louder the beating
      this.tone(this.music, f * 1.012, 'sine', 2.4, 0.6, 0.15 + 0.5 * this.tension);
      if (this.tension > 0.5) this.tone(this.music, SCALE[0]! / 2, 'sawtooth', 1.8, 0.4, 0.2 * this.tension);
    }
  }

  /* ------------------------------ effects ------------------------------ */

  play(name: Sfx): void {
    this.log.push(name);
    if (this.log.length > 64) this.log.shift();
    const c = this.ctx;
    if (!c || !this.sfx || !this.settings.sound || this.settings.sfxVolume <= 0) return;
    const out = this.sfx;
    switch (name) {
      case 'click':
        this.tone(out, 880, 'square', 0.05, 0.001, 0.12);
        break;
      case 'error':
        this.tone(out, 140, 'sawtooth', 0.18, 0.005, 0.25);
        break;
      case 'place':
        this.tone(out, 120, 'sine', 0.16, 0.002, 0.5);
        this.burst(out, 0.1, 900, 0.3);
        break;
      case 'complete':
        this.tone(out, 523.25, 'triangle', 0.5, 0.01, 0.35);
        this.tone(out, 783.99, 'triangle', 0.7, 0.01, 0.3, 0.12);
        break;
      case 'research':
        [392, 493.88, 587.33, 783.99].forEach((f, i) => this.tone(out, f, 'sine', 0.6, 0.01, 0.3, i * 0.1));
        break;
      case 'warning':
        this.tone(out, 98, 'sawtooth', 1.4, 0.1, 0.35);
        this.tone(out, 146.83, 'sine', 1.4, 0.1, 0.25);
        break;
      case 'story':
        this.tone(out, 659.25, 'sine', 0.9, 0.005, 0.3);
        this.tone(out, 1318.5, 'sine', 0.6, 0.005, 0.1);
        break;
      case 'begin':
        this.burst(out, 0.5, 600, 0.25);
        this.tone(out, 196, 'triangle', 0.7, 0.05, 0.3);
        break;
      case 'found':
        this.burst(out, 0.7, 1400, 0.2);
        [261.63, 329.63, 392].forEach((f, i) => this.tone(out, f, 'triangle', 0.9, 0.02, 0.25, i * 0.14));
        break;
      case 'fire':
        this.burst(out, 3.2, 1800, 0.55);
        this.tone(out, 70, 'sawtooth', 3, 0.3, 0.2);
        break;
      case 'flood':
        this.burst(out, 3.6, 500, 0.6);
        break;
      case 'quake':
        this.tone(out, 45, 'sine', 3.4, 0.05, 0.7);
        this.burst(out, 3, 220, 0.5);
        break;
      case 'ash':
        this.burst(out, 3.6, 4200, 0.25);
        this.tone(out, 82, 'sine', 3.6, 0.5, 0.3);
        break;
      case 'victory':
        [261.63, 329.63, 392, 523.25].forEach((f, i) =>
          this.tone(out, f, 'triangle', 1.4, 0.02, 0.3, i * 0.2),
        );
        break;
      case 'defeat':
        this.tone(out, 110, 'sine', 2.6, 0.2, 0.4);
        this.tone(out, 103.83, 'sine', 2.6, 0.2, 0.3);
        break;
    }
  }

  /** A single enveloped oscillator. `attack`/`level` shape the peak; the tail decays exponentially. */
  private tone(
    out: GainLike,
    freq: number,
    type: string,
    dur: number,
    attack: number,
    level: number,
    delay = 0,
  ): void {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(level, t0 + Math.max(0.002, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Filtered noise with a decaying envelope. */
  private burst(out: GainLike, dur: number, cutoff: number, level: number): void {
    const c = this.ctx;
    if (!c || !this.noise) return;
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = this.noise;
    src.loop = true;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.7;
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(level, t0 + Math.min(0.3, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  dispose(): void {
    this.stopMusic();
    this.playing = false;
    void this.ctx?.close?.();
    this.ctx = null;
    this.master = this.music = this.sfx = null;
  }
}

function browserFactory(): Factory | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: new () => CtxLike;
    webkitAudioContext?: new () => CtxLike;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? () => new Ctor() : null;
}

/** The page-wide engine. HMR-safe: a re-evaluated module reuses the existing instance. */
const g = globalThis as unknown as { __epochAudio?: AudioEngine };
export const audio: AudioEngine = (g.__epochAudio ??= new AudioEngine(browserFactory()));
