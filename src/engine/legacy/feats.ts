import { BUILDINGS } from '../content/buildings';
import { getScenario } from '../content/scenario';
import { TECHS } from '../content/techs';
import type { Campaign, CollapseReport, FeatId, Structure, TechId } from '../core/types';
import { isStanding } from '../economy/modifiers';
import { cellsOf, idx } from '../world/query';

/**
 * Feats: things a lineage did, awarded by the engine at the moment they happen and kept in `lineage.feats` (hashed,
 * replayed, saved). Nothing here guesses after the fact: each award reads the state the event itself produced — the
 * building just finished, the collapse report just written, the ruin just dug up. The device-local Codex
 * (`src/game/codex.ts`) only ever copies these records.
 */

export type FeatGroup = 'knowledge' | 'heritage' | 'engineering' | 'stewardship' | 'endings';

export interface FeatDef {
  id: FeatId;
  group: FeatGroup;
  name: string;
  /** The exact rule, shown whether or not it has been earned. */
  how: string;
  /** What earning it teaches: a strategy worth carrying into another lineage. */
  lesson: string;
  /** Scenarios whose ages make it possible (absent: every scenario). */
  scenarios?: string[];
}

export const FEAT_GROUPS: Record<FeatGroup, string> = {
  knowledge: 'Knowledge',
  heritage: 'Heritage',
  engineering: 'Engineering',
  stewardship: 'Stewardship',
  endings: 'Endings',
};

