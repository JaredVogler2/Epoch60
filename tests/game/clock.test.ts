import { describe, expect, it } from 'vitest';
import { computeHash, EPOCH_TICKS } from '../../src/engine';
import type { Campaign } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { EpochClock, MAX_TICKS_PER_FRAME, STALL_MS } from '../../src/game/clock';
import { GameStore } from '../../src/game/store';

function newStore(mode: 'standard' | 'assisted' = 'standard'): {
  store: GameStore;
  clock: EpochClock;
  c: Campaign;
} {
  const store = new GameStore();
  store.newGame(6001, mode);
  const clock = new EpochClock(store);
  return { store, clock, c: store.campaign! };
}

function plan(store: GameStore): void {
  const c = store.campaign!;
  for (const kind of ['farm', 'lumber_camp', 'cottage'] as const) {
    const spot = findSpot(c, kind, { avoidHazard: true, maxDist: 18 })!;
    expect(store.dispatch({ type: 'build', kind, x: spot.x, y: spot.y, rot: spot.rot }).ok).toBe(true);
  }
  expect(store.dispatch({ type: 'beginEpoch' }).ok).toBe(true);
}

/** Run frames of `frameMs` until the campaign reaches `tick` (without overshooting), then return. */
function runFramesTo(clock: EpochClock, c: Campaign, tick: number, frameMs: number): number {
  let frames = 0;
  while (c.phase === 'ACTIVE' && c.tick < tick) {
    clock.step(frameMs);
    frames++;
    if (frames > 1_000_000) throw new Error('runaway');
  }
  return frames;
}

