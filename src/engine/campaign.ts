import { BUILDINGS, costOf, getDef } from './content/buildings';
import { MODIFIERS, checkModifiers, modifierMods } from './content/modifiers';
import { epochSpec, getScenario } from './content/scenario';
import { TECHS } from './content/techs';
import {
  CONTENT_VERSION,
  EPOCH_TICKS,
  FORECAST_LEAD_TICKS,
  MAX_PLAN_SLOTS,
  MAX_QUEUE,
  RULES_VERSION,
  SCHEMA_VERSION,
  UNIT,
} from './core/constants';
import { emit } from './core/events';
import { createRngState } from './core/prng';
import type {
  Action,
  ActionError,
  ActionResult,
  BuildingKind,
  Campaign,
  ErrorCode,
  Forecast,
  Difficulty,
  GameMode,
  ModifierId,
  Resources,
  Structure,
} from './core/types';
import {
  allocateLabor,
  stepConstruction,
  stepPopulation,
  stepProduction,
  stepResearch,
} from './economy/economy';
import { canAfford, hasTech, reservedCost, techCost } from './economy/modifiers';
import { checkPlacement, countKind, epochAge } from './economy/placement';
import { createStructure, findStructure, levelPad, removeStructure } from './economy/structures';
import { collapseEpoch, computeDeaths } from './legacy/collapse';
import { canEndure, chronicleOver } from './legacy/endless';
import { enterInterregnum, excavateRuin, foundNextEpoch, surveyRuin } from './legacy/inheritance';
import { applyChoice, checkChoice, stepStories } from './events/story';
import { generateWorld } from './world/generate';
import { resolveHazard } from './world/hazards';
import { applyWorldModifiers, placeBuriedLibrary } from './world/modify';

function err(code: ErrorCode, message: string, hint?: ActionError['hint']): ActionError {
  return { ok: false, code, message, hint };
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export function createCampaign(
  seed: number,
  mode: GameMode = 'standard',
  scenarioId = 'greenvale',
  difficulty: Difficulty = 'normal',
  modifiers: readonly ModifierId[] = [],
): Campaign {
  const scenario = getScenario(scenarioId);
  const spec = scenario.epochs[0]!;
  const chosen = checkModifiers(modifiers, scenarioId);
  if (!chosen.ok) throw new Error(`Invalid challenges: ${chosen.why}`);
  const world = generateWorld(seed);
  const m = modifierMods({ modifiers: chosen.ids });
  const pop = spec.startPop + m.startPop;
  const startTechs = chosen.ids.flatMap((id) => MODIFIERS[id].startTechs ?? []);
  const c: Campaign = {
    schema: SCHEMA_VERSION,
    rules: RULES_VERSION,
    content: CONTENT_VERSION,
    seed,
    scenario: scenarioId,
    mode,
    difficulty,
    // Only a lineage with challenges carries the field, so a standard one hashes as it always did.
    ...(chosen.ids.length ? { modifiers: chosen.ids } : {}),
    phase: 'PREPARE',
    paused: false,
    epoch: 0,
    tick: 0,
    totalTicks: 0,
    nextId: 1,
    seq: 0,
    world,
    structures: [],
    civ: {
      res: {
        food: Math.max(0, (spec.start.food + m.startFood) * UNIT),
        timber: Math.max(0, (spec.start.timber + m.startTimber) * UNIT),
        stone: Math.max(0, (spec.start.stone + m.startStone) * UNIT),
        knowledge: spec.start.knowledge * UNIT,
      },
      pop,
      morale: 700,
      techs: [...startTechs],
      research: null,
      focus: 'balanced',
      traditions: [],
      stats: {
        foodMade: 0,
        foodEaten: 0,
        timberMade: 0,
        stoneMade: 0,
        knowledgeMade: 0,
        built: 0,
        researched: 0,
        decisions: 0,
        born: 0,
        starved: 0,
        peakPop: pop,
      },
      popClock: 0,
      starveClock: 0,
      labor: { total: pop, builders: 0, idle: pop },
    },
    lineage: {
      history: [],
      everKnown: [...startTechs],
      lostTechs: [],
      reports: [],
      traditions: [],
      interregnum: null,
      score: 0,
      feats: [],
    },
    queue: [],
    rng: createRngState(seed, 1),
    events: [],
    prompts: [],
    actionLog: [],
    collapseResolved: false,
    report: null,
    forecastLevel: 0,
  };
  applyWorldModifiers(c);
  const h = createStructure(c, 'hearth', world.anchors.hearth.x, world.anchors.hearth.y, 0, 'active');
  levelPad(c, h);
  h.provenance.push('The founders lit the first fire here.');
  placeBuriedLibrary(c);
  c.lineage.history.push({ epoch: 0, title: spec.name, text: spec.brief });
  return c;
}

/* ------------------------------------------------------------------ */
/* Queries for the UI                                                  */
/* ------------------------------------------------------------------ */

export interface CatalogEntry {
  kind: BuildingKind;
  name: string;
  blurb: string;
  cost: Resources;
  /** null when buildable now; otherwise a stable reason code plus readable text. */
  blocked: { code: ErrorCode; message: string } | null;
}

/** The build tray: every enabled building with why it is or is not available right now. */
export function getCatalog(c: Campaign): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const reserved = reservedCost(c);
  const eff: Resources = {
    food: c.civ.res.food - reserved.food,
    timber: c.civ.res.timber - reserved.timber,
    stone: c.civ.res.stone - reserved.stone,
    knowledge: c.civ.res.knowledge - reserved.knowledge,
  };
  for (const def of Object.values(BUILDINGS)) {
    if (!def.enabled || def.founder) continue;
    let blocked: CatalogEntry['blocked'] = null;
    if (def.age > epochAge(c)) blocked = { code: 'locked_age', message: `Arrives in a later age` };
    else if (def.tech && !hasTech(c, def.tech))
      blocked = { code: 'locked_tech', message: `Needs ${TECHS[def.tech].name}` };
    else if (def.limit !== null && countKind(c, def.kind) >= def.limit)
      blocked = { code: 'limit_reached', message: `Limit ${def.limit} reached` };
    else {
      const a = canAfford(eff, costOf(def.kind));
      if (!a.ok) {
        const parts = (Object.keys(a.missing) as (keyof Resources)[]).map(
          (k) => `${Math.ceil((a.missing[k] ?? 0) / UNIT)} ${k}`,
        );
        blocked = { code: 'not_enough', message: `Need ${parts.join(', ')} more` };
      }
    }
    out.push({ kind: def.kind, name: def.name, blurb: def.blurb, cost: costOf(def.kind), blocked });
  }
  return out;
}

