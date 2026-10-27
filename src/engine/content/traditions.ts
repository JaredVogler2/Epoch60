import type { TraditionId } from '../core/types';

/** Additive modifier bundle. All values are permille deltas unless noted. */
export interface Modifiers {
  buildSpeed: number;
  foodRate: number;
  timberRate: number;
  stoneRate: number;
  knowledgeRate: number;
  researchCost: number;
  fireResist: number;
  floodResist: number;
  quakeResist: number;
  /** Absolute extras at epoch start. */
  startPop: number;
  startFood: number;
  startTimber: number;
  startStone: number;
}

export const ZERO_MODS: Modifiers = {
  buildSpeed: 0,
  foodRate: 0,
  timberRate: 0,
  stoneRate: 0,
  knowledgeRate: 0,
  researchCost: 0,
  fireResist: 0,
  floodResist: 0,
  quakeResist: 0,
  startPop: 0,
  startFood: 0,
  startTimber: 0,
  startStone: 0,
};

export interface TraditionDef {
  id: TraditionId;
  name: string;
  /** Shown as the upside / downside so the cost is never hidden. */
  upside: string;
  downside: string;
  mods: Partial<Modifiers>;
  /** Offered when this hazard just struck (null = always eligible as a generic option). */
  after: 'fire' | 'flood' | 'quake' | null;
}

export const TRADITIONS: Record<TraditionId, TraditionDef> = {
  remember_fire: {
    id: 'remember_fire',
    name: 'Remember the Fire',
    after: 'fire',
    upside: 'Fire resistance +25% on every building.',
    downside: 'Cautious builders: construction −5%.',
    mods: { fireResist: 250, buildSpeed: -50 },
  },
  fire_wardens: {
    id: 'fire_wardens',
    name: 'Fire Wardens',
    after: 'fire',
    upside: 'Fire resistance +15%; construction +5%.',
    downside: 'Fewer hands for the fields: food −5%.',
    mods: { fireResist: 150, buildSpeed: 50, foodRate: -50 },
  },
  ash_farmers: {
    id: 'ash_farmers',
    name: 'Ash Farmers',
    after: 'fire',
    upside: 'Fields on burnt ground thrive: farm output +15%.',
    downside: 'Timber camps resented: timber −10%.',
    mods: { foodRate: 150, timberRate: -100 },
  },
  river_wardens: {
    id: 'river_wardens',
    name: 'River Wardens',
    after: 'flood',
    upside: 'Flood resistance +25% on every building.',
    downside: 'Levee duty: food −5%.',
    mods: { floodResist: 250, foodRate: -50 },
  },
  silt_farmers: {
    id: 'silt_farmers',
    name: 'Silt Farmers',
    after: 'flood',
    upside: 'Rich silt: farm output +15%.',
    downside: 'Floods weigh less on the mind: flood resistance −10%.',
    mods: { foodRate: 150, floodResist: -100 },
  },
  high_ground: {
    id: 'high_ground',
    name: 'High Ground',
    after: 'flood',
    upside: 'Flood resistance +15%, quake resistance +10%.',
    downside: 'Long climbs: construction −10%.',
    mods: { floodResist: 150, quakeResist: 100, buildSpeed: -100 },
  },
  stone_hearted: {
    id: 'stone_hearted',
    name: 'Stone-Hearted',
    after: 'quake',
    upside: 'Stone output +20%; quake resistance +15%.',
    downside: 'Little timber sense: timber −10%.',
    mods: { stoneRate: 200, quakeResist: 150, timberRate: -100 },
  },
  deep_foundations: {
    id: 'deep_foundations',
    name: 'Deep Foundations',
    after: 'quake',
    upside: 'Quake resistance +30%.',
    downside: 'Slow digging: construction −10%.',
    mods: { quakeResist: 300, buildSpeed: -100 },
  },
  open_hands: {
    id: 'open_hands',
    name: 'Open Hands',
    after: null,
    upside: '+2 founding settlers; research 10% cheaper.',
    downside: 'More mouths: starting food −6.',
    mods: { startPop: 2, researchCost: -100, startFood: -6 },
  },
};

export function sumModifiers(ids: TraditionId[]): Modifiers {
  const m = { ...ZERO_MODS };
  for (const id of ids) {
    const t = TRADITIONS[id];
    for (const k of Object.keys(t.mods) as (keyof Modifiers)[]) m[k] += t.mods[k] ?? 0;
  }
  return m;
}
