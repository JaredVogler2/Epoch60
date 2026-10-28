import type { Campaign, Difficulty, HazardKind, ModifierId, TechId } from '../core/types';
import { SCENARIOS, scaledStrength } from './scenario';
import { ZERO_MODS, type Modifiers } from './traditions';

/**
 * Challenges: optional twists a lineage can begin with. Each changes the world, a catastrophe or the people for the
 * whole lineage (never the clock or the rules of play), and its effects list says exactly what it changes. A lineage
 * begun with challenges is compared only with lineages begun with the same ones.
 */
export interface ModifierDef {
  id: ModifierId;
  name: string;
  /** One line for the picker. */
  summary: string;
  /** Every change it makes, one rule per line (the picker and the briefing card show them). */
  effects: string[];
  /** Hazard strength, permille deltas on top of the difficulty's scaling. */
  hazard?: Partial<Record<HazardKind, number>>;
  /** Rate and start deltas, like a tradition's. Start extras apply when the lineage begins and at every founding. */
  mods?: Partial<Modifiers>;
  /** Technologies the first founders already know. */
  startTechs?: TechId[];
  /** Forest regrowth between ages, permille (1000 = as usual). */
  regrowthPm?: number;
  /** The scenarios it suits (absent: all). A quake challenge means nothing where no quake comes. */
  scenarios?: string[];
  /** Challenges it cannot be combined with. */
  excludes?: ModifierId[];
}

export const MAX_MODIFIERS = 3;

/** Fertile Floodplain: how far from the river's centre line the silt reaches, and how much richer it makes the soil. */
export const FLOODPLAIN_REACH = 6;
export const FLOODPLAIN_FERTILITY = 250;
/** Soft Rock: every stone deposit holds this much more (permille). */
export const SOFT_ROCK_PM = 1500;
/** Fractured Fault: where the quake's epicentre lies, from the first hearth. */
export const FAULT_OFFSET = { dx: 3, dy: -3 };
/** Buried Library: what its tablets hold. */
export const LIBRARY_TECHS: TechId[] = ['writing', 'hydrology'];
/** Thin Woods and Overgrown: the forest at the start, permille. */
export const THIN_WOODS_PM = 500;
export const OVERGROWN_PM = 1400;
/** Blight: farm output until the lineage knows Crop Rotation, permille. */
export const BLIGHT_PM = 750;
/** Rich Vein: no rock this close to the first hearth (cells, in every direction); every other deposit doubled. */
export const VEIN_CLEAR = 9;
export const VEIN_PM = 2000;

/** In canonical order: a lineage's challenges are always stored in this order. */
export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  fertile_floodplain: {
    id: 'fertile_floodplain',
    name: 'Fertile Floodplain',
    summary: 'Rich silt along the river, and a river that floods higher.',
    effects: [
      `Soil within ${FLOODPLAIN_REACH} cells of the river is richer (fertility +${FLOODPLAIN_FERTILITY / 10}%), so farms there yield more.`,
      'The Great Flood runs 30% higher.',
    ],
    hazard: { flood: 300 },
    excludes: ['dry_summers'],
  },
  storm_front: {
    id: 'storm_front',
    name: 'Storm Front',
    summary: 'Storms off the hills: higher floods, faster-growing woods.',
    effects: [
      'The Great Flood runs 40% higher.',
      'The rains make the woods regrow half as fast again between ages.',
    ],
    hazard: { flood: 400 },
    regrowthPm: 1500,
    excludes: ['dry_summers'],
  },
  dry_summers: {
    id: 'dry_summers',
    name: 'Dry Summers',
    summary: 'Drought: fiercer fire and thinner harvests, but a low river.',
    effects: [
      'The Great Fire burns 30% further.',
      'The river runs low: the Great Flood is 20% weaker.',
      'Thin harvests: food production −15%.',
    ],
    hazard: { fire: 300, flood: -200 },
    mods: { foodRate: -150 },
    excludes: ['fertile_floodplain', 'storm_front'],
  },
  thin_woods: {
    id: 'thin_woods',
    name: 'Thin Woods',
    summary: 'Logged bare before the founders came.',
    effects: [
      'Half the forest at the start, and the woods regrow at half speed between ages.',
      'Timber is scarce and the fire finds less to burn; with less forest to hold the rain, the floods run higher.',
    ],
    regrowthPm: 500,
    excludes: ['overgrown'],
  },
  overgrown: {
    id: 'overgrown',
    name: 'Overgrown',
    summary: 'Old forest everywhere: plenty of timber, plenty to burn.',
    effects: [
      'The forest is 40% denser at the start (at most 95%).',
      'Timber is plentiful, but the fire has more to burn; the forest holds the rain, so the floods run lower.',
    ],
    excludes: ['thin_woods'],
  },
  blight: {
    id: 'blight',
    name: 'Blight',
    summary: 'Sick soil, until the lineage learns to rest its fields.',
    effects: ['Farms yield 25% less until the lineage knows Crop Rotation (which needs Irrigation).'],
  },
  soft_rock: {
    id: 'soft_rock',
    name: 'Soft Rock',
    summary: 'Easy stone, but the ground shakes harder.',
    effects: [
      `Every stone deposit holds half as much again, and quarries cut 25% faster.`,
      'The Great Quake shakes 20% harder.',
    ],
    hazard: { quake: 200 },
    mods: { stoneRate: 250 },
    scenarios: ['greenvale'],
  },
  rich_vein: {
    id: 'rich_vein',
    name: 'Rich Vein',
    summary: 'No stone near the village, rich deposits in the hills.',
    effects: [
      `No stone lies within ${VEIN_CLEAR} cells of the first hearth.`,
      'Every other deposit holds twice as much.',
    ],
  },
  fractured_fault: {
    id: 'fractured_fault',
    name: 'Fractured Fault',
    summary: 'The fault runs under the founders’ meadow.',
    effects: [
      'The Great Quake’s epicentre lies beside the first hearth, not out in the hills.',
      'Where the third age builds matters: the founding sites show the danger.',
    ],
    scenarios: ['greenvale'],
  },
  overcrowded_refuge: {
    id: 'overcrowded_refuge',
    name: 'Overcrowded Refuge',
    summary: 'More mouths than the stores can feed.',
    effects: [
      'Refugees join the founders: four more people at the start of every age (at most 16).',
      'Their stores are thin: 10 less food at the start of every age.',
    ],
    mods: { startPop: 4, startFood: -10 },
  },
  elders_lore: {
    id: 'elders_lore',
    name: 'Elders’ Lore',
    summary: 'The founders arrive knowing Masonry; new learning comes slowly.',
    effects: [
      'The first founders already know Masonry, so Stone Houses can be built from the first day.',
      'Research costs 20% more.',
    ],
    mods: { researchCost: 200 },
    startTechs: ['masonry'],
  },
  buried_library: {
    id: 'buried_library',
    name: 'Buried Library',
    summary: 'An Archive older than the founders lies buried in the valley.',
    effects: [
      'Under the floodplain lies the Archive of a people who lived here before the founders, buried deep in silt.',
      `Survey and dig it up between ages to bring its tablets (${LIBRARY_TECHS.length} technologies) into the next age; building over it destroys them.`,
    ],
  },
};

