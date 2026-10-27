import type { Difficulty, HazardKind, ResourceKey, Resources } from '../core/types';

export interface HazardSpec {
  kind: HazardKind;
  name: string;
  /** The "Great ..." headline used in the debrief. */
  headline: string;
  /** Fire: spread budget. Flood: peak depth over the river surface (1/100 cell). Quake: peak intensity (permille). */
  strength: number;
  /** Plain-language forecast line shown 25 s, 15 s, 5 s out. */
  warnings: [string, string, string];
}

export interface EpochSpec {
  index: number;
  id: string;
  name: string;
  ageName: string;
  /** Ages of cultural/technological look; also gates buildings via BuildingDef.age. */
  age: number;
  hazard: HazardSpec;
  scarcity: ResourceKey;
  scarcityNote: string;
  /** Base starting resources (whole units) before inheritance and traditions. */
  start: Resources;
  startPop: number;
  /** In-world years that pass AFTER this epoch before the next society founds itself. */
  yearsAfter: number;
  brief: string;
  goal: string;
}

export interface ScenarioSpec {
  id: string;
  name: string;
  tagline: string;
  epochs: EpochSpec[];
  /** Win condition at the end of the final epoch. */
  victory: { minSurvivors: number; minHeritage: number; minRetainedTechs: number };
}

export const GREENVALE: ScenarioSpec = {
  id: 'greenvale',
  name: 'Greenvale',
  tagline: 'Three ages. One landscape. Every choice survives.',
  victory: { minSurvivors: 8, minHeritage: 1, minRetainedTechs: 3 },
  epochs: [
    {
      index: 0,
      id: 'founders',
      name: 'The Founders',
      ageName: 'Age of Thatch',
      age: 0,
      hazard: {
        kind: 'fire',
        name: 'Wildfire',
        headline: 'The Great Fire',
        strength: 330,
        warnings: [
          'Dry wind from the western ridge. Smoke on the horizon — a wildfire is coming.',
          'The fire is racing through the forest toward the valley!',
          'Embers are falling on the village!',
        ],
      },
      scarcity: 'stone',
      scarcityNote: 'Stone is scarce: only a small outcrop lies near the village.',
      start: { food: 30, timber: 30, stone: 15, knowledge: 0 },
      startPop: 10,
      yearsAfter: 420,
      brief:
        'Ten settlers have found a green valley. A dry wind is rising — the forest will burn within the minute.',
      goal: 'Feed your people, then decide what the valley must remember when the fire passes.',
    },
    {
      index: 1,
      id: 'river_kingdom',
      name: 'The River Kingdom',
      ageName: 'Age of Bronze',
      age: 1,
      hazard: {
        kind: 'flood',
        name: 'Great Flood',
        headline: 'The Great Flood',
        strength: 200,
        warnings: [
          'Snowmelt and storm in the hills. The river is rising — a great flood is coming.',
          'The river is breaking its banks!',
          'Floodwater is reaching the low fields!',
        ],
      },
      scarcity: 'timber',
      scarcityNote: 'Timber is scarce: the old forests burned, and bare slopes shed water faster.',
      start: { food: 24, timber: 20, stone: 12, knowledge: 0 },
      startPop: 8,
      yearsAfter: 520,
      brief: 'Centuries on, new settlers walk the burnt-and-regrown valley. The river remembers.',
      goal: 'Protect the low ground — or live above it. Reuse what the first people left behind.',
    },
    {
      index: 2,
      id: 'iron_dawn',
      name: 'Iron Dawn',
      ageName: 'Age of Iron',
      age: 2,
      hazard: {
        kind: 'quake',
        name: 'Earthquake',
        headline: 'The Great Quake',
        strength: 940,
        warnings: [
          'Birds flee the valley and wells run dry. The ground will shake soon.',
          'Tremors are rattling the walls — the quake is close!',
          'The earth is about to break!',
        ],
      },
      scarcity: 'food',
      scarcityNote: 'Food is scarce: floods and fields have worn the soil thin.',
      start: { food: 20, timber: 26, stone: 16, knowledge: 0 },
      startPop: 8,
      yearsAfter: 0,
      brief:
        'Iron smiths and masons arrive in a land of ancient stone. One more collapse will decide whether the valley breaks the cycle.',
      goal: 'Survive the final quake with a living village, a landmark and knowledge that outlasts you.',
    },
  ],
};

/**
 * A second scenario on the same engine: the first two ages are Greenvale's (fire, flood), but the final age is an
 * ashfall winter — wet ash breaks thatch roofs and no harvest comes, so the larders decide who lives.
 */
export const ASHEN: ScenarioSpec = {
  id: 'ashen',
  name: 'The Ashen Winter',
  tagline: 'Fire, flood — and then the sky falls.',
  victory: GREENVALE.victory,
  epochs: [
    GREENVALE.epochs[0]!,
    GREENVALE.epochs[1]!,
    {
      ...GREENVALE.epochs[2]!,
      id: 'ashen_winter',
      name: 'The Ashen Winter',
      ageName: 'Age of Iron',
      hazard: {
        kind: 'ash',
        name: 'Ashfall winter',
        headline: 'The Ashen Winter',
        strength: 700,
        warnings: [
          'The ridge has been smoking for days. The sky to the east is turning the colour of lead.',
          'Grey flakes are drifting into the valley — the ash is coming down!',
          'The sun is gone. Roofs are groaning under the ash, and nothing will grow this year!',
        ],
      },
      scarcity: 'food',
      scarcityNote: 'Food is scarce, and for a whole winter no harvest will come.',
      brief:
        'Forge-smoke and iron towns, built over the old ruins. Far to the east a mountain has woken: when its ash falls the fields will fail.',
      goal: 'Put food by before the sky darkens, keep the roofs steep and stone, and let something of yours stand through the winter.',
    },
  ],
};

export const SCENARIOS: Record<string, ScenarioSpec> = { greenvale: GREENVALE, ashen: ASHEN };

export function getScenario(id: string): ScenarioSpec {
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}

/**
 * Difficulty changes what the world does and what winning asks for — never the rules or the clock.
 * `strengthPm` scales every hazard (1000 = as authored); the deltas shift the scenario's victory thresholds.
 */
export const DIFFICULTY: Record<
  Difficulty,
  { name: string; blurb: string; strengthPm: number; survivors: number; heritage: number; techs: number }
> = {
  gentle: {
    name: 'Gentle',
    blurb: 'Milder catastrophes; two retained technologies and six survivors are enough.',
    strengthPm: 880,
    survivors: -2,
    heritage: 0,
    techs: -1,
  },
  normal: {
    name: 'Normal',
    blurb: 'The authored challenge.',
    strengthPm: 1000,
    survivors: 0,
    heritage: 0,
    techs: 0,
  },
  hard: {
    name: 'Hard',
    blurb: 'Fiercer catastrophes; ten survivors, two surviving landmarks and four retained technologies.',
    strengthPm: 1150,
    survivors: 2,
    heritage: 1,
    techs: 1,
  },
};

export function victoryFor(s: ScenarioSpec, d: Difficulty): ScenarioSpec['victory'] {
  const k = DIFFICULTY[d];
  return {
    minSurvivors: s.victory.minSurvivors + k.survivors,
    minHeritage: s.victory.minHeritage + k.heritage,
    minRetainedTechs: s.victory.minRetainedTechs + k.techs,
  };
}

export function scaledStrength(d: Difficulty | undefined, strength: number): number {
  return Math.round((strength * DIFFICULTY[d ?? 'normal'].strengthPm) / 1000);
}
