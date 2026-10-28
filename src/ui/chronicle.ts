import { BUILDINGS, TECHS, getScenario } from '../engine';
import type { Campaign, Structure } from '../engine';
import { ROMAN } from './format';

/**
 * The chronicle of works: short biographies of the buildings with the longest stories in a lineage, told from what
 * the engine recorded about each — who raised it and when, every catastrophe it met, how the centuries treated it, who
 * dug it up or restored it, what knowledge it keeps. Nothing is invented: apart from the first sentence (its origin),
 * the knowledge it keeps and the last (how it stands now), every sentence retells one of its provenance lines.
 */

export interface Biography {
  id: number;
  title: string;
  /** Sentences, oldest first. */
  story: string[];
}

function ageName(c: Campaign, epoch: number): string {
  return getScenario(c.scenario).epochs[epoch]?.ageName ?? `age ${ROMAN[epoch] ?? epoch + 1}`;
}

/** One provenance line as a sentence of the building's own story. */
export function retell(c: Campaign, s: Structure, line: string): string {
  const prefix = `${BUILDINGS[s.kind].name} at (${s.x},${s.y}) `;
  const t = (line.startsWith(prefix) ? line.slice(prefix.length) : line)
    // Ages are numbered from 1 in these lines: "Repaired in epoch 3." is the third age's doing.
    .replace(
      /^Repaired in epoch (\d+)\.$/,
      (_, n: string) => `Restored by the people of the ${ageName(c, Number(n) - 1)}.`,
    )
    .replace(
      /^Excavated in epoch (\d+): /,
      (_, n: string) => `Dug up by the people of the ${ageName(c, Number(n) - 1)}: `,
    )
    .replace(/^was damaged by (.+) but stands\.$/, 'Damaged by $1, it stood.')
    .replace(/^was destroyed by /, 'Destroyed by ')
    .replace(/^weathered into disrepair\.$/, 'weathered into disrepair over the centuries.')
    .replace(/^was never finished and was abandoned\.$/, 'never finished, it was abandoned.');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** How much story a building has to tell: its recorded events, more for a landmark or a keeper of knowledge. */
function weight(s: Structure): number {
  const d = BUILDINGS[s.kind];
  return s.provenance.length + (d.heritage ? 2 : 0) + (d.retains > 0 ? 2 : 0) + s.storedTechs.length;
}

/** The `max` works with the longest stories (at least three recorded events each), most storied first. */
export function chronicleOf(c: Campaign, max = 3): Biography[] {
  const scenario = getScenario(c.scenario);
  return c.structures
    .filter((s) => s.provenance.length >= 3)
    .sort((a, b) => weight(b) - weight(a) || a.id - b.id)
    .slice(0, max)
    .map((s) => {
      const lines = s.provenance.map((p) => retell(c, s, p));
      // A hearth's own first line already says who lit it ("The founders lit the first fire here.").
      const founded = /^(The founders lit|Founded in)/.test(s.provenance[0] ?? '');
      const society = scenario.epochs[s.originEpoch]?.name ?? 'an earlier people';
      const story = founded ? lines : [`Raised by ${society} in the ${ageName(c, s.originEpoch)}.`, ...lines];
      if (s.storedTechs.length)
        story.push(`Knowledge kept here: ${s.storedTechs.map((t) => TECHS[t].name).join(', ')}.`);
      story.push(
        s.status === 'active' || s.status === 'damaged'
          ? 'It stands.'
          : s.status === 'buried'
            ? 'It lies buried.'
            : 'It lies in ruins.',
      );
      return { id: s.id, title: `The ${BUILDINGS[s.kind].name} at (${s.x},${s.y})`, story };
    });
}
