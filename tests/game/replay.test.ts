import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeHash, createCampaign, replayCampaign, transcriptOf } from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { playCampaign } from '../../src/engine/ai/bots';
import { ROUTES } from '../../src/engine/ai/routes';
import { EpochClock } from '../../src/game/clock';
import { GameStore } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;

/** Hand a finished lineage to a store, watch it again through the real clock, and return once the replay is over. */
function watch(finished: Campaign, frameMs = 100) {
  const store = new GameStore();
  store.adopt(finished);
  expect(store.watchLineage()).toBe(true);
  const clock = new EpochClock(store);
  let frames = 0;
  while (store.replay!.matched === null && frames++ < 100_000) clock.step(frameMs);
  return { store, clock, frames };
}

describe('watching a finished lineage again', () => {
  it('replays every recorded action at its tick through the clock and ends in exactly the lineage’s final state', () => {
    for (const name of ['greenvale/archivists', 'ashen/engineers', 'greenvale/builder']) {
      const t = load(name);
      const { store, frames } = watch(replayCampaign(t));
      expect(store.replay!.matched, name).toBe(true);
      expect(computeHash(store.campaign!)).toBe(t.finalHash);
      // Three ages of 600 ticks at 2× and 100 ms frames, plus the waits to read each screen: well over a few hundred.
      expect(frames).toBeGreaterThan(900);
    }
  });

  it('does the same at any speed or frame rate, and for a lineage begun with challenges', () => {
    const c = createCampaign(6001, 'standard', 'greenvale', 'normal', ['buried_library']);
    playCampaign(c, ROUTES.archivists!);
    expect(c.phase).toBe('VICTORY');
    const hash = computeHash(c);
    const a = watch(c, 16.7);
    expect([a.store.replay!.matched, computeHash(a.store.campaign!)]).toEqual([true, hash]);
    const b = new GameStore();
    b.adopt(a.store.replay!.original);
    b.watchLineage();
    b.setReplaySpeed(4);
    const clock = new EpochClock(b);
    for (let i = 0; i < 100_000 && b.replay!.matched === null; i++) clock.step(250);
    expect([b.replay!.matched, computeHash(b.campaign!)]).toEqual([true, hash]);
  });

  it('is only a viewing: no input, no save, no run card, no Codex entry, and Stop returns to the ending', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const finished = replayCampaign(load('greenvale/engineers'));
    localStorage.setItem('epoch60.save.v1', 'the saved lineage');
    const store = new GameStore();
    store.adopt(finished);
    const before = {
      runs: localStorage.getItem('epoch60.runs.v1'),
      codex: localStorage.getItem('epoch60.codex.v1'),
      branches: localStorage.getItem('epoch60.branches.v1'),
    };
    store.watchLineage();
    expect(store.dispatch({ type: 'setFocus', focus: 'food' }).ok).toBe(false);
    const clock = new EpochClock(store);
    for (let i = 0; i < 100_000 && store.replay!.matched === null; i++) clock.step(100);
    expect(store.replay!.matched).toBe(true);
    expect(localStorage.getItem('epoch60.save.v1')).toBe('the saved lineage');
    expect(localStorage.getItem('epoch60.runs.v1')).toBe(before.runs);
    expect(localStorage.getItem('epoch60.codex.v1')).toBe(before.codex);
    expect(localStorage.getItem('epoch60.branches.v1')).toBe(before.branches);
    store.stopReplay();
    expect(store.replay).toBeNull();
    expect(store.campaign).toBe(finished);
  });

  it('says so when the replay does not end where the lineage did', () => {
    const finished = replayCampaign(load('greenvale/archivists'));
    const store = new GameStore();
    store.adopt(finished);
    store.watchLineage();
    store.replay!.finalHash = 'not-this-lineage';
    const clock = new EpochClock(store);
    for (let i = 0; i < 100_000 && store.replay!.matched === null; i++) clock.step(100);
    expect(store.replay!.matched).toBe(false);
  });

  it('is offered only for a finished lineage, and never twice at once', () => {
    const store = new GameStore();
    store.adopt(createCampaign(6001));
    expect(store.watchLineage()).toBe(false);
    const finished = replayCampaign(load('greenvale/archivists'));
    store.adopt(finished);
    expect(store.watchLineage()).toBe(true);
    expect(store.watchLineage()).toBe(false);
    expect(transcriptOf(store.replay!.original).finalHash).toBe(computeHash(finished));
  });
});
