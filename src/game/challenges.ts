import { MODIFIERS } from '../engine';
import type { FeatId, ModifierId } from '../engine';
import type { CodexEntry } from './codex';

/**
 * Challenges open from the Codex: each one once this device has seen a lineage earn the feat that shows its catastrophe
 * (or its kind of work) has been met. They add variety, never power: every challenge has a cost, and a lineage begun
 * with challenges is ranked only against lineages begun with the same ones. A shared link may name challenges this
 * device has not opened yet; the link is honoured (it is someone else's valley, offered to play).
 */
export const UNLOCKED_BY: Record<ModifierId, FeatId> = {
  fertile_floodplain: 'every_field',
  dry_summers: 'fire_contained',
  soft_rock: 'quake_unshaken',
  fractured_fault: 'reinforced_stood',
  overcrowded_refuge: 'cycle_broken',
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
