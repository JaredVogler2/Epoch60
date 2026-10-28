import { hashString } from '../engine/core/hash';
import {
  DIFFICULTY,
  RULES_VERSION,
  SCENARIOS,
  checkModifiers,
  chronicleEnding,
  earlierLandmarks,
  legacyOf,
} from '../engine';
import type { Campaign, Difficulty, GameMode, ModifierId } from '../engine';
import { safeStorage } from './persist';

/**
 * Ways to start a lineage beyond the story: a shared seed, today's Daily Ruins, or a random expedition.
 * Everything here is validated, bounded and pure; a seed or URL can never carry code or unexpected state.
 */

export interface RunSpec {
  seed: number;
  scenario: string;
  difficulty: Difficulty;
  /** UTC date (YYYY-MM-DD) when this is the daily challenge. */
  daily?: string;
  /** The challenges it begins with, in canonical order (absent: none). */
  modifiers?: ModifierId[];
}

export const MAX_SEED = 0xffffffff;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A seed typed by a person: a number is used as is; any other text is hashed to a stable uint32. */
export function seedFromText(text: string): number | null {
  const t = text.trim();
  if (!t || t.length > 64) return null;
  if (/^\d{1,10}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= MAX_SEED ? n : null;
  }
  const h = parseInt(hashString(t).slice(-8), 16) >>> 0;
  return h === 0 ? 1 : h;
}

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's challenge: one seed, one scenario, pinned to Normal, identical for everyone on that UTC date. */
export function dailyRun(date: string): RunSpec {
  const day = DATE_RE.test(date) ? date : '2000-01-01';
  const seed = parseInt(hashString(`epoch60-daily-${day}`).slice(-8), 16) >>> 0 || 1;
  const ids = Object.keys(SCENARIOS).sort();
  const n = parseInt(hashString(`scenario-${day}`).slice(-4), 16);
  return { seed, scenario: ids[n % ids.length]!, difficulty: 'normal', daily: day };
}

/** Parse a share URL's query string. Anything invalid is dropped, never trusted. */
export function parseShare(search: string): Partial<RunSpec> {
  const q = new URLSearchParams(search.length > 512 ? '' : search);
  const out: Partial<RunSpec> = {};
  const seed = q.get('seed');
  if (seed && /^\d{1,10}$/.test(seed) && Number(seed) >= 1 && Number(seed) <= MAX_SEED)
    out.seed = Number(seed);
  const sc = q.get('scenario');
  if (sc && Object.prototype.hasOwnProperty.call(SCENARIOS, sc)) out.scenario = sc;
  const d = q.get('difficulty');
  if (d && Object.prototype.hasOwnProperty.call(DIFFICULTY, d)) out.difficulty = d as Difficulty;
  const day = q.get('daily');
  if (day && DATE_RE.test(day)) out.daily = day;
  // Challenges must all be known and fit together and the scenario, or the link carries none.
  const mods = q.get('mods');
  if (mods) {
    const chk = checkModifiers(mods.split(','), out.scenario ?? 'greenvale');
    if (chk.ok && chk.ids.length) out.modifiers = chk.ids;
  }
  return out;
}

export function shareQuery(r: RunSpec): string {
  const q = new URLSearchParams();
  q.set('seed', String(r.seed));
  q.set('scenario', r.scenario);
  q.set('difficulty', r.difficulty);
  if (r.daily) q.set('daily', r.daily);
  if (r.modifiers?.length) q.set('mods', r.modifiers.join(','));
  return `?${q.toString()}`;
}

/* ------------------------------ run cards ------------------------------ */

export interface RunCard extends RunSpec {
  id: string;
  /** When it ended (ISO, from the UI layer's clock — never the simulation's). */
  at: string;
  outcome: 'victory' | 'defeat';
  title: string;
  survivors: number;
  heritage: number;
  techs: number;
  epochs: number;
  hash: string;
  /** Present for Assisted runs, which are ranked apart from standard ones (absent = standard). */
  mode?: GameMode;
  /** The age a branched lineage was last replayed from (absent = a straight lineage). Branches are never ranked. */
  branch?: number;
  /** The lineage's legacy (what lasted) and the rules it was scored under; cards without them predate both. */
  legacy?: number;
  rules?: string;
  /**
   * The end of a long chronicle (a victory carried on past its last age; `epochs` is then the ages lived). Its
   * victory already has its own card; this one is never ranked, since more ages mean more legacy.
   */
  endless?: true;
}

const RUNS_KEY = 'epoch60.runs.v1';
export const MAX_CARDS = 40;

