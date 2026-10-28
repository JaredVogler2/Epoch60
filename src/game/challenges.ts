import { MAX_MODIFIERS, MODIFIERS } from '../engine';
import type { FeatId, ModifierId } from '../engine';
import { hashString } from '../engine/core/hash';
import type { CodexEntry } from './codex';

/**
 * Challenges open from the Codex: each one once this device has seen a lineage earn the feat that shows its catastrophe
 * (or its kind of work) has been met. They add variety, never power: every challenge has a cost, and a lineage begun
 * with challenges is ranked only against lineages begun with the same ones. A shared link may name challenges this
 * device has not opened yet; the link is honoured (it is someone else's valley, offered to play).
 */
export const UNLOCKED_BY: Record<ModifierId, FeatId> = {
  fertile_floodplain: 'every_field',
  storm_front: 'flood_held',
  dry_summers: 'fire_contained',
  thin_woods: 'forest_returns',
  overgrown: 'light_footprint',
  blight: 'winter_fed',
  soft_rock: 'quake_unshaken',
  rich_vein: 'old_foundations',
  fractured_fault: 'reinforced_stood',
  overcrowded_refuge: 'cycle_broken',
  elders_lore: 'three_branches',
  buried_library: 'archive_built',
};

export const CHALLENGE_IDS = Object.keys(MODIFIERS) as ModifierId[];

export function unlockedChallenges(codex: readonly CodexEntry[]): Set<ModifierId> {
  const seen = new Set(codex.map((e) => e.id));
  return new Set(CHALLENGE_IDS.filter((m) => seen.has(UNLOCKED_BY[m])));
}

/** Why a challenge cannot be added to the current choice right now (null when it can be toggled). */
export function challengeBlocked(
  id: ModifierId,
  chosen: readonly ModifierId[],
  scenario: string,
  unlocked: ReadonlySet<ModifierId>,
  max: number,
): string | null {
  const d = MODIFIERS[id];
  if (chosen.includes(id)) return null;
  if (!unlocked.has(id)) return 'locked';
  if (d.scenarios && !d.scenarios.includes(scenario)) return 'unsuited';
  if (chosen.some((c) => (d.excludes ?? []).includes(c) || (MODIFIERS[c].excludes ?? []).includes(id)))
    return 'clash';
  if (chosen.length >= max) return 'full';
  return null;
}

/**
 * An expedition: one to three challenges drawn from the open ones by the valley's seed, so the same seed always brings the
 * same draw (and a shared link of it, the same lineage). Only challenges that suit the scenario and fit together are drawn.
 */
export function expeditionFor(seed: number, scenario: string, open: ReadonlySet<ModifierId>): ModifierId[] {
  const roll = (k: string) => parseInt(hashString(`expedition-${seed}-${scenario}-${k}`).slice(-8), 16);
  const pool = CHALLENGE_IDS.filter(
    (m) => open.has(m) && (!MODIFIERS[m].scenarios || MODIFIERS[m].scenarios!.includes(scenario)),
  );
  if (!pool.length) return [];
  const want = 1 + (roll('count') % Math.min(MAX_MODIFIERS, pool.length));
  const drawn: ModifierId[] = [];
  for (const m of [...pool].sort((a, b) => roll(a) - roll(b) || a.localeCompare(b))) {
    if (drawn.length >= want) break;
    if (challengeBlocked(m, drawn, scenario, open, MAX_MODIFIERS) === null) drawn.push(m);
  }
  return CHALLENGE_IDS.filter((m) => drawn.includes(m));
}