describe('EpochClock', () => {
  it('runs exactly 600 ticks of a 60 s epoch at 60 FPS and no more', () => {
    const { store, clock, c } = newStore();
    plan(store);
    const frames = runFramesTo(clock, c, EPOCH_TICKS, 1000 / 60);
    expect(c.tick).toBe(EPOCH_TICKS);
    expect(c.phase).toBe('COLLAPSING');
    // ~3600 frames of 16.7 ms = 60 s of foreground time.
    expect(frames).toBeGreaterThan(3590);
    expect(frames).toBeLessThan(3620);
    for (let i = 0; i < 1000; i++) clock.step(16.7);
    expect(c.tick).toBe(EPOCH_TICKS);
  });

  it('produces an identical world hash at 30, 60 and 120 FPS for the same tick-stamped schedule', () => {
    const hashes = [30, 60, 120].map((fps) => {
      const { store, clock, c } = newStore();
      c.civ.res.timber += 40_000; // enough for a mid-epoch cottage
      plan(store);
      runFramesTo(clock, c, 200, 1000 / fps);
      const spot = findSpot(c, 'cottage', { avoidHazard: true })!;
      store.dispatch({ type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: spot.rot });
      runFramesTo(clock, c, 450, 1000 / fps);
      store.dispatch({ type: 'setFocus', focus: 'food' });
      runFramesTo(clock, c, EPOCH_TICKS, 1000 / fps);
      return computeHash(c);
    });
    expect(hashes[1]).toBe(hashes[0]);
    expect(hashes[2]).toBe(hashes[0]);
  });

  it('freezes while paused or hidden, even across ten minutes of wall time', () => {
    const { store, clock, c } = newStore();
    plan(store);
    runFramesTo(clock, c, 120, 16.7);
    store.pause('hidden');
    const snap = computeHash(c);
    for (let i = 0; i < 36_000; i++) clock.step(16.7); // 10 minutes of frames while hidden
    expect(c.tick).toBe(120);
    expect(computeHash(c)).toBe(snap);
    expect(store.pauseReason).toBe('hidden');
    store.resume();
    clock.step(900); // the frame straddling resume is discarded: no time is owed for the pause
    expect(c.tick).toBe(120);
    clock.step(100);
    expect(c.tick).toBe(121);
  });

  it('a render hitch (under the stall limit) never fast-forwards the simulation', () => {
    const { store, clock, c } = newStore();
    plan(store);
    runFramesTo(clock, c, 30, 16.7);
    const before = c.tick;
    const ran = clock.step(2000); // a 2 s hitch
    expect(ran).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(c.tick - before).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(c.paused).toBe(false);
  });

  it('a huge frame gap is a stall: it pauses with an explanation instead of fast-forwarding', () => {
    const { store, clock, c } = newStore();
    plan(store);
    runFramesTo(clock, c, 50, 16.7);
    const before = c.tick;
    clock.step(STALL_MS + 1);
    expect(c.paused).toBe(true);
    expect(store.pauseReason).toBe('stalled');
    expect(c.tick).toBe(before);
  });

  it('clamps catch-up per frame and ignores negative or non-finite deltas', () => {
    const { store, clock, c } = newStore();
    plan(store);
    const ran = clock.step(900);
    expect(ran).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    clock.reset();
    const t = c.tick;
    clock.step(-500);
    clock.step(Number.NaN);
    clock.step(Number.POSITIVE_INFINITY);
    expect(c.tick).toBe(t);
    store.pause('user');
  });

  it('does not run before Begin or after the epoch ends', () => {
    const { clock, c } = newStore();
    expect(c.phase).toBe('PREPARE');
    for (let i = 0; i < 100; i++) clock.step(100);
    expect(c.tick).toBe(0);
  });

  it('assisted mode plays the same 600 ticks at half speed (twice the frames)', () => {
    const a = newStore('standard');
    plan(a.store);
    const fa = runFramesTo(a.clock, a.c, EPOCH_TICKS, 16.7);
    const b = newStore('assisted');
    plan(b.store);
    const fb = runFramesTo(b.clock, b.c, EPOCH_TICKS, 16.7);
    expect(b.c.tick).toBe(EPOCH_TICKS);
    expect(fb / fa).toBeGreaterThan(1.9);
    expect(fb / fa).toBeLessThan(2.1);
    // Same ticks and same schedule: the only differing state is the mode label.
    expect(b.c.mode).toBe('assisted');
    expect(b.c.civ.pop).toBe(a.c.civ.pop);
  });

  it('double-clicking Begin cannot start a second epoch or reset the clock', () => {
    const { store, clock, c } = newStore();
    plan(store);
    runFramesTo(clock, c, 77, 16.7);
    expect(store.dispatch({ type: 'beginEpoch' }, { quiet: true }).ok).toBe(false);
    expect(c.tick).toBe(77);
  });
});

describe('GameStore', () => {
  it('bumps revisions only when the world or structures actually change', () => {
    const { store, clock, c } = newStore();
    plan(store);
    const w0 = store.worldRev;
    const s0 = store.structRev;
    runFramesTo(clock, c, 20, 16.7);
    expect(store.structRev).toBeGreaterThan(s0);
    const s1 = store.structRev;
    runFramesTo(clock, c, 21, 16.7);
    expect(store.structRev).toBe(s1);
    expect(store.worldRev).toBeGreaterThanOrEqual(w0);
  });

  it('caches the forecast until the world changes', () => {
    const { store } = newStore();
    const a = store.getForecastCached();
    const b = store.getForecastCached();
    expect(a).toBe(b);
    expect(a!.kind).toBe('fire');
  });

  it('placement mode: ghost reflects engine legality; confirming queues a plan', () => {
    const { store, c } = newStore();
    const spot = findSpot(c, 'cottage', { avoidHazard: true })!;
    store.startPlacing('cottage');
    store.hoverCell(spot.x + 1, spot.y + 1);
    expect(store.ghost?.ok).toBe(true);
    const h = c.world.anchors.hearth;
    store.hoverCell(h.x + 1, h.y + 1);
    expect(store.ghost?.ok).toBe(false);
    store.hoverCell(spot.x + 1, spot.y + 1);
    expect(store.confirmPlacing().ok).toBe(true);
    expect(c.queue).toHaveLength(1);
    expect(store.placing).toBeNull();
  });
});