export function getForecast(c: Campaign): Forecast {
  const spec = epochSpec(c, c.epoch);
  const predicted = resolveHazard(c);
  const { deaths } = computeDeaths(c, predicted.impacts, predicted.kind);
  return {
    kind: predicted.kind,
    name: spec.hazard.headline,
    predicted,
    atRisk: predicted.impacts.filter((i) => i.after !== 'active').length,
    predictedDeaths: deaths,
  };
}

export function secondsLeft(c: Campaign): number {
  return Math.max(0, (EPOCH_TICKS - c.tick) / 10);
}

export function currentSpec(c: Campaign) {
  return epochSpec(c, c.epoch);
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

const TIMED_ACTIONS: Action['type'][] = [
  'build',
  'cancel',
  'demolish',
  'repair',
  'reinforce',
  'research',
  'setFocus',
  'choose',
];

function log(c: Campaign, action: Action): number {
  const seq = ++c.seq;
  c.actionLog.push({ tick: c.tick, seq, epoch: c.epoch, action });
  return seq;
}

function reinforceCost(s: Structure): Resources {
  const area = s.w * s.h;
  return { food: 0, timber: 2 * UNIT, stone: (3 + area) * UNIT, knowledge: 0 };
}

export const REINFORCE_BONUS = 220;

/**
 * Validate an intent against current state and accept it. In ACTIVE play, accepted actions are stamped with the
 * current tick and applied at the next tick boundary (re-validated, then paid for exactly once). In PREPARE they
 * become bounded plan slots applied at tick 0. Between epochs they apply immediately because no time passes.
 */
export function dispatchAction(c: Campaign, action: Action): ActionResult {
  if (action.type === 'endure') {
    if (!canEndure(c)) return err('wrong_phase', 'Only a victory in the last age can be carried on');
    c.endless = { rested: false };
    log(c, action);
    // The centuries pass as after any age; the next one brings back the first catastrophe, fiercer.
    enterInterregnum(c);
    emit(c, { code: 'chronicle.continues', msg: 'The chronicle goes on', important: true });
    return { ok: true };
  }
  if (c.phase === 'VICTORY' || c.phase === 'DEFEAT') return err('game_over', 'The campaign is over');

  switch (action.type) {
    case 'beginEpoch': {
      if (c.phase !== 'PREPARE') return err('wrong_phase', 'The epoch has already begun');
      log(c, action);
      c.phase = 'ACTIVE';
      c.tick = 0;
      c.paused = false;
      const spec = currentSpec(c);
      emit(c, { code: 'epoch.begin', msg: `${spec.name} — ${spec.ageName}`, important: true });
      return { ok: true };
    }
    case 'continue': {
      if (c.phase === 'COLLAPSING') {
        log(c, action);
        c.phase = 'DEBRIEF';
        return { ok: true };
      }
      if (c.phase === 'DEBRIEF') {
        log(c, action);
        // An age of the long chronicle is not judged: it goes on unless it cannot.
        if (c.endless) {
          if (chronicleOver(c)) c.phase = 'VICTORY';
          else enterInterregnum(c);
          return { ok: true };
        }
        const v = c.report?.verdict ?? null;
        if (v) {
          c.phase = v.outcome === 'victory' ? 'VICTORY' : 'DEFEAT';
          return { ok: true };
        }
        enterInterregnum(c);
        return { ok: true };
      }
      return err('wrong_phase', 'Nothing to continue');
    }
    case 'rest': {
      if (c.phase !== 'DEBRIEF' || !c.endless || chronicleOver(c))
        return err('wrong_phase', 'The chronicle can be rested only at the debrief of a later age');
      log(c, action);
      c.endless.rested = true;
      c.phase = 'VICTORY';
      emit(c, { code: 'chronicle.rests', msg: 'The chronicle rests', important: true });
      return { ok: true };
    }
    case 'unplan':
      return unplan(c, action.seq);
    case 'survey': {
      const r = surveyRuin(c, action.id);
      if (r.ok) log(c, action);
      return r;
    }
    case 'excavate': {
      const r = excavateRuin(c, action.id);
      if (r.ok) {
        c.civ.stats.decisions++;
        log(c, action);
      }
      return r;
    }
    case 'found': {
      const r = foundNextEpoch(c, action.site, action.tradition);
      if (r.ok) {
        // `log` after the transition would stamp the wrong epoch; stamp with the epoch that founded it.
        c.actionLog.push({ tick: 0, seq: ++c.seq, epoch: c.epoch - 1, action });
      }
      return r;
    }
    default:
      break;
  }

  // The remaining actions are timed play actions.
  if (!TIMED_ACTIONS.includes(action.type)) return err('wrong_phase', 'Unsupported action');
  if (c.phase !== 'PREPARE' && c.phase !== 'ACTIVE')
    return err('wrong_phase', 'Time has stopped — nothing can be done now');
  if (c.phase === 'ACTIVE' && c.tick >= EPOCH_TICKS) return err('too_late', 'The epoch is over');

  if (action.type === 'setFocus') {
    if (c.phase === 'PREPARE') {
      c.civ.focus = action.focus;
      log(c, action);
      return { ok: true };
    }
    if (c.queue.length >= MAX_QUEUE) return err('queue_full', 'Too many pending orders');
    c.queue.push({ seq: log(c, action), tick: c.tick, action, paid: false });
    return { ok: true, queued: true };
  }

  const planning = c.phase === 'PREPARE';
  const limit = planning ? MAX_PLAN_SLOTS : MAX_QUEUE;
  if (c.queue.length >= limit)
    return planning
      ? err('plan_slots_full', `Only ${MAX_PLAN_SLOTS} opening plans are allowed`)
      : err('queue_full', 'Too many pending orders');

  switch (action.type) {
    case 'build': {
      const chk = checkPlacement(c, action.kind, action.x, action.y, action.rot);
      if (!chk.ok) return chk;
      break;
    }
    case 'cancel': {
      const s = findStructure(c, action.id);
      if (!s) return err('no_such_structure', 'No such structure');
      if (s.status !== 'constructing') return err('bad_target', 'Only unfinished buildings can be cancelled');
      break;
    }
    case 'demolish': {
      const s = findStructure(c, action.id);
      if (!s) return err('no_such_structure', 'No such structure');
      if (s.kind === 'hearth' && s.status !== 'rubble')
        return err('bad_target', 'The hearth cannot be demolished');
      if (s.status === 'constructing') return err('bad_target', 'Cancel unfinished buildings instead');
      break;
    }
    case 'repair': {
      const s = findStructure(c, action.id);
      if (!s) return err('no_such_structure', 'No such structure');
      const blocked = repairBlocked(c, s);
      if (blocked) return blocked;
      const cost = repairCost(s);
      const eff = effectiveResources(c);
      const a = canAfford(eff, cost);
      if (!a.ok) return err('not_enough', 'Not enough resources', hintOf(a.missing));
      break;
    }
    case 'reinforce': {
      const s = findStructure(c, action.id);
      if (!s) return err('no_such_structure', 'No such structure');
      if (s.status !== 'active' && s.status !== 'damaged')
        return err('bad_target', 'Only standing buildings can be reinforced');
      if (s.bonus[action.hazard] >= REINFORCE_BONUS)
        return err('already_done', 'Already reinforced against that');
      const a = canAfford(effectiveResources(c), reinforceCost(s));
      if (!a.ok) return err('not_enough', 'Not enough resources', hintOf(a.missing));
      break;
    }
    case 'choose': {
      if (c.phase !== 'ACTIVE') return err('wrong_phase', 'Decisions arise only while time is running');
      const bad = checkChoice(c, action.prompt, action.option);
      if (bad) return bad;
      break;
    }
    case 'research': {
      const def = TECHS[action.tech];
      if (!def || !def.enabled) return err('invalid_choice', 'Unknown technology');
      if (hasTech(c, action.tech)) return err('tech_known', 'Already known');
      if (def.requires.some((r) => !hasTech(c, r)))
        return err('tech_locked', 'Prerequisites missing', { requires: def.requires.join(',') });
      if (c.civ.research || c.queue.some((q) => q.action.type === 'research'))
        return err('research_busy', 'Already researching');
      const need = techCost(c, action.tech);
      const eff = effectiveResources(c);
      if (eff.knowledge < need)
        return err('not_enough', 'Not enough knowledge', {
          knowledge: Math.ceil((need - eff.knowledge) / UNIT),
        });
      break;
    }
    default:
      break;
  }
  const seq = log(c, action);
  c.queue.push({ seq, tick: c.tick, action, paid: false });
  return { ok: true, queued: true };
}

function effectiveResources(c: Campaign): Resources {
  const r = reservedCost(c);
  return {
    food: c.civ.res.food - r.food,
    timber: c.civ.res.timber - r.timber,
    stone: c.civ.res.stone - r.stone,
    knowledge: c.civ.res.knowledge - r.knowledge,
  };
}

function hintOf(missing: Partial<Resources>): Record<string, number> {
  const h: Record<string, number> = {};
  for (const k of Object.keys(missing) as (keyof Resources)[]) h[k] = Math.ceil((missing[k] ?? 0) / UNIT);
  return h;
}

/**
 * Why a structure cannot be repaired (or an excavated ruin restored) right now; null when it can, resources
 * permitting. Restoring a ruin adds a building, so it counts against the kind's limit like a new one would. Each age
 * lights its own hearth: an old hearth's ruin can be excavated, not relit.
 */
export function repairBlocked(c: Campaign, s: Structure): ActionError | null {
  const def = BUILDINGS[s.kind];
  const ruin = s.status === 'rubble' || s.status === 'buried';
  if (s.status !== 'damaged' && !(ruin && s.excavated && def.material !== 'thatch'))
    return err('bad_target', 'Only damaged buildings or excavated ruins can be repaired');
  if (ruin && s.kind === 'hearth') return err('bad_target', 'An old hearth cannot be relit');
  if (ruin && def.limit !== null && countKind(c, s.kind) >= def.limit)
    return err('limit_reached', `Limit ${def.limit} reached`);
  return null;
}

export function repairCost(s: Structure): Resources {
  const base = costOf(s.kind);
  const pm = s.status === 'damaged' ? 400 : 650;
  return {
    food: Math.round((base.food * pm) / 1000),
    timber: Math.round((base.timber * pm) / 1000),
    stone: Math.round((base.stone * pm) / 1000),
    knowledge: 0,
  };
}

/** Cancel a planned (not yet applied) PREPARE action. */
export function unplan(c: Campaign, seq: number): ActionResult {
  if (c.phase !== 'PREPARE') return err('wrong_phase', 'Plans can only be withdrawn before the epoch begins');
  const k = c.queue.findIndex((q) => q.seq === seq);
  if (k < 0) return err('bad_target', 'No such plan');
  c.queue.splice(k, 1);
  log(c, { type: 'unplan', seq });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Applying queued actions at a tick boundary                           */
/* ------------------------------------------------------------------ */

function pay(c: Campaign, cost: Resources): void {
  c.civ.res.food -= cost.food;
  c.civ.res.timber -= cost.timber;
  c.civ.res.stone -= cost.stone;
  c.civ.res.knowledge -= cost.knowledge;
}

function refund(c: Campaign, cost: Resources, pm: number): void {
  c.civ.res.food += Math.round((cost.food * pm) / 1000);
  c.civ.res.timber += Math.round((cost.timber * pm) / 1000);
  c.civ.res.stone += Math.round((cost.stone * pm) / 1000);
}

function reject(c: Campaign, e: ActionError, what: string): void {
  emit(c, { code: `action.rejected.${e.code}`, msg: `${what}: ${e.message}` });
}

function applyAction(c: Campaign, action: Action): void {
  switch (action.type) {
    case 'build': {
      const chk = checkPlacement(c, action.kind, action.x, action.y, action.rot);
      if (!chk.ok) return reject(c, chk, `Could not build ${getDef(action.kind).name}`);
      for (const id of chk.clears) {
        const r = findStructure(c, id);
        if (r) {
          r.provenance.push('Cleared to make way for new building.');
          removeStructure(c, id);
          emit(c, {
            code: 'ruin.cleared',
            msg: `Cleared a ruined ${BUILDINGS[r.kind].name}`,
            x: r.x,
            y: r.y,
          });
        }
      }
      pay(c, chk.cost);
      const s = createStructure(c, action.kind, action.x, action.y, action.rot, 'constructing');
      levelPad(c, s);
      c.civ.stats.decisions++;
      emit(c, { code: 'build.start', msg: `${getDef(action.kind).name} begun`, id: s.id, x: s.x, y: s.y });
      return;
    }
    case 'cancel': {
      const s = findStructure(c, action.id);
      if (!s || s.status !== 'constructing') return;
      const def = BUILDINGS[s.kind];
      const remaining = Math.max(0, 1000 - Math.round(s.progress / Math.max(1, def.buildWork)));
      refund(c, costOf(s.kind), Math.round((def.refund * remaining) / 1000));
      removeStructure(c, s.id);
      c.civ.stats.decisions++;
      emit(c, { code: 'build.cancelled', msg: `${def.name} cancelled`, x: s.x, y: s.y });
      return;
    }
    case 'demolish': {
      const s = findStructure(c, action.id);
      if (!s) return;
      const def = BUILDINGS[s.kind];
      if (s.status === 'rubble' || s.status === 'buried') {
        c.civ.res.timber += s.salvage.timber;
        c.civ.res.stone += s.salvage.stone;
      } else {
        const cost = costOf(s.kind);
        refund(c, cost, Math.round(def.salvage * 0.4));
      }
      removeStructure(c, s.id);
      c.civ.stats.decisions++;
      emit(c, { code: 'struct.demolished', msg: `${def.name} cleared`, x: s.x, y: s.y });
      return;
    }
    case 'repair': {
      const s = findStructure(c, action.id);
      if (!s) return;
      // The world may have changed since the order was queued (a ruin restored twice, a limit reached meanwhile).
      const blocked = repairBlocked(c, s);
      if (blocked) return reject(c, blocked, 'Repair');
      const cost = repairCost(s);
      if (!canAfford(c.civ.res, cost).ok)
        return reject(c, err('not_enough', 'Not enough resources'), 'Repair');
      pay(c, cost);
      const def = BUILDINGS[s.kind];
      const fresh = s.status === 'damaged' ? 0.6 : 0.35;
      // Something nobody builds (the hearth: no build work, no builders) is mended at once, never left half-built.
      s.status = def.buildWork === 0 ? 'active' : 'constructing';
      s.progress = Math.round(def.buildWork * 1000 * (def.buildWork === 0 ? 1 : fresh));
      s.integrity = 1000;
      s.cause = null;
      s.burial = 0;
      s.repairs++;
      s.provenance.push(`Repaired in epoch ${c.epoch + 1}.`);
      c.civ.stats.decisions++;
      emit(c, { code: 'repair.start', msg: `Repairing ${def.name}`, id: s.id, x: s.x, y: s.y });
      return;
    }
    case 'reinforce': {
      const s = findStructure(c, action.id);
      if (!s || (s.status !== 'active' && s.status !== 'damaged')) return;
      const cost = reinforceCost(s);
      if (s.bonus[action.hazard] >= REINFORCE_BONUS) return;
      if (!canAfford(c.civ.res, cost).ok)
        return reject(c, err('not_enough', 'Not enough resources'), 'Reinforce');
      pay(c, cost);
      s.bonus[action.hazard] = REINFORCE_BONUS;
      c.civ.stats.decisions++;
      emit(c, {
        code: 'reinforce',
        msg: `${BUILDINGS[s.kind].name} reinforced against ${action.hazard}`,
        id: s.id,
        x: s.x,
        y: s.y,
      });
      return;
    }
    case 'research': {
      const def = TECHS[action.tech];
      if (!def || c.civ.research || hasTech(c, action.tech)) return;
      const need = techCost(c, action.tech);
      if (c.civ.res.knowledge < need)
        return reject(c, err('not_enough', 'Not enough knowledge'), `Research ${def.name}`);
      c.civ.res.knowledge -= need;
      c.civ.research = { tech: action.tech, remaining: def.ticks };
      c.civ.stats.decisions++;
      emit(c, { code: 'research.start', msg: `Researching ${def.name}` });
      return;
    }
    case 'setFocus': {
      c.civ.focus = action.focus;
      return;
    }
    case 'choose': {
      applyChoice(c, action.prompt, action.option);
      return;
    }
    default:
      return;
  }
}

/* ------------------------------------------------------------------ */
/* The fixed tick                                                      */
/* ------------------------------------------------------------------ */

export function canAdvance(c: Campaign): boolean {
  return c.phase === 'ACTIVE' && !c.paused && c.tick < EPOCH_TICKS;
}

/**
 * Advance exactly one 100 ms tick. Order is frozen (see docs/GAME_RULES.md):
 *  1 actions → 2 labor → 3 construction → 4 production → 5 upkeep/food/people → 6 research →
 *  7 natural systems (inside 4) → 8 forecast → 9 clock → 10 terminal check.
 */
export function advanceFixedTick(c: Campaign): boolean {
  if (!canAdvance(c)) return false;
  // 1. Accept queued actions in sequence.
  if (c.queue.length) {
    const pending = c.queue.splice(0, c.queue.length).sort((a, b) => a.seq - b.seq);
    for (const q of pending) applyAction(c, q.action);
  }
  // 2–3. Labor and construction.
  allocateLabor(c);
  stepConstruction(c);
  // 4,7. Production and finite natural resources.
  stepProduction(c);
  // 5. Upkeep, food, people.
  stepPopulation(c);
  // 6. Research.
  stepResearch(c);
  // 7b. Story decisions arise from the state just computed.
  stepStories(c);
  // 8. Forecast beats: 25 s, 15 s, 5 s before the end.
  const spec = currentSpec(c);
  const level = FORECAST_LEAD_TICKS.filter((lead) => c.tick + 1 >= EPOCH_TICKS - lead).length;
  while (c.forecastLevel < level) {
    const msg = spec.hazard.warnings[c.forecastLevel]!;
    c.forecastLevel++;
    emit(c, { code: `forecast.${c.forecastLevel}`, msg, important: true });
  }
  // 9. The clock.
  c.tick++;
  c.totalTicks++;
  // 10. Terminal check.
  if (c.tick >= EPOCH_TICKS || c.civ.pop <= 0) collapseEpoch(c);
  return true;
}

export function runTicks(c: Campaign, n: number): number {
  let done = 0;
  for (let i = 0; i < n; i++) {
    if (!advanceFixedTick(c)) break;
    done++;
  }
  return done;
}

/** Pause is orthogonal to phase; the engine simply refuses to tick while paused. */
export function setPaused(c: Campaign, paused: boolean): void {
  c.paused = paused;
}

export { collapseEpoch, countKind };