export type ModifierCheck = { ok: true; ids: ModifierId[] } | { ok: false; why: string };

/** Validate a set of challenges for a scenario; on success the ids come back in canonical order. */
export function checkModifiers(ids: readonly string[], scenario: string): ModifierCheck {
  const known = Object.keys(MODIFIERS) as ModifierId[];
  const set = new Set<string>();
  for (const id of ids) {
    if (!known.includes(id as ModifierId)) return { ok: false, why: `unknown challenge ${String(id)}` };
    if (set.has(id)) return { ok: false, why: `${id} twice` };
    set.add(id);
  }
  if (set.size > MAX_MODIFIERS) return { ok: false, why: `more than ${MAX_MODIFIERS} challenges` };
  const chosen = known.filter((id) => set.has(id));
  for (const id of chosen) {
    const d = MODIFIERS[id];
    if (d.scenarios && !d.scenarios.includes(scenario))
      return { ok: false, why: `${d.name} does not suit ${SCENARIOS[scenario]?.name ?? scenario}` };
    const clash = (d.excludes ?? []).find((x) => set.has(x));
    if (clash) return { ok: false, why: `${d.name} and ${MODIFIERS[clash].name} cannot be combined` };
  }
  return { ok: true, ids: chosen };
}

/** The rate and start deltas of a lineage's challenges, summed. */
export function modifierMods(c: Pick<Campaign, 'modifiers'>): Modifiers {
  const out: Modifiers = { ...ZERO_MODS };
  for (const id of c.modifiers ?? [])
    for (const [k, v] of Object.entries(MODIFIERS[id].mods ?? {}) as [keyof Modifiers, number][]) out[k] += v;
  return out;
}

/** Forest regrowth between ages under a lineage's challenges, permille. */
export function regrowthPm(c: Pick<Campaign, 'modifiers'>): number {
  let pm = 1000;
  for (const id of c.modifiers ?? []) pm = Math.round((pm * (MODIFIERS[id].regrowthPm ?? 1000)) / 1000);
  return pm;
}

/** Two modifier bundles added together. */
export function addMods(a: Modifiers, b: Modifiers): Modifiers {
  const out: Modifiers = { ...a };
  for (const k of Object.keys(b) as (keyof Modifiers)[]) out[k] += b[k];
  return out;
}

/**
 * A hazard's strength in this lineage: the authored strength, scaled by the difficulty and then by the challenges.
 * Every caller (forecast, resolution, founding-site risk, bots) goes through here, so they all agree.
 */
export function hazardStrength(
  c: { difficulty?: Difficulty; modifiers?: ModifierId[] },
  kind: HazardKind,
  nominal: number,
): number {
  const base = scaledStrength(c.difficulty, nominal);
  let pm = 1000;
  for (const id of c.modifiers ?? []) pm += MODIFIERS[id].hazard?.[kind] ?? 0;
  return pm === 1000 ? base : Math.round((base * pm) / 1000);
}