export function loadRuns(): RunCard[] {
  try {
    const raw = safeStorage()?.getItem(RUNS_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(isCard).slice(0, MAX_CARDS);
  } catch {
    return [];
  }
}

/** Stored challenges: a non-empty list this build can run as written, in canonical order. */
function storedModifiersOk(m: unknown, scenario: string): boolean {
  if (!Array.isArray(m) || m.length === 0 || !m.every((id) => typeof id === 'string')) return false;
  const chk = checkModifiers(m as string[], scenario);
  return chk.ok && chk.ids.join() === m.join();
}

function isCard(x: unknown): x is RunCard {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  // A card from a newer or older build (unknown scenario/difficulty) is skipped, never allowed to break the title.
  return (
    typeof c.id === 'string' &&
    finite(c.seed) &&
    typeof c.scenario === 'string' &&
    Object.prototype.hasOwnProperty.call(SCENARIOS, c.scenario) &&
    (c.difficulty === undefined ||
      (typeof c.difficulty === 'string' && Object.prototype.hasOwnProperty.call(DIFFICULTY, c.difficulty))) &&
    (c.outcome === 'victory' || c.outcome === 'defeat') &&
    finite(c.survivors) &&
    (c.mode === undefined || c.mode === 'standard' || c.mode === 'assisted') &&
    (c.branch === undefined || (Number.isInteger(c.branch) && (c.branch as number) >= 1)) &&
    (c.legacy === undefined || finite(c.legacy)) &&
    (c.rules === undefined || typeof c.rules === 'string') &&
    (c.endless === undefined || c.endless === true) &&
    (c.modifiers === undefined || storedModifiersOk(c.modifiers, c.scenario))
  );
}

/** Build a card from a finished campaign, or null while it is still going. */
export function cardOf(
  c: Campaign,
  daily: string | undefined,
  at: Date,
  branch: number | null = null,
): RunCard | null {
  if (c.phase !== 'VICTORY' && c.phase !== 'DEFEAT') return null;
  const end = chronicleEnding(c);
  // A long chronicle ends without a verdict of its own: its card counts what it ended with.
  const v = end ? null : c.report?.verdict;
  if (!c.report || (!end && !v)) return null;
  const r = c.report;
  const by = (i: number) => v?.conditions[i]?.have ?? 0;
  const spec: RunSpec = { seed: c.seed, scenario: c.scenario, difficulty: c.difficulty };
  if (daily) spec.daily = daily;
  if (c.modifiers) spec.modifiers = [...c.modifiers];
  return {
    ...spec,
    id: `${c.seed}-${c.scenario}-${c.difficulty}-${at.getTime()}`,
    at: at.toISOString(),
    outcome: v?.outcome ?? 'victory',
    title: end?.title ?? v?.title ?? '',
    survivors: end ? r.survivors : by(0),
    heritage: end ? earlierLandmarks(c, c.epoch).length : by(1),
    techs: end ? r.retainedTechs.length : by(2),
    epochs: c.lineage.reports.length,
    hash: hashString(
      JSON.stringify([
        c.seed,
        c.scenario,
        c.difficulty,
        c.totalTicks,
        c.actionLog.length,
        ...(c.modifiers ?? []),
      ]),
    ),
    ...(c.mode === 'assisted' ? { mode: 'assisted' as const } : {}),
    ...(branch !== null ? { branch } : {}),
    legacy: legacyOf(c)?.total ?? 0,
    // The rules the lineage began under: one resumed from an older save or branch point is not a current-rules run.
    rules: c.rules,
    ...(end ? { endless: true as const } : {}),
  };
}

/** Persist a card (newest first, bounded). Failures (disabled storage, quota) are silent: a card is a convenience. */
export function saveRun(card: RunCard): RunCard[] {
  const all = [card, ...loadRuns().filter((r) => r.id !== card.id)].slice(0, MAX_CARDS);
  try {
    safeStorage()?.setItem(RUNS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

/** The same challenges (none and none included). */
export const sameModifiers = (a?: readonly ModifierId[], b?: readonly ModifierId[]) =>
  (a ?? []).join() === (b ?? []).join();

/**
 * The best local result for a spec: victories beat defeats, then the greater legacy, then more survivors. Only runs
 * scored under these rules and begun with the same challenges are compared; Assisted runs rank only among themselves;
 * a branch (an age replayed from its start) and the end of a long chronicle are never ranked.
 */
export function bestFor(
  runs: RunCard[],
  spec: Pick<RunSpec, 'seed' | 'scenario' | 'difficulty' | 'modifiers'> & { mode?: GameMode },
): RunCard | null {
  const mode = spec.mode ?? 'standard';
  const mine = runs.filter(
    (r) =>
      r.seed === spec.seed &&
      r.scenario === spec.scenario &&
      r.difficulty === spec.difficulty &&
      sameModifiers(r.modifiers, spec.modifiers) &&
      (r.mode ?? 'standard') === mode &&
      r.branch === undefined &&
      r.endless === undefined &&
      r.rules === RULES_VERSION,
  );
  mine.sort(
    (a, b) =>
      Number(b.outcome === 'victory') - Number(a.outcome === 'victory') ||
      (b.legacy ?? 0) - (a.legacy ?? 0) ||
      b.survivors - a.survivors,
  );
  return mine[0] ?? null;
}