export const FEATS: Record<FeatId, FeatDef> = {
  archive_built: {
    id: 'archive_built',
    group: 'knowledge',
    name: 'Words Kept',
    how: 'Finish an Archive.',
    lesson:
      'An Archive carries three technologies through a collapse (five once you know Writing) — but it is not a landmark.',
  },
  three_branches: {
    id: 'three_branches',
    group: 'knowledge',
    name: 'Three Kinds of Knowing',
    how: 'In one lineage, discover a technology of industry, one of ecology and one of resilience.',
    lesson:
      'Each branch answers something different: Masonry and tools build, Irrigation and Forestry tend the land, Writing and Hydrology keep memory and hold rivers.',
  },
  grandparents_library: {
    id: 'grandparents_library',
    group: 'knowledge',
    name: "The Grandparents' Library",
    how: 'Between ages, dig up an Archive built two ages before the people who find it, its tablets still legible.',
    lesson:
      'An Archive that falls keeps its tablets, and the next ages can dig them up: knowledge outlasts the hall that held it.',
  },
  hearth_kept: {
    id: 'hearth_kept',
    group: 'heritage',
    name: 'The Hearth Endures',
    how: 'Found a new age in a hearth kept from the age before.',
    lesson:
      'Found the next society within a cell of a standing hearth and it is kept — kept to the end, it is a landmark.',
  },
  old_foundations: {
    id: 'old_foundations',
    group: 'heritage',
    name: 'On Old Foundations',
    how: 'Excavate a ruin left by an earlier age, then repair it into working order.',
    lesson:
      'An excavated stone ruin is restored for less than building new — a Dam, Bridge or Quarry especially.',
  },
  living_heritage: {
    id: 'living_heritage',
    group: 'heritage',
    name: 'Living Heritage',
    how: 'Keep a landmark built in the first age standing through the last catastrophe.',
    lesson: 'A Seed Vault, or a hearth on ground no disaster reaches, can stand through every age.',
  },
  river_works: {
    id: 'river_works',
    group: 'heritage',
    name: 'Works of the River',
    how: 'Finish a Bridge or a Dam.',
    lesson:
      'A Bridge (Bronze Tools) or a Dam (Hydrology) is a landmark like a kept hearth or a Seed Vault — and a Dam also lowers the flood.',
  },
  fire_contained: {
    id: 'fire_contained',
    group: 'engineering',
    name: 'The Fire Stopped Here',
    how: 'The Great Fire reaches your village but takes no home while a Firebreak you built stands.',
    lesson: 'Firebreaks between the forest and your homes starve the fire of fuel.',
  },
  flood_held: {
    id: 'flood_held',
    group: 'engineering',
    name: 'The River Held',
    how: 'The Great Flood takes no lives while a Levee or Dam you built stands.',
    lesson: 'Hydrology unlocks the Levee and the Dam; the forecast shows where the water will come.',
  },
  quake_unshaken: {
    id: 'quake_unshaken',
    group: 'engineering',
    name: 'Unshaken',
    how: 'The Great Quake reaches your village but brings down none of your buildings, with at least six standing.',
    lesson: 'Seismic Engineering, stone footings and Retaining Walls decide what stands after a quake.',
    scenarios: ['greenvale'],
  },
  winter_fed: {
    id: 'winter_fed',
    group: 'engineering',
    name: 'Full Larders',
    how: 'No one starves in the Ashen Winter, with at least six people to feed.',
    lesson: 'No harvest comes in an ash winter: fill Granaries and put food by before it falls.',
    scenarios: ['ashen'],
  },
  reinforced_stood: {
    id: 'reinforced_stood',
    group: 'engineering',
    name: 'Shored Up',
    how: 'A building you reinforced against the coming catastrophe is struck by it and still stands.',
    lesson: 'Select a building in the forecast path and reinforce it: a little stone decides what survives.',
  },
  every_field: {
    id: 'every_field',
    group: 'stewardship',
    name: 'Not One Field Lost',
    how: 'Bring at least two farms whole through the Great Flood.',
    lesson: 'Fields on high ground, or behind a levee, keep the next age fed.',
  },
  forest_returns: {
    id: 'forest_returns',
    group: 'stewardship',
    name: 'The Forest Returns',
    how: 'Plant a Grove on ground the fire burned.',
    lesson: 'Forestry unlocks the Grove: it regrows woodland, slows floodwater and feeds lumber camps.',
  },
  light_footprint: {
    id: 'light_footprint',
    group: 'stewardship',
    name: 'Light on the Land',
    how: 'Win a lineage without ever ordering a Quarry (a plan withdrawn before the age began does not count).',
    lesson:
      'Three ages can be won without cutting into the hillside: knowledge and a landmark matter more than stone.',
  },
  cycle_broken: {
    id: 'cycle_broken',
    group: 'endings',
    name: 'The Cycle Is Broken',
    how: 'Win a lineage.',
    lesson:
      'People, a landmark from an earlier age and remembered knowledge, all at once, after the last collapse.',
  },
  hard_won: {
    id: 'hard_won',
    group: 'endings',
    name: 'Against the Odds',
    how: 'Win a lineage on Hard.',
    lesson:
      'Hard asks for ten survivors and four technologies: a second Archive and more founders pay for themselves.',
  },
  perfect_age: {
    id: 'perfect_age',
    group: 'endings',
    name: 'An Age Without Loss',
    how: 'A catastrophe reaches your village yet takes no lives, and none of at least six buildings is lost or damaged.',
    lesson:
      'Read the forecast overlay early: keep what you can out of the path, and reinforce what must stay in it.',
  },
};

export const FEAT_IDS = Object.keys(FEATS) as FeatId[];

/** Fire scar (0..1000) at which ground still counts as burnt: a fire leaves 600+, each interregnum keeps 45%. */
const BURNT = 100;
/** The fewest buildings a catastrophe must find standing for "nothing lost" to mean anything. */
const MIN_STANDING = 6;
/** What the reinforce action sets (`campaign.ts` REINFORCE_BONUS; story decisions can set the same value). */
const REINFORCED = 220;

function award(c: Campaign, id: FeatId): void {
  if (c.lineage.feats.some((f) => f.id === id)) return;
  c.lineage.feats.push({ id, epoch: c.epoch });
}

/** A building reached working order (construction or the restoration of an excavated ruin finished). */
export function featsOnCompleted(c: Campaign, s: Structure): void {
  if (s.kind === 'archive') award(c, 'archive_built');
  if (s.kind === 'bridge' || s.kind === 'dam') award(c, 'river_works');
  if (s.kind === 'grove' && cellsOf(s).some(([x, y]) => c.world.scar[idx(x, y, c.world.w)]! >= BURNT))
    award(c, 'forest_returns');
  // Only ruins can be excavated, and only between ages: a finished excavated building is a restored older ruin.
  if (s.excavated && s.originEpoch < c.epoch) award(c, 'old_foundations');
}

