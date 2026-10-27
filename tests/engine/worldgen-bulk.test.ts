import { describe, expect, it } from 'vitest';
import { generateWorld, validateWorld } from '../../src/engine';
import { seedFromText } from '../../src/game/modes';
import { hashString } from '../../src/engine/core/hash';

/** Bulk checks over seeds a player could really type, share or be given as the daily — not just small integers. */

const seedsFromWords = (n: number) =>
  Array.from({ length: n }, (_, i) => seedFromText(`valley ${i} ${hashString(String(i)).slice(0, 4)}`)!);

describe('bulk procedural worlds', () => {
  it('1200 text-derived uint32 seeds all yield valid, bounded-time valleys (0 invalid topologies)', () => {
    const seeds = seedsFromWords(1200);
    expect(new Set(seeds).size).toBeGreaterThan(1190);
    let invalid = 0;
    const start = Date.now();
    for (const seed of seeds) {
      const w = generateWorld(seed);
      if (!validateWorld(w).ok) invalid++;
      // No NaN/out-of-range in the persistent fields.
      expect(w.height.every(Number.isFinite)).toBe(true);
      expect(w.fertility.every((v) => v >= 0 && v <= 1000)).toBe(true);
    }
    expect(invalid).toBe(0);
    // bounded: generating twelve hundred valleys must not take minutes
    expect(Date.now() - start).toBeLessThan(60_000);
  }, 120_000);

  it('the same seed always gives the same valley (10 repetitions) and different seeds give different strategy', () => {
    const sig = (seed: number) => {
      const w = generateWorld(seed);
      return {
        hearth: `${w.anchors.hearth.x},${w.anchors.hearth.y}`,
        fire: `${w.anchors.fireOrigin.x},${w.anchors.fireOrigin.y}`,
        rock: Math.round(w.rock.reduce((a, b) => a + b, 0) / 20),
        forest: Math.round(w.forest.reduce((a, b) => a + b, 0) / 20000),
        river: w.riverCenter.map((p) => Math.round(p.x / 100)).join('.'),
      };
    };
    const base = sig(6001);
    for (let i = 0; i < 10; i++) expect(sig(6001)).toEqual(base);

    const seeds = seedsFromWords(60);
    let differing = 0;
    let pairs = 0;
    for (let i = 0; i + 1 < seeds.length; i += 2) {
      const a = sig(seeds[i]!);
      const b = sig(seeds[i + 1]!);
      const keys = Object.keys(a) as (keyof typeof a)[];
      const n = keys.filter((k) => a[k] !== b[k]).length;
      pairs++;
      if (n >= 2) differing++;
    }
    // A new seed changes at least two strategic variables for the clear majority of sampled pairs.
    expect(differing / pairs).toBeGreaterThan(0.8);
  });
});
