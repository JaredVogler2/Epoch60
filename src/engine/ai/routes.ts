import type { Campaign, LaborFocus, StoryPrompt, TechId, TraditionId } from '../core/types';
import { techCost } from '../economy/modifiers';
import { getScenario } from '../content/scenario';
import { bestExcavation, type Policy, type Want } from './bots';

/* ------------------------------------------------------------------ */
/* Policies                                                            */
/* ------------------------------------------------------------------ */

const wantsOnly = (ws: Want[]) => ws;

/** The hazard the current age will bring (a veteran of the scenario knows it). */
const hazardOf = (c: Campaign) => getScenario(c.scenario).epochs[c.epoch]?.hazard.kind;

/** Put idle hands on the archive while a wanted technology is still unaffordable. */
function scholarly(targets: (c: Campaign) => TechId[]): (c: Campaign) => LaborFocus {
  return (c) => {
    if (c.civ.research) return 'balanced';
    const next = targets(c).find((t) => !c.civ.techs.includes(t));
    if (!next) return 'balanced';
    const hasArchive = c.structures.some((s) => s.kind === 'archive' && s.status === 'active');
    return hasArchive && c.civ.res.knowledge < techCost(c, next) ? 'knowledge' : 'balanced';
  };
}

/** Answer each story with a fixed temperament: first matching option wins, otherwise the deadline decides. */
function temperament(prefs: Partial<Record<StoryPrompt['story'], string>>): Policy['choose'] {
  return (_c, p) => {
    const o = prefs[p.story];
    return o && p.options.some((x) => x.id === o) ? o : null;
  };
}

function pick(prefs: TraditionId[]): (c: Campaign) => TraditionId {
  return (c) => {
    const offered = c.lineage.interregnum?.traditions.map((t) => t.id) ?? [];
    return prefs.find((p) => offered.includes(p)) ?? offered[0] ?? 'open_hands';
  };
}

/**
 * Route A — Engineers: hold the line with stone and earthworks and let the forecast aim every defence. After the
 * fire they refound above the flood line and keep that hearth through the quake: it is their landmark.
 */
const hardMode = (c: Campaign) => c.difficulty === 'hard';

// Hard asks for four retained technologies and ten survivors: the engineers raise a second archive in the second age
// (it doubles their knowledge), learn hydrology in the third and take Open Hands (two more founders) after the flood.
// Normal and Gentle play are untouched by this.
const engineersScholar = scholarly((c) =>
  c.epoch === 0
    ? ['masonry', 'writing']
    : c.epoch === 1
      ? ['seismic_engineering']
      : hardMode(c)
        ? ['hydrology']
        : [],
);

const engineersTraditions = pick([
  'river_wardens',
  'deep_foundations',
  'stone_hearted',
  'fire_wardens',
  'open_hands',
]);
const engineersHardTraditions = pick([
  'open_hands',
  'deep_foundations',
  'stone_hearted',
  'river_wardens',
  'fire_wardens',
]);

