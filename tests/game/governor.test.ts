import { describe, expect, it } from 'vitest';
import { DprGovernor, SLOW_RUN, percentile } from '../../src/render/governor';

const desktop = { budgetMs: 1000 / 60, minDpr: 0.6, maxDpr: 2 };
const phone = { budgetMs: 1000 / 30, minDpr: 0.6, maxDpr: 1.75 };

/** Feed `n` identical frames; return the sequence of pixel-ratio changes. */
function feed(g: DprGovernor, ms: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = g.sample(ms);
    if (r !== null) out.push(r);
  }
  return out;
}

describe('adaptive pixel ratio', () => {
  it('steps resolution down when frames miss the budget, and stops at the floor', () => {
    const g = new DprGovernor(desktop);
    const steps = feed(g, 50, 90 * 20);
    expect(steps.length).toBeGreaterThan(3);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeLessThan(steps[i - 1]!);
    expect(g.dpr).toBe(0.6);
    expect(feed(g, 50, 900)).toEqual([]);
  });

  it('reports sustained strain only once resolution is already at the floor, and forgets it when frames recover', () => {
    const g = new DprGovernor(desktop);
    feed(g, 50, 90 * 20);
    expect(g.dpr).toBe(0.6);
    const before = g.strained;
    feed(g, 50, 90 * 3);
    expect(g.strained).toBe(before + 3);
    feed(g, 15, 90);
    expect(g.strained).toBe(0);
    const fresh = new DprGovernor(desktop);
    feed(fresh, 50, 90);
    expect(fresh.strained).toBe(0); // the first answer to slow frames is lower resolution, not fewer effects
  });

  it('leaves a healthy device alone', () => {
    const g = new DprGovernor(desktop);
    expect(feed(g, 15, 900)).toEqual([]);
    expect(g.dpr).toBe(2);
  });

  it('ignores hitches: isolated tab-switch gaps and garbage values never trigger a change', () => {
    const g = new DprGovernor(phone);
    for (let i = 0; i < 100; i++) {
      expect(feed(g, 1000, 1)).toEqual([]);
      expect(feed(g, 33, 3)).toEqual([]);
    }
    expect(g.sample(Number.NaN)).toBeNull();
    expect(g.sample(-5)).toBeNull();
    expect(g.sample(0)).toBeNull();
    expect(feed(g, 33, 180)).toEqual([]);
  });

  it('recovers resolution slowly after a long calm stretch, never above the cap', () => {
    const g = new DprGovernor(phone);
    feed(g, 80, 90 * 3);
    const low = g.dpr;
    expect(low).toBeLessThan(1.75);
    feed(g, 8, 90 * 2);
    expect(g.dpr).toBe(low); // not yet: recovery needs a sustained calm
    feed(g, 8, 90 * 40);
    expect(g.dpr).toBe(1.75);
  });

  it('a device far below budget (every frame over 250 ms) still steps down, then strains at the floor', () => {
    const g = new DprGovernor(phone);
    const steps = feed(g, 400, SLOW_RUN * 12);
    expect(steps.length).toBeGreaterThan(3);
    expect(g.dpr).toBe(0.6);
    const before = g.strained;
    feed(g, 400, SLOW_RUN * 2);
    expect(g.strained).toBe(before + 2);
  });

  it('a lone long frame is a hitch, not a trend', () => {
    const g = new DprGovernor(desktop);
    for (let i = 0; i < 40; i++) {
      expect(feed(g, 900, SLOW_RUN - 1)).toEqual([]);
      expect(feed(g, 10, 5)).toEqual([]);
    }
    expect(g.dpr).toBe(2);
    expect(g.strained).toBe(0);
  });

  it('holds when frame time sits between the thresholds (no flapping)', () => {
    const g = new DprGovernor(desktop);
    expect(feed(g, 18, 90 * 30)).toEqual([]);
    expect(g.dpr).toBe(2);
  });

  it('percentiles are order-independent and bounded', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 100], 95)).toBe(100);
    expect(percentile([7], 99)).toBe(7);
  });
});
