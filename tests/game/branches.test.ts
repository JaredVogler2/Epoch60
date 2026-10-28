import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_AGES, computeHash, dispatchAction, replayCampaign, runTicks } from '../../src/engine';
import type { Transcript } from '../../src/engine';
import { branchPoints, saveBranchPoint } from '../../src/game/branches';
import { bestFor } from '../../src/game/modes';
import { store } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;
/** Index just past the n-th founding in a transcript. */
const afterFounding = (t: Transcript, n: number) => {
  let seen = 0;
  return t.actions.findIndex((a) => a.action.type === 'found' && ++seen === n) + 1;
};

/** Play a recorded transcript through the store, as the buttons and the clock do, from entry `from`. */
function play(t: Transcript, from = 0, upto = t.actions.length): void {
  if (from === 0) store.newGame(t.seed, t.mode, t.scenario, t.difficulty ?? 'normal');
  const c = () => store.campaign!;
  for (const entry of t.actions.slice(from, upto)) {
    while (c().phase === 'ACTIVE' && c().tick < entry.tick) {
      const n = runTicks(c(), entry.tick - c().tick);
      store.notifyTicks(n);
      if (!n) break;
    }
    const r = store.dispatch(entry.action, { quiet: true });
    if (!r.ok) throw new Error(`refused ${JSON.stringify(entry.action)}: ${r.message}`);
  }
  if (upto < t.actions.length) return;
  while (c().totalTicks < t.totalTicks) {
    const n = runTicks(c(), t.totalTicks - c().totalTicks);
    store.notifyTicks(n);
    if (!n) break;
  }
}

describe('branching from the founding of an age', () => {
  it('each later age leaves a point to come back to, and a new lineage clears them', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/archivists');
    play(t);
    expect(computeHash(store.campaign!)).toBe(t.finalHash);
    expect(store.campaign!.phase).toBe('VICTORY');
    expect(store.branchAges()).toEqual([1, 2]);
    store.newGame(1234);
    expect(store.branchAges()).toEqual([]);
    expect(localStorage.getItem('epoch60.branches.v1')).toBeNull();
  });

  it('replaying an age restores the lineage exactly as that age was founded', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/builder');
    const k = afterFounding(t, 2);
    const expected = computeHash(replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 }));
    play(t);
    expect(store.campaign!.phase).toBe('DEFEAT');
    expect(store.branchFrom(2)).toBe(true);
    expect(store.campaign!.phase).toBe('PREPARE');
    expect(store.campaign!.epoch).toBe(2);
    expect(computeHash(store.campaign!)).toBe(expected);
    expect(store.branch).toBe(2);
  });

  it('a replayed age drops the later points of the timeline it leaves, and the new timeline makes its own', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/builder');
    play(t);
    expect(store.branchFrom(1)).toBe(true);
    const kept = JSON.parse(localStorage.getItem('epoch60.branches.v1')!) as { epoch: number }[];
    expect(kept.map((p) => p.epoch)).toEqual([1]);
    // Play the same second age again: its founding of the third age is a new point.
    play(t, afterFounding(t, 1));
    expect(store.campaign!.phase).toBe('DEFEAT');
    expect(store.branchAges()).toEqual([1, 2]);
  });

  it("a branch's run card is marked and never ranked against straight lineages", () => {
    vi.stubGlobal('localStorage', memoryStorage());
    store.runs = [];
    const t = load('greenvale/builder');
    play(t);
    const straight = store.runs[0]!;
    expect(straight.branch).toBeUndefined();
    store.branchFrom(2);
    play(t, afterFounding(t, 2));
    const branched = store.runs[0]!;
    expect(branched.branch).toBe(2);
    const spec = { seed: t.seed, scenario: t.scenario, difficulty: t.difficulty ?? 'normal' };
    expect(bestFor(store.runs, spec)?.id).toBe(straight.id);
    expect(bestFor([branched], spec)).toBeNull();
  });

  it('the branch mark survives a reload, and is trusted only for its own seed', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/builder');
    play(t);
    store.branchFrom(2);
    store.quitToTitle();
    store.branch = null;
    expect(store.continueGame()).toBe(true);
    expect(store.branch).toBe(2);
    localStorage.setItem('epoch60.save-branch.v1', JSON.stringify({ seed: t.seed + 1, epoch: 2 }));
    store.quitToTitle();
    expect(store.continueGame()).toBe(true);
    expect(store.branch).toBeNull();
  });

  it('a long chronicle keeps only its newest points, within the storage budget', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = replayCampaign(load('greenvale/archivists'));
    dispatchAction(c, { type: 'endure' });
    // Each later age's founding, as far as the stored point is concerned: the lineage at the start of an age.
    c.phase = 'PREPARE';
    const foundAll = (budget: number) => {
      localStorage.removeItem('epoch60.branches.v1');
      for (let e = 1; e < MAX_AGES; e++) {
        c.epoch = e;
        saveBranchPoint(c, budget);
      }
    };
    foundAll(Infinity);
    expect(branchPoints(c)).toHaveLength(MAX_AGES - 1);
    // The budget is measured as stored, each save escaped once more inside the list: exactly the newest three fit...
    const all = JSON.parse(localStorage.getItem('epoch60.branches.v1')!) as unknown[];
    const three = JSON.stringify(all.slice(-3)).length;
    foundAll(three);
    expect(branchPoints(c)).toEqual([MAX_AGES - 3, MAX_AGES - 2, MAX_AGES - 1]);
    // ...and one character less leaves room for only two.
    foundAll(three - 1);
    expect(branchPoints(c)).toEqual([MAX_AGES - 2, MAX_AGES - 1]);
    expect(localStorage.getItem('epoch60.branches.v1')!.length).toBeLessThanOrEqual(three - 1);
    // However small the budget, the newest point is kept.
    saveBranchPoint(c, 1);
    expect(branchPoints(c)).toEqual([MAX_AGES - 1]);
  });

  it('damaged or foreign points are ignored, never loaded', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/builder');
    play(t);
    const points = JSON.parse(localStorage.getItem('epoch60.branches.v1')!) as {
      save: string;
      seed: number;
    }[];
    // A point whose save was edited fails its integrity check; one from another seed is not this lineage.
    localStorage.setItem(
      'epoch60.branches.v1',
      JSON.stringify([
        { ...points[0], save: points[0]!.save.replace('"pop":', '"pop":1') },
        { ...points[1], seed: t.seed + 1 },
      ]),
    );
    expect(store.branchFrom(1)).toBe(false);
    expect(store.branchFrom(2)).toBe(false);
    expect(store.campaign!.phase).toBe('DEFEAT');
    localStorage.setItem('epoch60.branches.v1', '{not json');
    expect(store.branchAges()).toEqual([]);
  });
});
