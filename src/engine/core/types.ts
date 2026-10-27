import type { RngState } from './prng';

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

export type ResourceKey = 'food' | 'timber' | 'stone' | 'knowledge';
export const RESOURCE_KEYS: readonly ResourceKey[] = ['food', 'timber', 'stone', 'knowledge'];
export type Resources = Record<ResourceKey, number>;

export type BuildingKind =
  | 'hearth'
  | 'farm'
  | 'lumber_camp'
  | 'quarry'
  | 'cottage'
  | 'workshop'
  | 'archive'
  | 'seed_vault'
  | 'firebreak'
  | 'stone_house'
  | 'levee'
  | 'dam'
  | 'bridge'
  | 'retaining_wall'
  | 'forge'
  | 'grove';

export type TechId =
  | 'masonry'
  | 'bronze_tools'
  | 'ironworking'
  | 'irrigation'
  | 'crop_rotation'
  | 'forestry'
  | 'writing'
  | 'hydrology'
  | 'seismic_engineering';

export type HazardKind = 'fire' | 'flood' | 'quake';

export type TraditionId =
  | 'remember_fire'
  | 'fire_wardens'
  | 'ash_farmers'
  | 'river_wardens'
  | 'high_ground'
  | 'silt_farmers'
  | 'stone_hearted'
  | 'deep_foundations'
  | 'open_hands';

export type Material = 'wood' | 'thatch' | 'stone' | 'earth' | 'iron';

/** What the labor allocator staffs first. `build` hands most labor to construction. */
export type LaborFocus = 'balanced' | 'build' | 'food' | 'timber' | 'stone' | 'knowledge';

export type StructureStatus = 'constructing' | 'active' | 'damaged' | 'rubble' | 'buried';

/* ------------------------------------------------------------------ */
/* World (persistent across all epochs)                                */
/* ------------------------------------------------------------------ */

/**
 * Parallel typed-by-convention arrays indexed by `y * w + x`.
 * All scalar fields are integers; heights are 1/100 cell widths; field values are 0..1000.
 */
export interface World {
  w: number;
  h: number;
  seed: number;
  /** Terrain elevation. Building pads and quarries modify this permanently. */
  height: number[];
  /** 0 land, 1 river (deep), 2 ford (shallow, walkable). */
  water: number[];
  fertility: number[];
  forest: number[];
  /** Whole stone units remaining beneath each cell. */
  rock: number[];
  pollution: number[];
  /** Burn scar intensity left by fire (0..1000); decays slowly. */
  scar: number[];
  /** Silt left by floods. */
  silt: number[];
  /** Quarry/erosion damage to the slope. */
  erosion: number[];
  /** Structure id occupying the cell, or -1. Rubble keeps its cells until cleared. */
  occ: number[];
  /** Cells permanently shaped by flood-defence works / dams etc. (0 none). */
  riverCenter: { x: number; y: number }[];
  /** Hazard authoring for this scenario seed. */
  anchors: WorldAnchors;
}

export interface WorldAnchors {
  /** Founders' hearth cell. */
  hearth: { x: number; y: number };
  /** Where the wildfire starts and its prevailing wind direction (unit-ish step). */
  fireOrigin: { x: number; y: number };
  wind: { dx: number; dy: number };
  /** Quake epicentre. */
  quakeEpicenter: { x: number; y: number };
  /** Flood source: river inflow row. */
  hills: { x: number; y: number }[];
}

/* ------------------------------------------------------------------ */
/* Structures and legacy                                               */
/* ------------------------------------------------------------------ */

export interface Structure {
  id: number;
  kind: BuildingKind;
  /** Top-left cell of the footprint. */
  x: number;
  y: number;
  /** Footprint after rotation. */
  w: number;
  h: number;
  rot: 0 | 1;
  originEpoch: number;
  status: StructureStatus;
  /** Construction progress in milli labor-ticks. */
  progress: number;
  /** 0..1000. */
  integrity: number;
  /** Extra per-hazard resistance bought by techs/reinforcement/walls (permille). */
  bonus: { fire: number; flood: number; quake: number };
  /** Workers staffed this tick (render + UI). */
  workers: number;
  /** Production accumulators (milli) kept so tiny rates never truncate to zero. */
  acc: number;
  /** Fraction (permille) staffed on the last production tick. */
  staffing: number;
  /** Technologies written into an Archive. Persist in rubble until excavated. */
  storedTechs: TechId[];
  /** How it fell: set when status becomes damaged/rubble. */
  cause: HazardKind | 'decay' | 'cleared' | null;
  /** Salvage available in rubble. */
  salvage: { timber: number; stone: number };
  /** Rubble: 0 surface .. 3 deeply buried. Increases over ages and with flood silt. */
  burial: number;
  surveyed: boolean;
  excavated: boolean;
  /** Human-readable provenance, e.g. "Archive at (8,14) survived the Great Fire". */
  provenance: string[];
  /** Epoch in which this structure was last repaired or rebuilt (for heritage). */
  repairs: number;
}

