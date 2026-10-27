import { describe, expect, it } from 'vitest';
import {
  advanceFixedTick,
  cloneCampaign,
  computeHash,
  createCampaign,
  deserialize,
  dispatchAction,
  replayCampaign,
  runTicks,
  serialize,
  transcriptOf,
} from '../../src/engine';
import type { Campaign } from '../../src/engine';
import { bestExcavation, playCampaign, type Policy } from '../../src/engine/ai/bots';
import { begin, fresh, place } from './helpers';

const builder: Policy = {
  name: 'builder',
  focus: () => 'balanced',
  wants: () => [
    { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
    { id: 'lumber', kind: 'lumber_camp', count: 1 },
    { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
    { id: 'quarry', kind: 'quarry', count: 1, from: 30 },
    { id: 'archive', kind: 'archive', count: 1, from: 80, spot: { avoidHazard: true, high: true } },
    { id: 'repair', repair: true },
  ],
  site: () => 2,
  tradition: () => 'open_hands',
  excavate: bestExcavation,
};

function playEpochOne(): Campaign {
  const c = fresh();
  c.civ.res.timber = 80 * 1000;
  place(c, 'farm', { avoidHazard: true });
  place(c, 'lumber_camp', { maxDist: 18 });
  place(c, 'cottage', { avoidHazard: true });
  begin(c);
  runTicks(c, 100);
  place(c, 'cottage', { avoidHazard: true });
  runTicks(c, 500);
  return c;
}

describe('determinism', () => {
  it('same seed + same actions = identical world hash', () => {
    expect(computeHash(playEpochOne())).toBe(computeHash(playEpochOne()));
  });

  it('different seeds diverge', () => {
    const a = createCampaign(6001);
    const b = createCampaign(6002);
    expect(computeHash(a)).not.toBe(computeHash(b));
  });

  it('a whole 3-epoch bot campaign is bit-for-bit reproducible', () => {
    const a = playCampaign(createCampaign(6001), builder).campaign;
    const b = playCampaign(createCampaign(6001), builder).campaign;
    expect(computeHash(a)).toBe(computeHash(b));
    expect(a.phase).toMatch(/VICTORY|DEFEAT/);
    expect(a.lineage.reports).toHaveLength(3);
  });

  it('is independent of how ticks are batched (a stand-in for frame rate)', () => {
    // Same advanceFixedTick calls in every variant; the frame-rate guard is tests/game/clock.test.ts.
    // 30, 60 and 120 FPS all reduce to the same ordered fixed ticks; batching must never matter.
    const run = (batch: number) => {
      const c = fresh();
      place(c, 'farm', { avoidHazard: true });
      place(c, 'cottage', { avoidHazard: true });
      begin(c);
      while (c.phase === 'ACTIVE') {
        for (let i = 0; i < batch && advanceFixedTick(c); i++);
        if (c.tick === 250) dispatchAction(c, { type: 'setFocus', focus: 'food' });
      }
      return computeHash(c);
    };
    // setFocus is stamped at tick 250 in all variants only when batch divides 250.
    expect(run(1)).toBe(run(5));
    expect(run(5)).toBe(run(25));
  });
});

describe('save and load', () => {
  it('round-trips a mid-epoch state exactly and resumes paused', () => {
    const c = playEpochOne();
    const d = fresh();
    place(d, 'farm', { avoidHazard: true });
    begin(d);
    runTicks(d, 286);
    const text = serialize(d);
    const loaded = deserialize(text);
    expect(loaded.paused).toBe(true);
    expect(loaded.tick).toBe(286);
    loaded.paused = false;
    expect(computeHash(loaded)).toBe(computeHash(d));
    void c;
  });

  it('save/load at tick 1, 300 and 599 leads to the same final outcome as playing straight through', () => {
    const script = (c: Campaign) => {
      place(c, 'farm', { avoidHazard: true });
      place(c, 'lumber_camp', { maxDist: 18 });
      place(c, 'cottage', { avoidHazard: true });
      begin(c);
    };
    const straight = fresh();
    script(straight);
    runTicks(straight, 600);
    const expected = computeHash(straight);
    for (const at of [1, 300, 599]) {
      const c = fresh();
      script(c);
      runTicks(c, at);
      const loaded = deserialize(serialize(c));
      loaded.paused = false;
      runTicks(loaded, 600 - at);
      expect(loaded.tick).toBe(600);
      expect(computeHash(loaded)).toBe(expected);
      expect(loaded.lineage.reports).toHaveLength(1);
    }
  });

  it('save/load of a queued but unapplied action does not lose or duplicate it', () => {
    const c = fresh();
    begin(c);
    runTicks(c, 10);
    place(c, 'cottage', { avoidHazard: true });
    expect(c.queue).toHaveLength(1);
    const loaded = deserialize(serialize(c));
    loaded.paused = false;
    runTicks(loaded, 1);
    runTicks(c, 1);
    expect(loaded.structures.filter((s) => s.kind === 'cottage')).toHaveLength(1);
    expect(computeHash(loaded)).toBe(computeHash(c));
  });

  it('rejects corrupted, tampered, or wrong-schema saves', () => {
    const c = fresh();
    const text = serialize(c);
    expect(() => deserialize('not json')).toThrow();
    expect(() => deserialize(text.replace('"pop":10', '"pop":99'))).toThrow(/integrity/);
    const bad = JSON.parse(text);
    bad.schema = 999;
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/schema/);
  });
});

describe('replay', () => {
  it('rebuilds the same final state from a seed and the accepted-action log', () => {
    const src = playCampaign(createCampaign(6001), builder).campaign;
    const t = transcriptOf(src);
    const replayed = replayCampaign(t);
    expect(computeHash(replayed)).toBe(t.finalHash);
    expect(replayed.phase).toBe(src.phase);
    expect(replayed.lineage.reports.map((r) => r.survivors)).toEqual(
      src.lineage.reports.map((r) => r.survivors),
    );
  });

  it('a clone is independent of the original', () => {
    const c = playEpochOne();
    const d = cloneCampaign(c);
    d.civ.pop = 1;
    expect(c.civ.pop).not.toBe(1);
  });
});
