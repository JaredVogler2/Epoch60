import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceFixedTick, createCampaign, dispatchAction, runTicks, UNIT } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { AudioEngine } from '../../src/game/audio';
import type { AudioParamLike, CtxLike, GainLike } from '../../src/game/audio';
import { NOTHING_SEEN, soundsFor } from '../../src/game/audioBridge';

function param(): AudioParamLike & { targets: number[] } {
  const targets: number[] = [];
  return {
    value: 0,
    targets,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: (v: number) => {
      targets.push(v);
    },
  };
}

interface Fake extends CtxLike {
  oscillators: number;
  noiseSources: number;
  gains: (GainLike & { gain: ReturnType<typeof param> })[];
  suspended: number;
  resumed: number;
  closed: number;
}

function fake(): Fake {
  const f: Fake = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'suspended',
    destination: {},
    oscillators: 0,
    noiseSources: 0,
    gains: [],
    suspended: 0,
    resumed: 0,
    closed: 0,
    resume: async () => {
      f.state = 'running';
      f.resumed++;
    },
    suspend: async () => {
      f.state = 'suspended';
      f.suspended++;
    },
    close: async () => {
      f.closed++;
    },
    createOscillator: () => {
      f.oscillators++;
      return {
        type: '',
        frequency: param(),
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createGain: () => {
      const g = { gain: param(), connect: () => undefined };
      f.gains.push(g);
      return g;
    },
    createBiquadFilter: () => ({ type: '', frequency: param(), Q: param(), connect: () => undefined }),
    createBufferSource: () => {
      f.noiseSources++;
      return {
        buffer: null,
        loop: false,
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return f;
}

afterEach(() => vi.useRealTimers());

describe('audio engine (graph and policy; not how it sounds)', () => {
  it('creates nothing until a user gesture, then exactly one context however often it is unlocked', () => {
    let made = 0;
    const ctx = fake();
    const a = new AudioEngine(() => {
      made++;
      return ctx;
    });
    a.play('place');
    expect(made).toBe(0);
    expect(a.unlocked).toBe(false);
    a.unlock();
    a.unlock();
    a.unlock();
    expect(made).toBe(1);
    expect(a.unlocked).toBe(true);
    expect(ctx.resumed).toBeGreaterThan(0);
    a.dispose();
    expect(ctx.closed).toBe(1);
  });

  it('is a silent no-op where Web Audio does not exist', () => {
    const a = new AudioEngine(null);
    a.unlock();
    expect(() => a.play('victory')).not.toThrow();
    expect(a.unlocked).toBe(false);
  });

  it('mutes: the master gain goes to zero and effects stop being synthesised', () => {
    const ctx = fake();
    const a = new AudioEngine(() => ctx);
    a.unlock();
    a.configure({ sound: false });
    const master = ctx.gains[0]!;
    expect(master.gain.targets.at(-1)).toBe(0);
    const before = ctx.oscillators;
    a.play('complete');
    a.play('fire');
    expect(ctx.oscillators).toBe(before);
    a.configure({ sound: true });
    expect(master.gain.targets.at(-1)).toBeGreaterThan(0);
    a.play('complete');
    expect(ctx.oscillators).toBeGreaterThan(before);
  });

  it('keeps music and effects on separate, independently scaled buses', () => {
    const ctx = fake();
    const a = new AudioEngine(() => ctx);
    a.unlock();
    a.configure({ musicVolume: 0, sfxVolume: 1 });
    const [, music, sfx] = ctx.gains;
    expect(music!.gain.targets.at(-1)).toBe(0);
    expect(sfx!.gain.targets.at(-1)).toBe(1);
    a.configure({ musicVolume: 1, sfxVolume: 0 });
    expect(music!.gain.targets.at(-1)).toBeGreaterThan(0);
    expect(sfx!.gain.targets.at(-1)).toBe(0);
  });

  it('suspends the hardware when paused or hidden and resumes cleanly', () => {
    vi.useFakeTimers();
    const ctx = fake();
    const a = new AudioEngine(() => ctx);
    a.unlock();
    vi.advanceTimersByTime(3000);
    const music = ctx.oscillators;
    expect(music).toBeGreaterThan(0);
    a.setActive(false);
    expect(ctx.suspended).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(ctx.oscillators).toBe(music); // no music is scheduled while suspended
    a.setActive(true);
    expect(ctx.state).toBe('running');
    vi.advanceTimersByTime(3000);
    expect(ctx.oscillators).toBeGreaterThan(music);
  });

  it('adds a beating second voice as the catastrophe nears, without duplicating music timers', () => {
    vi.useFakeTimers();
    const calm = fake();
    const a = new AudioEngine(() => calm);
    a.unlock();
    a.unlock();
    a.setMood(0, 0);
    vi.advanceTimersByTime(14_000);
    const calmVoices = calm.oscillators;
    const tense = fake();
    const b = new AudioEngine(() => tense);
    b.unlock();
    b.setMood(0, 1);
    vi.advanceTimersByTime(14_000);
    expect(tense.oscillators).toBeGreaterThan(calmVoices);
  });

  it('bounds its own debug log', () => {
    const a = new AudioEngine(null);
    for (let i = 0; i < 500; i++) a.play('click');
    expect(a.log.length).toBeLessThanOrEqual(64);
  });
});

describe('what the game sounds like (event → sound mapping)', () => {
  const started = () => {
    const c = createCampaign(6001);
    c.civ.res.timber = 200 * UNIT;
    return c;
  };

  it('plays nothing for an empty or freshly loaded campaign beyond the last few events', () => {
    expect(soundsFor(NOTHING_SEEN, null).sfx).toEqual([]);
    const c = started();
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 200);
    const loaded = soundsFor(NOTHING_SEEN, c);
    expect(loaded.sfx.length).toBeLessThanOrEqual(3);
  });

  it('marks the start of an age, each construction milestone and each forecast warning', () => {
    const c = started();
    let seen = soundsFor(NOTHING_SEEN, c).next;
    const spot = findSpot(c, 'cottage', { maxDist: 10 })!;
    dispatchAction(c, { type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: 0 });
    dispatchAction(c, { type: 'beginEpoch' });
    c.civ.focus = 'build';
    const heard: string[] = [];
    for (let i = 0; i < 580; i++) {
      advanceFixedTick(c);
      const r = soundsFor(seen, c);
      seen = r.next;
      heard.push(...r.sfx);
    }
    expect(heard).toContain('begin');
    expect(heard).toContain('place');
    expect(heard).toContain('complete');
    expect(heard).toContain('warning');
  });

  it('plays the hazard’s own sound when the collapse begins, and a verdict at the end', () => {
    for (const [scenario, epoch, hazard] of [
      ['greenvale', 0, 'fire'],
      ['greenvale', 1, 'flood'],
      ['greenvale', 2, 'quake'],
      ['ashen', 2, 'ash'],
    ] as const) {
      const c = createCampaign(6001, 'standard', scenario);
      c.epoch = epoch;
      c.civ.res.food = 400 * UNIT;
      dispatchAction(c, { type: 'beginEpoch' });
      runTicks(c, 599);
      const seen = soundsFor(NOTHING_SEEN, c).next;
      runTicks(c, 1);
      expect(c.phase).toBe('COLLAPSING');
      const r = soundsFor(seen, c);
      expect(r.sfx, hazard).toContain(hazard);
    }
  });

  it('raises tension only in the last seconds of an active epoch', () => {
    const c = started();
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 100);
    expect(soundsFor(NOTHING_SEEN, c).tension).toBe(0);
    runTicks(c, 480);
    expect(soundsFor(NOTHING_SEEN, c).tension).toBeGreaterThan(0.5);
  });
});
