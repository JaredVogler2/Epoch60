import { deserialize, serialize } from '../engine';
import type { Campaign } from '../engine';
import { safeStorage } from './persist';

/**
 * Branch points: the lineage as it stood when each later age was founded, kept so a player can go back and play that
 * age again ("what if the second age had built a Dam?"). A lineage resumed from one is a branch: it plays normally and
 * its feats count, but its run card is marked and never ranked against straight lineages. Only the current lineage's
 * points are kept (a new lineage clears them), and stored data is untrusted: anything that does not load as this
 * lineage at that age is ignored.
 */

interface BranchPoint {
  seed: number;
  scenario: string;
  difficulty: string;
  mode: string;
  /** The lineage's challenges (absent: none). */
  modifiers?: string[];
  epoch: number;
  save: string;
}

const BRANCHES_KEY = 'epoch60.branches.v1';
/** The age a saved lineage was last replayed from (kept beside the save, which is engine state and knows no branches). */
const BRANCH_TAG_KEY = 'epoch60.save-branch.v1';

const sameLineage = (p: BranchPoint, c: Campaign) =>
  p.seed === c.seed &&
  p.scenario === c.scenario &&
  p.difficulty === c.difficulty &&
  p.mode === c.mode &&
  (p.modifiers ?? []).join() === (c.modifiers ?? []).join();

function load(): BranchPoint[] {
  try {
    const raw = safeStorage()?.getItem(BRANCHES_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    return v.filter(
      (p): p is BranchPoint =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as BranchPoint).seed === 'number' &&
        typeof (p as BranchPoint).scenario === 'string' &&
        typeof (p as BranchPoint).difficulty === 'string' &&
        typeof (p as BranchPoint).mode === 'string' &&
        Number.isInteger((p as BranchPoint).epoch) &&
        typeof (p as BranchPoint).save === 'string' &&
        ((p as BranchPoint).modifiers === undefined || Array.isArray((p as BranchPoint).modifiers)),
    );
  } catch {
    return [];
  }
}

function store(points: BranchPoint[]): void {
  try {
    safeStorage()?.setItem(BRANCHES_KEY, JSON.stringify(points));
  } catch {
    /* quota or disabled storage: the lineage plays on, only without a way back */
  }
}

/**
 * Points are whole saves, and a long chronicle's grow past half a million characters each: only the newest points that
 * fit in this many characters are kept, so the lineage's own save always has room in the browser's storage.
 */
export const BRANCH_BUDGET = 2_000_000;

/** Remember the lineage as it stands at the start of this age (a later age replaces nothing earlier). */
export function saveBranchPoint(c: Campaign, budget = BRANCH_BUDGET): void {
  if (c.phase !== 'PREPARE' || c.epoch < 1) return;
  const points = [
    ...load().filter((p) => sameLineage(p, c) && p.epoch !== c.epoch),
    {
      seed: c.seed,
      scenario: c.scenario,
      difficulty: c.difficulty,
      mode: c.mode,
      ...(c.modifiers ? { modifiers: [...c.modifiers] } : {}),
      epoch: c.epoch,
      save: serialize(c),
    },
  ].sort((a, b) => a.epoch - b.epoch);
  // Measured as stored (each save is itself JSON, so its quotes are escaped once more); the oldest go first and the
  // newest point is always kept.
  while (points.length > 1 && JSON.stringify(points).length > budget) points.shift();
  store(points);
}

/** The ages this lineage can be replayed from, earliest first. */
export function branchPoints(c: Campaign): number[] {
  return load()
    .filter((p) => sameLineage(p, c) && p.epoch >= 1 && p.epoch <= c.epoch)
    .map((p) => p.epoch)
    .sort((a, b) => a - b);
}

/**
 * The lineage as it stood when `epoch` was founded, or null when there is no usable point (missing, damaged, from
 * another lineage). Points after it belong to the timeline being left and are dropped.
 */
export function takeBranch(c: Campaign, epoch: number): Campaign | null {
  const all = load();
  const p = all.find((x) => sameLineage(x, c) && x.epoch === epoch);
  if (!p) return null;
  let restored: Campaign;
  try {
    restored = deserialize(p.save);
  } catch {
    return null;
  }
  if (!sameLineage(p, restored) || restored.epoch !== epoch || restored.phase !== 'PREPARE') return null;
  store(all.filter((x) => sameLineage(x, c) && x.epoch <= epoch));
  return restored;
}

export function clearBranchPoints(): void {
  try {
    safeStorage()?.removeItem(BRANCHES_KEY);
    safeStorage()?.removeItem(BRANCH_TAG_KEY);
  } catch {
    /* ignore */
  }
}

/** Remember (or forget, with null) that the saved lineage with this seed was replayed from `epoch`. */
export function saveBranchTag(seed: number, epoch: number | null): void {
  try {
    if (epoch === null) safeStorage()?.removeItem(BRANCH_TAG_KEY);
    else safeStorage()?.setItem(BRANCH_TAG_KEY, JSON.stringify({ seed, epoch }));
  } catch {
    /* ignore */
  }
}

/** The age the saved lineage with this seed was replayed from, or null for a straight lineage. */
export function loadBranchTag(seed: number): number | null {
  try {
    const raw = safeStorage()?.getItem(BRANCH_TAG_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { seed?: unknown; epoch?: unknown };
    return v.seed === seed && Number.isInteger(v.epoch) && (v.epoch as number) >= 1
      ? (v.epoch as number)
      : null;
  } catch {
    return null;
  }
}
