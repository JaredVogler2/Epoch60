import type { Campaign, Difficulty, HazardKind, ResourceKey, Resources } from '../core/types';

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
    blurb: 'Fiercer catastrophes; ten survivors and four retained technologies.',
    strengthPm: 1150,
    survivors: 2,
    heritage: 0,
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

/* ------------------------------------------------------------------ */
/* The long chronicle: ages past the scenario's last                    */
/* ------------------------------------------------------------------ */

/** A lineage that won may carry its chronicle on past the scenario's last age, up to this many ages in all. */
export const MAX_AGES = 12;
/** Years between the ages of the long chronicle (the authored ages set their own). */
export const CHRONICLE_YEARS = 400;
/** Each age past the scenario's last meets its catastrophe this much fiercer, in permille of the authored strength. */
export const CHRONICLE_STEP_PM = 100;

const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven'];
/**
 * The peoples of the long chronicle, named (like the authored ages' peoples) for the catastrophe that returns in their
 * age: one name per return.
 */
const CHRONICLE_NAMES: Record<HazardKind, [string, string, string]> = {
  fire: ['The Ember Folk', 'The Smoke Kings', 'The Ash-Grove People'],
  flood: ['The High-Water Folk', 'The Drowned Kings', 'The Rain People'],
  quake: ['The Broken-Ground Folk', 'The Shaking Kings', 'The Fault People'],
  ash: ['The Grey-Sky Folk', 'The Pale Kings', 'The Long-Dark People'],
};
const RETURNS: Record<HazardKind, string> = {
  fire: 'The forests have grown back old and dry, and the fire is coming again, fiercer than the founders knew.',
  flood: 'The river has had centuries to gather itself; it will rise higher than the River Kingdom ever saw.',
  quake: 'Deep under the old stones the fault is waking again, stronger than any quake the valley remembers.',
  ash: 'In the east the mountain smokes once more, and its ash will lie deeper than in the first winter.',
};
const SCARCE: Record<ResourceKey, string> = {
  food: 'Food is scarce: the settlers carry little, and the old fields must feed them.',
  timber: 'Timber is scarce: the settlers carry little, and must cut or salvage the rest.',
  stone: 'Stone is scarce: the settlers carry little, and must quarry or salvage the rest.',
  knowledge: 'Knowledge is scarce: the settlers carry little of it.',
};
const CHRONICLE_GOAL =
  'Endure: every returning catastrophe is fiercer than the last. Rest the chronicle at any debrief, or carry it to the twelfth age.';

const specCache = new Map<string, EpochSpec>();

/**
 * The spec of any age of a lineage. The scenario's own ages are as authored; a lineage carrying its chronicle on
 * (`endless`) waits centuries after the last of them, and each later age brings back the scenario's catastrophes in
 * their order, each return a step fiercer, with the last age's architecture and the returning age's provisions.
 */
export function epochSpec(c: Pick<Campaign, 'scenario' | 'endless'>, epoch: number): EpochSpec {
  const s = getScenario(c.scenario);
  const n = s.epochs.length;
  if (epoch < n - 1 || (epoch === n - 1 && !c.endless)) return s.epochs[epoch]!;
  const key = `${s.id}:${epoch}`;
  const hit = specCache.get(key);
  if (hit) return hit;
  const last = s.epochs[n - 1]!;
  let spec: EpochSpec;
  if (epoch === n - 1) spec = { ...last, yearsAfter: CHRONICLE_YEARS };
  else {
    const base = s.epochs[(epoch - n) % n]!;
    const kind = base.hazard.kind;
    let times = 0;
    for (let e = 0; e < epoch; e++) if (s.epochs[e < n ? e : (e - n) % n]!.hazard.kind === kind) times++;
    spec = {
      index: epoch,
      id: `${base.id}_${epoch + 1}`,
      name: CHRONICLE_NAMES[kind][Math.min(2, Math.floor((epoch - n) / n))]!,
      ageName: last.ageName,
      age: last.age,
      hazard: {
        ...base.hazard,
        headline: base.hazard.headline.replace(
          /^The /,
          `The ${ORDINAL[Math.min(times, ORDINAL.length - 1)]} `,
        ),
        strength: Math.round((base.hazard.strength * (1000 + CHRONICLE_STEP_PM * (epoch - n + 1))) / 1000),
      },
      scarcity: base.scarcity,
      scarcityNote: SCARCE[base.scarcity],
      start: base.start,
      startPop: base.startPop,
      yearsAfter: CHRONICLE_YEARS,
      brief: `${COUNT[epoch] ?? epoch} ages have risen and fallen in this valley. ${RETURNS[kind]}`,
      goal: CHRONICLE_GOAL,
    };
  }
  specCache.set(key, spec);
  return spec;
}

/** The age that would follow this one, or null when the lineage cannot go on to another. */
export function nextEpochSpec(c: Pick<Campaign, 'scenario' | 'endless' | 'epoch'>): EpochSpec | null {
  const n = getScenario(c.scenario).epochs.length;
  const next = c.epoch + 1;
  return next < n || (c.endless && next < MAX_AGES) ? epochSpec(c, next) : null;
}

export function scaledStrength(d: Difficulty | undefined, strength: number): number {
  return Math.round((strength * DIFFICULTY[d ?? 'normal'].strengthPm) / 1000);
}
