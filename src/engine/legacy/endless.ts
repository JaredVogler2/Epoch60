import { MAX_AGES, epochSpec, getScenario } from '../content/scenario';
import type { Campaign } from '../core/types';
import { MIN_FOUNDERS } from '../core/constants';

/**
 * The long chronicle: endless play after a victory, bounded at `MAX_AGES` ages. A lineage that broke the cycle may
 * carry its chronicle on into later ages, each bringing back one of the scenario's catastrophes, fiercer every time
 * (`epochSpec`). Those ages are not judged: the victory is already won, and the chronicle ends when an age leaves too
 * few to found the next, when the last age has passed, or when the player rests it at a debrief.
 */

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];
const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
];

const word = (n: number) => WORDS[n] ?? String(n);

/** The age in which this lineage's scenario judges it: its last authored age. */
export const capstoneEpoch = (c: Pick<Campaign, 'scenario'>): number =>
  getScenario(c.scenario).epochs.length - 1;

/** True at a victory that may be carried on: won in the last authored age, and not yet carried on. */
export function canEndure(c: Campaign): boolean {
  const last = capstoneEpoch(c);
  return (
    c.phase === 'VICTORY' &&
    !c.endless &&
    c.epoch === last &&
    last + 1 < MAX_AGES &&
    c.report?.verdict?.outcome === 'victory'
  );
}

/** At the debrief of an age of the long chronicle: true when it cannot go on (too few survived, or the last age). */
export function chronicleOver(c: Campaign): boolean {
  return !!c.endless && ((c.report?.survivors ?? 0) < MIN_FOUNDERS || c.epoch >= MAX_AGES - 1);
}

export interface ChronicleEnding {
  how: 'rested' | 'fell' | 'complete';
  /** Ages the lineage lived, the last one included. */
  ages: number;
  title: string;
  reason: string;
}

/**
 * How the long chronicle ended (or, at the debrief of an age it cannot outlive, will end); null while it goes on, and
 * for a lineage that never carried its chronicle on.
 */
export function chronicleEnding(c: Campaign): ChronicleEnding | null {
  if (!c.endless || !c.report) return null;
  const rested = c.endless.rested;
  if (!rested && !chronicleOver(c)) return null;
  const ages = c.epoch + 1;
  const broke = `The lineage broke the cycle in the ${ORDINALS[capstoneEpoch(c)] ?? 'last'} age`;
  const survivors = c.report.survivors;
  const struck = epochSpec(c, c.epoch).hazard.headline;
  if (rested)
    return {
      how: 'rested',
      ages,
      title: 'The chronicle rests',
      reason: `${broke} and kept its chronicle for ${word(ages)} ages, then laid it down with ${survivors} people still living.`,
    };
  if (survivors < MIN_FOUNDERS)
    return {
      how: 'fell',
      ages,
      title: 'The chronicle ends',
      reason: `Only ${survivors} came through ${struck}, too few to begin again. ${broke} and lasted ${word(ages)} ages in all.`,
    };
  return {
    how: 'complete',
    ages,
    title: 'The chronicle is complete',
    reason: `${word(ages).charAt(0).toUpperCase()}${word(ages).slice(1)} ages, one valley: ${survivors} people came through ${struck}. ${broke}, and it never closed again.`,
  };
}
