import { BUILDINGS } from '../content/buildings';
import type { Campaign } from '../core/types';
import { isStanding } from '../economy/modifiers';

/**
 * The legacy of a lineage: what lasted, read from the state after its latest catastrophe. Every part is a count of
 * what is there now, never a running tally, so building and clearing the same works again and again, or waiting,
 * adds nothing: the people who came through, the knowledge still held, the works still standing, and the feats the
 * lineage earned.
 *
 * There is no part for the land. Between ages the valley regrows and is enriched on its own (forest 369 → 491–627 and
 * fertility 493 → 687–765 on every recorded lineage that reached its last age, whatever was built), so such a part would
 * measure the centuries, not the people (K-023).
 */

export type LegacyKey = 'people' | 'knowledge' | 'works' | 'feats';

export interface LegacyPart {
  key: LegacyKey;
  label: string;
  points: number;
  /** What was counted, in words. */
  basis: string;
}

export interface Legacy {
  parts: LegacyPart[];
  total: number;
}

export const LEGACY_POINTS = {
  /** Per person who came through the latest catastrophe. */
  person: 100,
  /** Per technology still held after it. */
  tech: 120,
  /** Per building still standing, and again per landmark among them from an earlier age. */
  work: 30,
  landmark: 150,
  /** Per feat the lineage earned. */
  feat: 100,
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The legacy so far, or null before the first catastrophe. */
export function legacyOf(c: Campaign): Legacy | null {
  const last = c.lineage.reports.at(-1);
  if (!last) return null;
  const P = LEGACY_POINTS;
  const people = last.survivors;
  const techs = last.retainedTechs.length;
  const standing = c.structures.filter(isStanding);
  const landmarks = standing.filter((s) => BUILDINGS[s.kind].heritage && s.originEpoch < last.epoch).length;
  const feats = c.lineage.feats.length;
  const parts: LegacyPart[] = [
    {
      key: 'people',
      label: 'People',
      points: people * P.person,
      basis: `${plural(people, 'person', 'people')} came through the last catastrophe`,
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      points: techs * P.tech,
      basis: `${plural(techs, 'technology', 'technologies')} still held`,
    },
    {
      key: 'works',
      label: 'Works',
      points: standing.length * P.work + landmarks * P.landmark,
      basis: `${plural(standing.length, 'building', 'buildings')} still standing, ${plural(landmarks, 'landmark', 'landmarks')} from an earlier age among them`,
    },
    {
      key: 'feats',
      label: 'Feats',
      points: feats * P.feat,
      basis: `${plural(feats, 'feat', 'feats')} earned`,
    },
  ];
  return { parts, total: parts.reduce((sum, p) => sum + p.points, 0) };
}
