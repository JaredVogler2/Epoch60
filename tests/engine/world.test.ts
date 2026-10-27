import { describe, expect, it } from 'vitest';
import { generateWorld, validateWorld } from '../../src/engine';
import { hashValue } from '../../src/engine/core/hash';
import { idx } from '../../src/engine/world/query';

describe('world generation', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = generateWorld(6001);
    const b = generateWorld(6001);
    expect(hashValue(a)).toBe(hashValue(b));
    expect(hashValue(generateWorld(6002))).not.toBe(hashValue(a));
  });

  it('produces a valid, playable valley for 300 seeds', () => {
    const bad: number[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const w = generateWorld(seed);
      const v = validateWorld(w);
      if (!v.ok) bad.push(seed);
    }
    expect(bad).toEqual([]);
  });

  it('has a continuous river, reachable stone, fertile land and a fuel corridor', () => {
    const w = generateWorld(6001);
    const v = validateWorld(w);
    expect(v.problems).toEqual([]);
    expect(v.stats.rockReach).toBeGreaterThan(250);
    expect(v.stats.fertileReach).toBeGreaterThan(40);
    expect(w.forest[idx(w.anchors.fireOrigin.x, w.anchors.fireOrigin.y)]).toBeGreaterThan(300);
  });

  it('keeps every scalar field an integer inside its documented range', () => {
    const w = generateWorld(77);
    for (let i = 0; i < w.height.length; i++) {
      for (const f of [w.fertility, w.forest, w.scar, w.silt, w.erosion, w.pollution]) {
        expect(Number.isInteger(f[i])).toBe(true);
        expect(f[i]).toBeGreaterThanOrEqual(0);
        expect(f[i]).toBeLessThanOrEqual(1000);
      }
      expect(Number.isInteger(w.height[i])).toBe(true);
      expect(w.rock[i]).toBeGreaterThanOrEqual(0);
    }
  });
});
