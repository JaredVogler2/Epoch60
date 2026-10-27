import type { HazardKind, ResourceKey, Resources } from '../core/types';

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
  victory: { minSurvivors: 8, minHeritage: 1, minRetainedTechs: 2 },
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

export const SCENARIOS: Record<string, ScenarioSpec> = { greenvale: GREENVALE };

export function getScenario(id: string): ScenarioSpec {
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
}