export const engineers: Policy = {
  name: 'engineers',
  // Before an ashfall winter the only thing that matters is the larder.
  focus: (c) => (c.epoch === 2 && hazardOf(c) === 'ash' ? 'food' : engineersScholar(c)),
  wants: (c): Want[] => {
    const e = c.epoch;
    if (e === 0)
      return wantsOnly([
        {
          id: 'archive',
          kind: 'archive',
          count: 1,
          save: true,
          spot: { avoidEpochs: [1], maxDist: 24, high: true },
        },
        { id: 'farm', kind: 'farm', count: 1, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        { id: 'r-masonry', research: 'masonry' },
        { id: 'cottage', kind: 'cottage', count: 2, spot: { avoidHazard: true } },
        { id: 'firebreaks', kind: 'firebreak', count: 3, mitigate: { stride: 2, maxDist: 14 } },
        { id: 'quarry', kind: 'quarry', count: 1 },
        { id: 'r-writing', research: 'writing' },
        { id: 'repair', repair: true },
      ]);
    if (e === 1)
      return wantsOnly([
        { id: 'r-seismic', research: 'seismic_engineering' },
        { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
        // Hard: the camp and quarry first (the fire took the camp), then save for the second landmark.
        ...(hardMode(c)
          ? ([
              { id: 'lumber-h', kind: 'lumber_camp', count: 1 },
              { id: 'quarry-h', kind: 'quarry', count: 1 },
              {
                id: 'archive-2',
                kind: 'archive',
                count: 2,
                save: true,
                spot: { avoidEpochs: [2], maxDist: 24, high: true },
              },
            ] as Want[])
          : []),
        { id: 'stone-house', kind: 'stone_house', count: 3, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        { id: 'quarry', kind: 'quarry', count: 1 },
        { id: 'cottage', kind: 'cottage', count: 2, spot: { avoidHazard: true } },
        { id: 'repair', repair: true },
      ]);
    if (hazardOf(c) === 'ash')
      return wantsOnly([
        ...(hardMode(c) ? [{ id: 'r-hydro', research: 'hydrology' as const }] : []),
        { id: 'farm', kind: 'farm', count: 2, save: true, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        { id: 'granary', kind: 'granary', count: 2, save: true, spot: { avoidHazard: true } },
        { id: 'reinforce', reinforce: ['archive', 'stone_house', 'cottage'] },
        { id: 'stone-house', kind: 'stone_house', count: 3, spot: { avoidHazard: true } },
        { id: 'repair', repair: true },
      ]);
    return wantsOnly([
      { id: 'walls', kind: 'retaining_wall', count: 2, mitigate: { stride: 2, maxDist: 24 } },
      ...(hardMode(c) ? [{ id: 'r-hydro', research: 'hydrology' as const }] : []),
      { id: 'reinforce', reinforce: ['archive', 'stone_house', 'cottage'] },
      { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
      { id: 'stone-house', kind: 'stone_house', count: 3, spot: { avoidHazard: true } },
      { id: 'repair', repair: true },
    ]);
  },
  choose: temperament({
    dry_wind: 'clear_brush',
    river_rising: 'sandbag',
    foreshock: 'brace_worst',
    ash_warning: 'steep_roofs',
    dam_leak: 'repair_now',
    historian: 'fund',
    refugees: 'welcome',
  }),
  // High ground after the fire (the flood never reaches that hearth), then the same hearth again after the flood.
  site: (c) => (c.epoch === 0 ? 2 : 0),
  tradition: (c) => (hardMode(c) && c.epoch === 1 ? engineersHardTraditions : engineersTraditions)(c),
  excavate: bestExcavation,
};

/** Route B — Archivists: carry knowledge, scatter risk, found on safe ground and dig up the past. */
export const archivists: Policy = {
  name: 'archivists',
  focus: scholarly((c) =>
    c.epoch === 0 ? ['writing', 'masonry'] : c.epoch === 1 ? ['hydrology'] : ['seismic_engineering'],
  ),
  wants: (c): Want[] => {
    const e = c.epoch;
    if (e === 0)
      return wantsOnly([
        {
          id: 'archive',
          kind: 'archive',
          count: 1,
          save: true,
          spot: { avoidEpochs: [1, 2], maxDist: 26, high: true },
        },
        { id: 'farm', kind: 'farm', count: 1, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        { id: 'r-writing', research: 'writing' },
        { id: 'quarry', kind: 'quarry', count: 1 },
        {
          id: 'vault',
          kind: 'seed_vault',
          count: 1,
          save: true,
          spot: { avoidEpochs: [0, 1, 2], maxDist: 26, high: true },
        },
        { id: 'r-masonry', research: 'masonry' },
        { id: 'cottage', kind: 'cottage', count: 2, spot: { avoidHazard: true } },
        { id: 'repair', repair: true },
      ]);
    if (e === 1)
      return wantsOnly([
        { id: 'r-hydro', research: 'hydrology' },
        { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        {
          id: 'archive',
          kind: 'archive',
          count: 2,
          save: true,
          spot: { avoidEpochs: [2], maxDist: 26, high: true },
        },
        { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
        { id: 'repair', repair: true },
      ]);
    return wantsOnly([
      { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
      { id: 'lumber', kind: 'lumber_camp', count: 1 },
      ...(hazardOf(c) === 'ash'
        ? [{ id: 'granary', kind: 'granary' as const, count: 2, save: true, spot: { avoidHazard: true } }]
        : []),
      { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
      { id: 'r-seismic', research: 'seismic_engineering' },
      { id: 'repair', repair: true },
    ]);
  },
  choose: temperament({
    dry_wind: 'gather_timber',
    river_rising: 'harvest_early',
    foreshock: 'brace_homes',
    ash_warning: 'trade_grain',
    historian: 'fund',
    refugees: 'welcome',
  }),
  site: () => 2,
  tradition: pick(['open_hands', 'high_ground', 'river_wardens']),
  excavate: bestExcavation,
};

/**
 * The comfortable but unprepared village: it farms, builds homes and a quarry and an archive, but never researches
 * and never thinks about what the next age will do to its landmark. It thrives — and still loses.
 */
export const builder: Policy = {
  name: 'builder',
  focus: () => 'balanced',
  wants: () =>
    wantsOnly([
      { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
      { id: 'lumber', kind: 'lumber_camp', count: 1 },
      { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
      { id: 'quarry', kind: 'quarry', count: 1, from: 30 },
      { id: 'archive', kind: 'archive', count: 1, from: 80, spot: { avoidHazard: true, high: true } },
      { id: 'repair', repair: true },
    ]),
  site: () => 2,
  tradition: () => 'open_hands' as TraditionId,
  excavate: bestExcavation,
};

/** The current-age maximizer: rushes output and homes, founds on the richest soil, ignores legacy and research. */
export const maximizer: Policy = {
  name: 'maximizer',
  focus: () => 'build',
  wants: (c): Want[] =>
    wantsOnly([
      { id: 'farm', kind: 'farm', count: 2 },
      { id: 'lumber', kind: 'lumber_camp', count: 1 },
      { id: 'cottage', kind: 'cottage', count: 4 },
      { id: 'workshop', kind: 'workshop', count: 1 },
      { id: 'quarry', kind: 'quarry', count: 1 },
      { id: 'farm2', kind: 'farm', count: 4 },
      { id: 'house', kind: c.civ.techs.includes('masonry') ? 'stone_house' : 'cottage', count: 8 },
      { id: 'repair', repair: true },
    ]),
  site: () => 1,
  tradition: pick(['ash_farmers', 'silt_farmers', 'open_hands']),
  excavate: () => null,
};

/** The steward: soil, seed and woodland first; a Seed Vault and one Archive; founds on high ground. */
export const steward: Policy = {
  name: 'steward',
  focus: scholarly((c) => (c.epoch === 0 ? ['forestry', 'irrigation'] : ['crop_rotation', 'writing'])),
  wants: (): Want[] =>
    wantsOnly([
      { id: 'farm', kind: 'farm', count: 1, spot: { avoidHazard: true } },
      { id: 'lumber', kind: 'lumber_camp', count: 1 },
      { id: 'r-forestry', research: 'forestry' },
      {
        id: 'vault',
        kind: 'seed_vault',
        count: 1,
        save: true,
        spot: { avoidEpochs: [0, 1, 2], maxDist: 26, high: true },
      },
      { id: 'grove', kind: 'grove', count: 2, spot: { avoidHazard: true } },
      { id: 'r-irrigation', research: 'irrigation' },
      { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
      { id: 'r-rotation', research: 'crop_rotation' },
      { id: 'archive', kind: 'archive', count: 1, spot: { avoidEpochs: [1, 2], maxDist: 26, high: true } },
      { id: 'r-writing', research: 'writing' },
      { id: 'repair', repair: true },
    ]),
  site: () => 2,
  tradition: pick(['high_ground', 'ash_farmers', 'open_hands']),
  excavate: bestExcavation,
};

export const ROUTES: Record<string, Policy> = { engineers, archivists, builder, maximizer, steward };

/**
 * The least a player can do that knows the scenario (K-003): one farm, one lumber camp, one Archive out of the
 * later hazards' way, three cheap technologies and three cottages — plus, optionally, one landmark: a Seed Vault on
 * safe ground, or a hearth founded above the flood and kept. Not a route; a yardstick for how much Normal demands
 * (`scripts/recipes.ts`, `tests/engine/routes.test.ts`).
 */
export function minimalRecipe(landmark: 'none' | 'vault' | 'hold'): Policy {
  return {
    name: `recipe-${landmark}`,
    focus: scholarly(() => ['writing', 'masonry', 'irrigation']),
    wants: () =>
      wantsOnly([
        { id: 'farm', kind: 'farm', count: 1, spot: { avoidHazard: true } },
        { id: 'lumber', kind: 'lumber_camp', count: 1 },
        {
          id: 'archive',
          kind: 'archive',
          count: 1,
          save: true,
          spot: { avoidEpochs: [1, 2], maxDist: 26, high: true },
        },
        ...(landmark === 'vault'
          ? [
              {
                id: 'vault',
                kind: 'seed_vault' as const,
                count: 1,
                save: true,
                spot: { avoidEpochs: [0, 1, 2], maxDist: 26, high: true },
              },
            ]
          : []),
        { id: 'r-writing', research: 'writing' },
        { id: 'r-masonry', research: 'masonry' },
        { id: 'r-irrigation', research: 'irrigation' },
        { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
        { id: 'repair', repair: true },
      ]),
    site: landmark === 'hold' ? (c) => (c.epoch === 0 ? 2 : 0) : () => 0,
    tradition: (c) => c.lineage.interregnum?.traditions[0]?.id ?? 'open_hands',
    excavate: () => null,
  };
}