/* ------------------------------------------------------------------ */
/* Civilization (epoch-scoped state)                                   */
/* ------------------------------------------------------------------ */

export interface ResearchJob {
  tech: TechId;
  remaining: number;
}

export interface Civ {
  res: Resources;
  pop: number;
  /** 0..1000 */
  morale: number;
  techs: TechId[];
  research: ResearchJob | null;
  focus: LaborFocus;
  traditions: TraditionId[];
  /** Counters used for score + causal debrief. Reset each epoch. */
  stats: EpochStats;
  /** Fractional accumulators for pop growth / starvation, in ticks. */
  popClock: number;
  starveClock: number;
  /** Last tick's labor split (render + UI only). */
  labor: { total: number; builders: number; idle: number };
}

export interface EpochStats {
  foodMade: number;
  foodEaten: number;
  timberMade: number;
  stoneMade: number;
  knowledgeMade: number;
  built: number;
  researched: number;
  decisions: number;
  born: number;
  starved: number;
  /** Peak population this epoch. */
  peakPop: number;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'beginEpoch' }
  | { type: 'build'; kind: BuildingKind; x: number; y: number; rot: 0 | 1 }
  | { type: 'cancel'; id: number }
  | { type: 'unplan'; seq: number }
  | { type: 'demolish'; id: number }
  | { type: 'repair'; id: number }
  | { type: 'reinforce'; id: number; hazard: HazardKind }
  | { type: 'research'; tech: TechId }
  | { type: 'setFocus'; focus: LaborFocus }
  | { type: 'choose'; prompt: number; option: string }
  | { type: 'continue' }
  | { type: 'survey'; id: number }
  | { type: 'excavate'; id: number }
  | { type: 'found'; site: number; tradition: TraditionId };

export type ActionType = Action['type'];

export interface LoggedAction {
  /** Tick (within the active epoch) at which the action was accepted. 0 outside ACTIVE. */
  tick: number;
  seq: number;
  epoch: number;
  action: Action;
}

/** Reason codes are stable strings the UI localizes; `message` is a developer fallback. */
export type ErrorCode =
  | 'wrong_phase'
  | 'unknown_kind'
  | 'locked_age'
  | 'locked_tech'
  | 'out_of_bounds'
  | 'on_water'
  | 'overlap'
  | 'too_steep'
  | 'not_enough'
  | 'need_deposit'
  | 'need_forest'
  | 'need_river'
  | 'need_hearth_access'
  | 'unreachable'
  | 'limit_reached'
  | 'queue_full'
  | 'no_such_structure'
  | 'bad_target'
  | 'already_done'
  | 'plan_slots_full'
  | 'no_slots'
  | 'tech_known'
  | 'tech_locked'
  | 'research_busy'
  | 'too_late'
  | 'invalid_choice'
  | 'game_over';

export interface ActionError {
  ok: false;
  code: ErrorCode;
  message: string;
  /** Alternatives that would be legal (e.g. nearby valid cells, missing resources). */
  hint?: Record<string, number | string>;
}

export interface ActionOk {
  ok: true;
  /** Structure id created or affected. */
  id?: number;
  /** True when the action was queued for the next tick rather than applied immediately. */
  queued?: boolean;
}

export type ActionResult = ActionOk | ActionError;

/* ------------------------------------------------------------------ */
/* Events, forecast, reports                                           */
/* ------------------------------------------------------------------ */

export type StoryId = 'dry_wind' | 'river_rising' | 'foreshock' | 'refugees' | 'historian' | 'dam_leak';

export interface StoryOption {
  id: string;
  label: string;
  /** The honest trade-off, in plain words. */
  detail: string;
  /** Whole resource units paid when the player (not the deadline) picks this option. */
  cost?: Partial<Record<ResourceKey, number>>;
}

/**
 * A small decision that arises from the actual state of the village. It never pauses play: if the deadline passes,
 * the default option (always the free, do-nothing one) is applied.
 */
export interface StoryPrompt {
  seq: number;
  story: StoryId;
  epoch: number;
  openedTick: number;
  deadlineTick: number;
  title: string;
  body: string;
  options: StoryOption[];
  defaultOption: string;
  status: 'open' | 'resolved';
  chosen: string | null;
  /** True when the deadline passed and the default was applied. */
  auto: boolean;
  outcome: string | null;
}

export interface SimEvent {
  tick: number;
  epoch: number;
  code: string;
  msg: string;
  /** Important events survive log trimming and are shown in the debrief. */
  important?: boolean;
  id?: number;
  x?: number;
  y?: number;
}

export interface HazardCell {
  x: number;
  y: number;
  /** Order/timing: smaller = earlier. Used by the presentation to animate spread. */
  arrival: number;
  /** 0..1000 */
  intensity: number;
}

