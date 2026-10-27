import { describe, expect, it } from 'vitest';
import { DprGovernor, percentile } from '../../src/render/governor';

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

  it('leaves a healthy device alone', () => {
    const g = new DprGovernor(desktop);
    expect(feed(g, 15, 900)).toEqual([]);
    expect(g.dpr).toBe(2);
  });

  it('ignores hitches: one slow window, tab-switch gaps and garbage values never trigger a change', () => {
    const g = new DprGovernor(phone);
    expect(feed(g, 1000, 500)).toEqual([]);
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