/** A research job just finished. */
export function featsOnResearched(c: Campaign): void {
  const branches = new Set(c.lineage.everKnown.map((t) => TECHS[t].branch));
  if (branches.size >= 3) award(c, 'three_branches');
}

/**
 * The catastrophe has just been applied and its report written. `larder` is the winter store as it stood before an
 * ash winter (null for other hazards).
 */
export function featsOnCollapse(
  c: Campaign,
  r: CollapseReport,
  larder: { need: number; have: number } | null,
): void {
  const standing = c.structures.filter(isStanding);
  // Impacts on buildings that were finished before the hazard (a construction site is not yet a home or a field).
  const finished = r.result.impacts.filter((i) => i.before === 'active' || i.before === 'damaged');
  // A catastrophe that never reached the village proves nothing about how it was built.
  const reached = r.result.impacts.length > 0;
  if (
    r.hazard === 'fire' &&
    reached &&
    !finished.some((i) => BUILDINGS[i.kind].housing > 0 && i.after === 'rubble') &&
    standing.some((s) => s.kind === 'firebreak')
  )
    award(c, 'fire_contained');
  if (r.hazard === 'flood') {
    if (r.deaths === 0 && standing.some((s) => s.kind === 'levee' || s.kind === 'dam'))
      award(c, 'flood_held');
    const farms = standing.filter((s) => s.kind === 'farm').length;
    if (farms >= 2 && !finished.some((i) => i.kind === 'farm' && i.after !== 'active'))
      award(c, 'every_field');
  }
  if (r.hazard === 'quake' && reached && r.structuresLost === 0 && standing.length >= MIN_STANDING)
    award(c, 'quake_unshaken');
  if (r.hazard === 'ash' && larder && larder.have >= larder.need && r.survivorsBefore >= MIN_STANDING)
    award(c, 'winter_fed');
  // Reinforced by the player this age (the action log), and the reinforcement really applied (the bonus it sets).
  const reinforced = new Set(
    c.actionLog.flatMap((a) =>
      a.epoch === r.epoch && a.action.type === 'reinforce' && a.action.hazard === r.hazard
        ? [a.action.id]
        : [],
    ),
  );
  if (
    finished.some(
      (i) =>
        i.after !== 'rubble' &&
        reinforced.has(i.id) &&
        (c.structures.find((s) => s.id === i.id)?.bonus[r.hazard] ?? 0) >= REINFORCED,
    )
  )
    award(c, 'reinforced_stood');
  if (
    reached &&
    r.deaths === 0 &&
    r.structuresLost === 0 &&
    r.structuresDamaged === 0 &&
    standing.length >= MIN_STANDING
  )
    award(c, 'perfect_age');
  const last = c.epoch === getScenario(c.scenario).epochs.length - 1;
  if (last && standing.some((s) => BUILDINGS[s.kind].heritage && s.originEpoch === 0))
    award(c, 'living_heritage');
  if (r.verdict?.outcome === 'victory') {
    award(c, 'cycle_broken');
    if (c.difficulty === 'hard') award(c, 'hard_won');
    const withdrawn = new Set(c.actionLog.flatMap((a) => (a.action.type === 'unplan' ? [a.action.seq] : [])));
    const quarried = c.actionLog.some(
      (a) => a.action.type === 'build' && a.action.kind === 'quarry' && !withdrawn.has(a.seq),
    );
    if (!quarried) award(c, 'light_footprint');
  }
}

/** A ruin was just excavated between ages; `techs` are the technologies its tablets held. */
export function featsOnExcavated(c: Campaign, s: Structure, techs: TechId[]): void {
  // The diggers are the next society (epoch + 1): the builders were at least two ages before them.
  if (s.kind === 'archive' && techs.length > 0 && s.originEpoch + 2 <= c.epoch + 1)
    award(c, 'grandparents_library');
}

/** A new age was just founded; `keptHearth` when its people moved into a standing hearth from the age before. */
export function featsOnFounded(c: Campaign, keptHearth: boolean): void {
  if (keptHearth) award(c, 'hearth_kept');
}