export interface StructureImpact {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  before: StructureStatus;
  after: StructureStatus;
  exposure: number;
  damage: number;
  /** Plain-language reason shown in the debrief. */
  reason: string;
}

export interface HazardResult {
  kind: HazardKind;
  cells: HazardCell[];
  impacts: StructureImpact[];
  /** Max arrival, so the presentation can normalize its timeline. */
  span: number;
  /** Headline numbers: area affected etc. */
  area: number;
}

export interface Forecast {
  kind: HazardKind;
  name: string;
  /** Predicted result if the epoch ended now with the current state. */
  predicted: HazardResult;
  atRisk: number;
  predictedDeaths: number;
}

/** World fields of every hazard cell as they were just before the cataclysm (for the read-only presentation). */
export interface BeforeCells {
  /** Cell indices (y * w + x), parallel to the arrays below. */
  cells: number[];
  forest: number[];
  scar: number[];
  silt: number[];
}

export interface CollapseReport {
  epoch: number;
  /** Pre-collapse snapshot of affected cells; presentation only, never read by the simulation. */
  before: BeforeCells;
  hazard: HazardKind;
  hazardName: string;
  headline: string;
  survivorsBefore: number;
  deaths: number;
  survivors: number;
  structuresLost: number;
  structuresDamaged: number;
  structuresIntact: number;
  retainedTechs: TechId[];
  lostTechs: TechId[];
  result: HazardResult;
  /** 1–3 causal lines: what mattered, with a counterfactual. */
  causes: string[];
  /** Score breakdown. */
  score: ScoreBreakdown;
  /** Heritage structures that will carry over. */
  heritage: number[];
  /** Win/lose assessment for the campaign if this was the final epoch. */
  verdict: Verdict | null;
}

export interface ScoreBreakdown {
  people: number;
  livelihood: number;
  knowledge: number;
  ecology: number;
  heritage: number;
  total: number;
}

export interface Verdict {
  outcome: 'victory' | 'defeat';
  title: string;
  /** Per-condition progress, each readable. */
  conditions: { label: string; have: number; need: number; met: boolean }[];
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Lineage (global ledger across epochs)                               */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  epoch: number;
  title: string;
  text: string;
}

export interface Lineage {
  history: HistoryEntry[];
  /** Techs ever discovered, retained or not. */
  everKnown: TechId[];
  /** Techs known once but lost in a collapse (cheaper to rediscover). */
  lostTechs: TechId[];
  /** Reports of every completed epoch. */
  reports: CollapseReport[];
  /** Traditions chosen so far (each epoch picks one). */
  traditions: TraditionId[];
  /** Pre-resolved interregnum choices for the current gap. */
  interregnum: Interregnum | null;
  score: number;
}

export interface FoundingSite {
  x: number;
  y: number;
  label: string;
  note: string;
  /** Used so the UI can show tradeoffs. */
  fertility: number;
  /** Exposure (0..1000) to the NEXT epoch's hazard at this site. */
  risk: number;
  riskKind: HazardKind;
  elevation: number;
  onRuin: boolean;
}

export interface TraditionOption {
  id: TraditionId;
  because: string;
}

export interface Interregnum {
  years: number;
  surveysLeft: number;
  excavationsLeft: number;
  sites: FoundingSite[];
  traditions: TraditionOption[];
  summary: string[];
  /** Resources and technologies recovered from the ruins; they become the next society's starting stores. */
  yield: Resources;
  techs: TechId[];
  log: string[];
}

/* ------------------------------------------------------------------ */
/* Campaign state                                                      */
/* ------------------------------------------------------------------ */

export type Phase =
  'PREPARE' | 'ACTIVE' | 'COLLAPSE_PENDING' | 'COLLAPSING' | 'DEBRIEF' | 'INTERREGNUM' | 'VICTORY' | 'DEFEAT';

export type GameMode = 'standard' | 'assisted';

export interface Campaign {
  schema: number;
  rules: string;
  content: string;
  seed: number;
  scenario: string;
  mode: GameMode;
  phase: Phase;
  /** Paused is orthogonal to phase. A saved ACTIVE game always reloads paused. */
  paused: boolean;
  epoch: number;
  /** Ticks completed in the current active epoch (0..600). */
  tick: number;
  /** Ticks completed across the campaign (for replays). */
  totalTicks: number;
  nextId: number;
  seq: number;
  world: World;
  structures: Structure[];
  civ: Civ;
  lineage: Lineage;
  /** Actions accepted but not yet applied at a tick boundary. */
  queue: { seq: number; tick: number; action: Action; paid: boolean }[];
  rng: RngState;
  events: SimEvent[];
  /** Story decisions offered during play (most recent last; trimmed). */
  prompts: StoryPrompt[];
  actionLog: LoggedAction[];
  /** Set once the hazard of the current epoch has been resolved. Prevents double application. */
  collapseResolved: boolean;
  report: CollapseReport | null;
  /** Highest forecast level already announced this epoch (0 none .. 3). */
  forecastLevel: number;
}
