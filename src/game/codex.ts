import { DIFFICULTY, FEATS, SCENARIOS } from '../engine';
import type { Campaign, Difficulty, FeatId, GameMode } from '../engine';
import { safeStorage } from './persist';

/**
 * The Codex: every feat this device has seen a lineage earn, kept in local storage beside the run cards. It only ever
 * copies `campaign.lineage.feats` — records the engine wrote at the moment each feat happened — so nothing can appear
 * here that was not played. Stored data is untrusted: unknown feats, bad fields and duplicates are dropped on load.
 */

export interface CodexEntry {
  id: FeatId;
  /** When it was first earned (ISO, from the UI layer's clock — never the simulation's). */
  at: string;
  /** The lineage that first earned it. */
  seed: number;
  scenario: string;
  difficulty: Difficulty;
  /** Present for Assisted runs (absent = standard). */
  mode?: GameMode;
  /** UTC date when that lineage was a Daily Ruins challenge. */
  daily?: string;
}

const CODEX_KEY = 'epoch60.codex.v1';
const own = (o: object, k: unknown) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

function isEntry(x: unknown): x is CodexEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    own(FEATS, e.id) &&
    typeof e.at === 'string' &&
    !Number.isNaN(Date.parse(e.at)) &&
    typeof e.seed === 'number' &&
    Number.isFinite(e.seed) &&
    own(SCENARIOS, e.scenario) &&
    own(DIFFICULTY, e.difficulty) &&
    (e.mode === undefined || e.mode === 'standard' || e.mode === 'assisted') &&
    (e.daily === undefined || (typeof e.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.daily)))
  );
}

/** Validate stored data: only well-formed entries for feats this build knows, the first of each kept. */
export function sanitizeCodex(raw: unknown): CodexEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FeatId>();
  const out: CodexEntry[] = [];
  for (const x of raw) {
    if (!isEntry(x) || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export function loadCodex(): CodexEntry[] {
  try {
    const raw = safeStorage()?.getItem(CODEX_KEY);
    return raw ? sanitizeCodex(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/**
 * Copy into the Codex the feats this lineage has earned that the Codex does not hold yet. Returns the updated Codex
 * and the feats seen for the first time on this device. A failed write (disabled storage, quota) loses nothing that
 * matters: the feats stay in the lineage itself and are copied again next time.
 */
export function recordFeats(
  codex: CodexEntry[],
  c: Campaign,
  daily: string | null,
  at: Date,
): { codex: CodexEntry[]; added: FeatId[] } {
  const have = new Set(codex.map((e) => e.id));
  const added: FeatId[] = [];
  const next = [...codex];
  for (const f of c.lineage.feats) {
    if (have.has(f.id) || !own(FEATS, f.id)) continue;
    have.add(f.id);
    added.push(f.id);
    next.push({
      id: f.id,
      at: at.toISOString(),
      seed: c.seed,
      scenario: c.scenario,
      difficulty: c.difficulty,
      ...(c.mode === 'assisted' ? { mode: 'assisted' as const } : {}),
      ...(daily ? { daily } : {}),
    });
  }
  if (added.length) {
    try {
      safeStorage()?.setItem(CODEX_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return { codex: next, added };
}
