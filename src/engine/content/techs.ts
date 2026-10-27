import type { TechId } from '../core/types';

export type TechBranch = 'industry' | 'ecology' | 'resilience';

export interface TechDef {
  id: TechId;
  name: string;
  branch: TechBranch;
  blurb: string;
  /** Knowledge cost in whole units. */
  cost: number;
  /** Research duration in ticks. */
  ticks: number;
  requires: TechId[];
  /** Unlock summary for the UI. */
  unlocks: string;
  /** Only techs with enabled=true are offered. */
  enabled: boolean;
}

export const TECHS: Record<TechId, TechDef> = {
  masonry: {
    id: 'masonry',
    name: 'Masonry',
    branch: 'industry',
    cost: 10,
    ticks: 80,
    requires: [],
    enabled: true,
    blurb: 'Dressed stone. Quarries yield 25% more; unlocks the Stone House.',
    unlocks: 'Stone House · Quarry +25%',
  },
  bronze_tools: {
    id: 'bronze_tools',
    name: 'Bronze Tools',
    branch: 'industry',
    cost: 16,
    ticks: 100,
    requires: ['masonry'],
    enabled: false,
    blurb: 'Hard tools. All builders work 15% faster; unlocks the Bridge.',
    unlocks: 'Bridge · Builders +15%',
  },
  ironworking: {
    id: 'ironworking',
    name: 'Ironworking',
    branch: 'industry',
    cost: 24,
    ticks: 120,
    requires: ['bronze_tools'],
    enabled: false,
    blurb: 'Smelting. Unlocks the Forge and iron-shod tools.',
    unlocks: 'Forge',
  },
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    branch: 'ecology',
    cost: 10,
    ticks: 80,
    requires: [],
    enabled: true,
    blurb: 'Ditches and channels. Farms yield 25% more, most of all on dry soil.',
    unlocks: 'Farm +25%',
  },
  crop_rotation: {
    id: 'crop_rotation',
    name: 'Crop Rotation',
    branch: 'ecology',
    cost: 14,
    ticks: 90,
    requires: ['irrigation'],
    enabled: false,
    blurb: 'Fields rest in turn. Farms stop draining the soil and slowly enrich it.',
    unlocks: 'No soil drain',
  },
  forestry: {
    id: 'forestry',
    name: 'Forestry',
    branch: 'ecology',
    cost: 12,
    ticks: 80,
    requires: [],
    enabled: false,
    blurb: 'Managed woodland. Lumber camps spare 40% of the forest; unlocks the Grove.',
    unlocks: 'Grove · Lumber −40% forest loss',
  },
  writing: {
    id: 'writing',
    name: 'Writing',
    branch: 'resilience',
    cost: 10,
    ticks: 80,
    requires: [],
    enabled: true,
    blurb: 'Marks on clay. Archives carry two more technologies and read 40% faster.',
    unlocks: 'Archive +2 capacity · Archive +40%',
  },
  hydrology: {
    id: 'hydrology',
    name: 'Hydrology',
    branch: 'resilience',
    cost: 16,
    ticks: 100,
    requires: ['writing'],
    enabled: false,
    blurb: 'Reading rivers. Unlocks the Levee and Dam, and a sharper flood forecast.',
    unlocks: 'Levee · Dam',
  },
  seismic_engineering: {
    id: 'seismic_engineering',
    name: 'Seismic Engineering',
    branch: 'resilience',
    cost: 22,
    ticks: 120,
    requires: ['writing', 'masonry'],
    enabled: false,
    blurb: 'Braced frames and buttresses. All buildings resist tremors; unlocks the Retaining Wall.',
    unlocks: 'Retaining Wall · Quake resistance +250',
  },
};

export const TECH_IDS = Object.keys(TECHS) as TechId[];
