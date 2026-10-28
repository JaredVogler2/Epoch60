import { CONTENT_VERSION, RULES_VERSION, SCHEMA_VERSION } from '../core/constants';
import { hashValue } from '../core/hash';
import type { Action, Campaign, Difficulty, LoggedAction, ModifierId } from '../core/types';
import { advanceFixedTick, createCampaign, dispatchAction } from '../campaign';
import { checkModifiers } from '../content/modifiers';
import { DIFFICULTY, MAX_AGES, SCENARIOS } from '../content/scenario';
import { FEATS } from '../legacy/feats';

export interface SaveFile {
  schema: number;
  rules: string;
  content: string;
  savedAtTick: number;
  hash: string;
  campaign: Campaign;
}

/** State hash used for determinism checks. `paused` is a presentation concern and is excluded. */
export function computeHash(c: Campaign): string {
  const { paused: _paused, ...rest } = c;
  return hashValue(rest);
}

export function cloneCampaign(c: Campaign): Campaign {
  return structuredClone(c);
}

export function serialize(c: Campaign): string {
  const file: SaveFile = {
    schema: SCHEMA_VERSION,
    rules: RULES_VERSION,
    content: CONTENT_VERSION,
    savedAtTick: c.totalTicks,
    hash: computeHash(c),
    campaign: c,
  };
  return JSON.stringify(file);
}

export class SaveError extends Error {}

const PHASES = new Set([
  'PREPARE',
  'ACTIVE',
  'COLLAPSE_PENDING',
  'COLLAPSING',
  'DEBRIEF',
  'INTERREGNUM',
  'VICTORY',
  'DEFEAT',
]);
const own = (o: object, k: unknown) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/**
 * The integrity hash only catches accidents (it is not a signature), so a save must also describe a campaign this
 * build can actually run: a known scenario, an epoch inside it, a known difficulty, mode and phase, sane numbers.
 */
function validateShape(c: Campaign): void {
  const bad = (why: string): never => {
    throw new SaveError(`Save data is not a campaign this version can run (${why})`);
  };
  if (!own(SCENARIOS, c.scenario)) bad('unknown scenario');
  if (c.endless !== undefined && (!c.endless || typeof c.endless.rested !== 'boolean'))
    bad('malformed long chronicle');
  // The long chronicle runs past the scenario's ages, to MAX_AGES at most.
  const epochs = c.endless ? MAX_AGES : SCENARIOS[c.scenario]!.epochs.length;
  if (!Number.isInteger(c.epoch) || c.epoch < 0 || c.epoch >= epochs) bad('epoch out of range');
  if (!own(DIFFICULTY, c.difficulty)) bad('unknown difficulty');
  // Challenges change the simulation, so a set this build cannot run as written is refused, never trimmed.
  if (c.modifiers !== undefined) {
    const chk =
      Array.isArray(c.modifiers) && c.modifiers.length ? checkModifiers(c.modifiers, c.scenario) : null;
    if (!chk?.ok || chk.ids.join() !== c.modifiers.join()) bad('unknown or invalid challenges');
  }
  if (c.mode !== 'standard' && c.mode !== 'assisted') bad('unknown mode');
  if (!PHASES.has(c.phase)) bad('unknown phase');
  if (!Number.isInteger(c.tick) || c.tick < 0 || c.tick > 600) bad('tick out of range');
  if (!Array.isArray(c.structures) || !c.world || !c.civ || !Array.isArray(c.lineage?.feats))
    bad('missing state');
}

/**
 * Restore a campaign. Unknown schema versions are rejected rather than silently misread. An ACTIVE game always
 * reloads paused so a refresh can never drain the clock.
 */
export function deserialize(text: string): Campaign {
  let file: SaveFile;
  try {
    file = JSON.parse(text) as SaveFile;
  } catch {
    throw new SaveError('Save data is not valid JSON');
  }
  if (!file || typeof file !== 'object' || !file.campaign) throw new SaveError('Save data is incomplete');
  if (file.schema !== SCHEMA_VERSION) throw new SaveError(`Unsupported save schema ${String(file.schema)}`);
  const c = file.campaign;
  if (computeHash(c) !== file.hash) throw new SaveError('Save data failed its integrity check');
  c.prompts ??= []; // saves written before story decisions existed
  c.difficulty ??= 'normal'; // ... or before difficulty tiers
  if (c.lineage) {
    c.lineage.feats ??= []; // ... or before feats
    // A save or branch point from another build may name feats this one does not have: drop them, never crash on them.
    if (Array.isArray(c.lineage.feats))
      c.lineage.feats = c.lineage.feats.filter(
        (f) => !!f && Object.prototype.hasOwnProperty.call(FEATS, f.id) && Number.isInteger(f.epoch),
      );
  }
  validateShape(c);
  if (c.phase === 'ACTIVE') c.paused = true;
  return c;
}

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

export interface Transcript {
  schema: number;
  rules: string;
  content: string;
  seed: number;
  scenario: string;
  mode: 'standard' | 'assisted';
  difficulty?: Difficulty;
  /** Absent for a standard lineage. */
  modifiers?: ModifierId[];
  actions: LoggedAction[];
  /** Total active ticks played; the replay ends here. */
  totalTicks: number;
  finalHash?: string;
}

export function transcriptOf(c: Campaign): Transcript {
  return {
    schema: SCHEMA_VERSION,
    rules: RULES_VERSION,
    content: CONTENT_VERSION,
    seed: c.seed,
    scenario: c.scenario,
    mode: c.mode,
    difficulty: c.difficulty,
    ...(c.modifiers ? { modifiers: [...c.modifiers] } : {}),
    actions: c.actionLog.map((a) => ({ ...a })),
    totalTicks: c.totalTicks,
    finalHash: computeHash(c),
  };
}

/** Rebuild a campaign from a seed and its accepted-action log, ticking in between actions. */
export function replayCampaign(t: Transcript): Campaign {
  const c = createCampaign(t.seed, t.mode, t.scenario, t.difficulty ?? 'normal', t.modifiers ?? []);
  const apply = (a: Action) => dispatchAction(c, a);
  for (const entry of t.actions) {
    while (c.phase === 'ACTIVE' && c.tick < entry.tick) {
      if (!advanceFixedTick(c)) break;
    }
    apply(entry.action);
  }
  while (c.totalTicks < t.totalTicks && advanceFixedTick(c)) {
    /* run out the remaining ticks */
  }
  return c;
}
