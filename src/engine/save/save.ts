import { CONTENT_VERSION, RULES_VERSION, SCHEMA_VERSION } from '../core/constants';
import { hashValue } from '../core/hash';
import type { Action, Campaign, LoggedAction } from '../core/types';
import { advanceFixedTick, createCampaign, dispatchAction } from '../campaign';

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
    actions: c.actionLog.map((a) => ({ ...a })),
    totalTicks: c.totalTicks,
    finalHash: computeHash(c),
  };
}

/** Rebuild a campaign from a seed and its accepted-action log, ticking in between actions. */
export function replayCampaign(t: Transcript): Campaign {
  const c = createCampaign(t.seed, t.mode, t.scenario);
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
