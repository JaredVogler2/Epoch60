import { BUILDINGS } from '../content/buildings';
import { epochSpec } from '../content/scenario';
import { UNIT } from '../core/constants';
import { emit } from '../core/events';
import type {
  ActionError,
  Campaign,
  Resources,
  Structure,
  StoryId,
  StoryOption,
  StoryPrompt,
} from '../core/types';
import { canAfford, housingCapacity, isStanding } from '../economy/modifiers';
import { resolveHazard, winterLarder } from '../world/hazards';
import { idx, inBounds } from '../world/query';

/**
 * Story decisions. Each one is offered only when the village's real state makes it possible and meaningful, at most
 * three per epoch, never as a modal: a compact chip with a deadline and a free default. Effects are small, honest
 * and visible in the next forecast.
 */

const DEADLINE_TICKS = 150;
export const MAX_STORIES_PER_EPOCH = 3;
const MIN_SPACING_TICKS = 100;

type Cost = NonNullable<StoryOption['cost']>;

interface StoryDef {
  id: StoryId;
  /** Earliest tick (within the epoch) to offer it. */
  at: number;
  when: (c: Campaign) => boolean;
  build: (c: Campaign) => { title: string; body: string; options: StoryOption[]; defaultOption: string };
  apply: (c: Campaign, option: string) => string;
}

const toUnits = (cost: Cost): Resources => ({
  food: (cost.food ?? 0) * UNIT,
  timber: (cost.timber ?? 0) * UNIT,
  stone: (cost.stone ?? 0) * UNIT,
  knowledge: (cost.knowledge ?? 0) * UNIT,
});

function pay(c: Campaign, cost: Cost): void {
  const u = toUnits(cost);
  c.civ.res.food -= u.food;
  c.civ.res.timber -= u.timber;
  c.civ.res.stone -= u.stone;
  c.civ.res.knowledge -= u.knowledge;
}

function standingHearth(c: Campaign): Structure | undefined {
  return c.structures.filter((s) => s.kind === 'hearth' && isStanding(s)).sort((a, b) => b.id - a.id)[0];
}

const EQUIPMENT = new Set(['firebreak', 'levee', 'dam', 'retaining_wall', 'grove', 'bridge']);

/** Standing buildings people live or work in (not earthworks), nearest the hearth first. */
function village(c: Campaign): Structure[] {
  const h = standingHearth(c);
  const hx = h ? h.x : c.world.anchors.hearth.x;
  const hy = h ? h.y : c.world.anchors.hearth.y;
  return c.structures
    .filter((s) => isStanding(s) && !EQUIPMENT.has(s.kind))
    .sort(
      (a, b) =>
        Math.abs(a.x - hx) + Math.abs(a.y - hy) - (Math.abs(b.x - hx) + Math.abs(b.y - hy)) || a.id - b.id,
    );
}

function endangered(c: Campaign): Structure[] {
  const r = resolveHazard(c);
  const ids = new Set(r.impacts.filter((i) => i.after !== 'active').map((i) => i.id));
  return village(c).filter((s) => ids.has(s.id));
}

const epochHazard = (c: Campaign) => epochSpec(c, c.epoch).hazard.kind;

/* ------------------------------------------------------------------ */
/* The stories                                                         */
/* ------------------------------------------------------------------ */

const DRY_WIND: StoryDef = {
  id: 'dry_wind',
  at: 150,
  when: (c) => epochHazard(c) === 'fire' && endangered(c).length > 0,
  build: (c) => {
    const n = endangered(c).length;
    return {
      title: 'A dry wind from the ridge',
      body: `Wardens say the grass around the hearth is tinder. The forecast puts ${n} of your buildings in the fire's path.`,
      options: [
        {
          id: 'clear_brush',
          label: 'Clear the brush',
          detail:
            'Costs 4 timber. Strips the grass and scrub within 3 cells of the hearth, so the fire has less to burn there.',
          cost: { timber: 4 },
        },
        {
          id: 'gather_timber',
          label: 'Cut what we can',
          detail: 'Gain 8 timber now. Nothing is made safer.',
        },
        { id: 'ignore', label: 'Trust the forecast', detail: 'Do nothing.' },
      ],
      defaultOption: 'ignore',
    };
  },
  apply: (c, option) => {
    if (option === 'clear_brush') {
      const h = standingHearth(c);
      const before = resolveHazard(c).area;
      if (h) {
        for (let dy = -3; dy <= 4; dy++) {
          for (let dx = -3; dx <= 4; dx++) {
            const x = h.x + dx;
            const y = h.y + dy;
            if (!inBounds(x, y, c.world.w, c.world.h) || dx * dx + dy * dy > 16) continue;
            const k = idx(x, y, c.world.w);
            if (c.world.occ[k] !== -1 || c.world.water[k]) continue;
            c.world.forest[k] = 0;
          }
        }
      }
      const shrank = Math.max(0, before - resolveHazard(c).area);
      return shrank > 0
        ? `The scrub around the hearth is gone. The predicted burn shrank by ${shrank} cell${shrank === 1 ? '' : 's'}.`
        : 'The scrub around the hearth is gone, but the predicted burn is unchanged: the fire’s path lies elsewhere.';
    }
    if (option === 'gather_timber') {
      c.civ.res.timber += 8 * UNIT;
      return 'The woodcutters brought in 8 more timber.';
    }
    return 'You trusted the forecast.';
  },
};

const RIVER_RISING: StoryDef = {
  id: 'river_rising',
  at: 250,
  when: (c) => epochHazard(c) === 'flood' && endangered(c).length > 0,
  build: (c) => {
    const n = endangered(c).length;
    return {
      title: 'The river is climbing',
      body: `Mud-brown water laps the lowest fields. ${n} of your buildings stand where the flood will reach.`,
      options: [
        {
          id: 'sandbag',
          label: 'Sandbag the houses',
          detail:
            'Costs 6 timber. Every home and workplace within 6 cells of the hearth resists floodwater 16% better.',
          cost: { timber: 6 },
        },
        {
          id: 'harvest_early',
          label: 'Bring the harvest in',
          detail: 'Gain 10 food now. Nothing is made safer.',
        },
        { id: 'ignore', label: 'Hold our nerve', detail: 'Do nothing.' },
      ],
      defaultOption: 'ignore',
    };
  },
  apply: (c, option) => {
    if (option === 'sandbag') {
      const h = standingHearth(c);
      const before = resolveHazard(c).impacts.filter((i) => i.after === 'rubble').length;
      let n = 0;
      for (const s of village(c)) {
        if (h && Math.abs(s.x - h.x) + Math.abs(s.y - h.y) > 6) continue;
        s.bonus.flood = Math.max(s.bonus.flood, 160);
        s.provenance.push('Sandbagged against the Great Flood.');
        n++;
      }
      const after = resolveHazard(c).impacts.filter((i) => i.after === 'rubble').length;
      return `${n} buildings were sandbagged; ${Math.max(0, before - after)} fewer are now forecast to be destroyed.`;
    }
    if (option === 'harvest_early') {
      c.civ.res.food += 10 * UNIT;
      return 'The harvest came in early: +10 food.';
    }
    return 'You held your nerve.';
  },
};

const FORESHOCK: StoryDef = {
  id: 'foreshock',
  at: 250,
  when: (c) => epochHazard(c) === 'quake' && endangered(c).length > 0,
  build: (c) => {
    const worst = endangered(c)
      .map((s) => ({ s, d: resolveHazard(c).impacts.find((i) => i.id === s.id)?.damage ?? 0 }))
      .sort((a, b) => b.d - a.d || a.s.id - b.s.id)[0];
    const name = worst ? BUILDINGS[worst.s.kind].name : 'a building';
    return {
      title: 'The ground trembles',
      body: `Cracks run across the old road. The ${name} is forecast to take the worst of the quake.`,
      options: [
        {
          id: 'brace_worst',
          label: `Brace the ${name}`,
          detail: 'Costs 8 stone. Reinforces that building against the quake (+22% resistance).',
          cost: { stone: 8 },
        },
        {
          id: 'brace_homes',
          label: 'Shore up the homes',
          detail: 'Costs 10 stone. Reinforces up to three houses at risk (+22% each).',
          cost: { stone: 10 },
        },
        { id: 'ignore', label: 'Wait and see', detail: 'Do nothing.' },
      ],
      defaultOption: 'ignore',
    };
  },
  apply: (c, option) => {
    const r = resolveHazard(c);
    const risky = endangered(c)
      .map((s) => ({ s, d: r.impacts.find((i) => i.id === s.id)?.damage ?? 0 }))
      .sort((a, b) => b.d - a.d || a.s.id - b.s.id);
    const targets =
      option === 'brace_worst'
        ? risky.slice(0, 1)
        : option === 'brace_homes'
          ? risky.filter((x) => BUILDINGS[x.s.kind].housing > 0).slice(0, 3)
          : [];
    for (const t of targets) {
      t.s.bonus.quake = Math.max(t.s.bonus.quake, 220);
      t.s.provenance.push('Braced when the foreshock came.');
    }
    if (!targets.length) return option === 'ignore' ? 'You waited.' : 'There was nothing left to brace.';
    const after = resolveHazard(c).impacts.filter((i) => i.after === 'rubble').length;
    const was = r.impacts.filter((i) => i.after === 'rubble').length;
    return `${targets.length} building${targets.length > 1 ? 's' : ''} braced; ${Math.max(0, was - after)} fewer now forecast to fall.`;
  },
};

const ASH_WARNING: StoryDef = {
  id: 'ash_warning',
  at: 200,
  when: (c) => epochHazard(c) === 'ash',
  build: (c) => {
    const l = winterLarder(c);
    return {
      title: 'The sky is turning grey',
      body: `Ash will bury the harvest. The winter needs ${l.need} food; you have ${l.have} put by.`,
      options: [
        {
          id: 'trade_grain',
          label: 'Trade timber for grain',
          detail: 'Costs 10 timber. Gain 14 food from the river towns before the roads close.',
          cost: { timber: 10 },
        },
        {
          id: 'steep_roofs',
          label: 'Re-pitch the roofs',
          detail: 'Costs 6 stone. Up to three homes at risk shed ash better (+22% ash resistance).',
          cost: { stone: 6 },
        },
        { id: 'ignore', label: 'Trust the stores', detail: 'Do nothing.' },
      ],
      defaultOption: 'ignore',
    };
  },
  apply: (c, option) => {
    if (option === 'trade_grain') {
      c.civ.res.food += 14 * UNIT;
      const l = winterLarder(c);
      return `14 food came in: ${l.have} now put by against ${l.need} needed.`;
    }
    if (option === 'steep_roofs') {
      const r = resolveHazard(c);
      const risky = endangered(c)
        .map((s) => ({ s, d: r.impacts.find((i) => i.id === s.id)?.damage ?? 0 }))
        .filter((x) => BUILDINGS[x.s.kind].housing > 0)
        .sort((a, b) => b.d - a.d || a.s.id - b.s.id)
        .slice(0, 3);
      for (const t of risky) {
        t.s.bonus.ash = Math.max(t.s.bonus.ash, 220);
        t.s.provenance.push('Re-pitched against the ash.');
      }
      const was = r.impacts.filter((i) => i.after === 'rubble').length;
      const after = resolveHazard(c).impacts.filter((i) => i.after === 'rubble').length;
      return risky.length
        ? `${risky.length} roof${risky.length > 1 ? 's' : ''} re-pitched; ${Math.max(0, was - after)} fewer now forecast to fall.`
        : 'There were no homes left to re-pitch.';
    }
    return 'You trusted the stores.';
  },
};

const REFUGEES: StoryDef = {
  id: 'refugees',
  at: 100,
  when: (c) => c.epoch >= 1 && housingCapacity(c) >= c.civ.pop + 3 && c.civ.res.food >= 12 * UNIT,
  build: (c) => ({
    title: 'Refugees at the edge of the village',
    body: `Three travellers from a drowned valley ask for shelter. You have ${housingCapacity(c) - c.civ.pop} free beds.`,
    options: [
      {
        id: 'welcome',
        label: 'Welcome them',
        detail: 'Costs 8 food. Three more hands and mouths, and they carry what they remember: +3 knowledge.',
        cost: { food: 8 },
      },
      { id: 'turn_away', label: 'Turn them away', detail: 'Do nothing.' },
    ],
    defaultOption: 'turn_away',
  }),
  apply: (c, option) => {
    if (option !== 'welcome') return 'The travellers moved on.';
    c.civ.pop += 3;
    c.civ.stats.peakPop = Math.max(c.civ.stats.peakPop, c.civ.pop);
    c.civ.res.knowledge += 3 * UNIT;
    return 'Three refugees joined the village and shared what they remember.';
  },
};

const HISTORIAN: StoryDef = {
  id: 'historian',
  at: 120,
  when: (c) => c.structures.some((s) => s.kind === 'archive' && s.status === 'active'),
  build: () => ({
    title: 'A historian asks for patronage',
    body: 'An old scribe has been copying the Archive’s tablets by lamplight and wants a stipend to finish.',
    options: [
      {
        id: 'fund',
        label: 'Fund her work',
        detail: 'Costs 6 timber and 4 food. Gain 8 knowledge at once.',
        cost: { timber: 6, food: 4 },
      },
      { id: 'decline', label: 'Decline', detail: 'Do nothing.' },
    ],
    defaultOption: 'decline',
  }),
  apply: (c, option) => {
    if (option !== 'fund') return 'The scribe went back to her tablets unpaid.';
    c.civ.res.knowledge += 8 * UNIT;
    return 'The historian finished her copy: +8 knowledge.';
  },
};

const DAM_LEAK: StoryDef = {
  id: 'dam_leak',
  at: 200,
  when: (c) =>
    epochHazard(c) === 'flood' &&
    c.structures.some((s) => (s.kind === 'dam' || s.kind === 'levee') && s.status === 'active'),
  build: (c) => {
    const s = c.structures
      .filter((x) => (x.kind === 'dam' || x.kind === 'levee') && x.status === 'active')
      .sort((a, b) => a.id - b.id)[0]!;
    return {
      title: `The ${BUILDINGS[s.kind].name} is seeping`,
      body: `Water is finding a way through the ${BUILDINGS[s.kind].name} at (${s.x},${s.y}). Left alone it will weaken before the flood.`,
      options: [
        {
          id: 'repair_now',
          label: 'Patch it now',
          detail: 'Costs 6 stone. The works stay sound.',
          cost: { stone: 6 },
        },
        {
          id: 'ignore',
          label: 'Leave it',
          detail: 'It weakens: a levee holds back only half as much; a dam loses its irrigation.',
        },
      ],
      defaultOption: 'ignore',
    };
  },
  apply: (c, option) => {
    const s = c.structures
      .filter((x) => (x.kind === 'dam' || x.kind === 'levee') && x.status === 'active')
      .sort((a, b) => a.id - b.id)[0];
    if (!s) return 'Nothing left to patch.';
    if (option === 'repair_now') {
      s.provenance.push('Patched when it began to seep.');
      return `The ${BUILDINGS[s.kind].name} was patched and holds.`;
    }
    s.status = 'damaged';
    s.integrity = Math.min(s.integrity, 600);
    s.provenance.push('Left to seep, it weakened before the flood.');
    return `The unpatched ${BUILDINGS[s.kind].name} has weakened.`;
  },
};

export const STORIES: Record<StoryId, StoryDef> = {
  dry_wind: DRY_WIND,
  river_rising: RIVER_RISING,
  foreshock: FORESHOCK,
  ash_warning: ASH_WARNING,
  refugees: REFUGEES,
  historian: HISTORIAN,
  dam_leak: DAM_LEAK,
};

const ORDER: StoryId[] = [
  'refugees',
  'historian',
  'dry_wind',
  'dam_leak',
  'ash_warning',
  'river_rising',
  'foreshock',
];

/* ------------------------------------------------------------------ */
/* Engine hooks                                                        */
/* ------------------------------------------------------------------ */

export function openPrompts(c: Campaign): StoryPrompt[] {
  return c.prompts.filter((p) => p.status === 'open');
}

function optionCost(p: StoryPrompt, option: string): Cost {
  return p.options.find((o) => o.id === option)?.cost ?? {};
}

/** Validate a choice at dispatch time. */
export function checkChoice(c: Campaign, promptSeq: number, option: string): ActionError | null {
  const p = c.prompts.find((x) => x.seq === promptSeq);
  if (!p) return { ok: false, code: 'bad_target', message: 'That decision is no longer open' };
  if (p.status !== 'open') return { ok: false, code: 'already_done', message: 'Already decided' };
  if (!p.options.some((o) => o.id === option))
    return { ok: false, code: 'invalid_choice', message: 'That is not one of the options' };
  const cost = optionCost(p, option);
  const a = canAfford(c.civ.res, toUnits(cost));
  if (!a.ok) return { ok: false, code: 'not_enough', message: 'Not enough resources' };
  return null;
}

function resolve(c: Campaign, p: StoryPrompt, option: string, auto: boolean): void {
  const def = STORIES[p.story];
  const cost = optionCost(p, option);
  if (!auto) {
    pay(c, cost);
    c.civ.stats.decisions++;
  }
  const outcome = def.apply(c, option);
  p.status = 'resolved';
  p.chosen = option;
  p.auto = auto;
  p.outcome = outcome;
  emit(c, {
    code: `story.${p.story}`,
    msg: `${p.title}: ${outcome}`,
    important: option !== p.defaultOption,
  });
}

/** Apply a player's choice at a tick boundary. A choice that has become unaffordable is refused and left open. */
export function applyChoice(c: Campaign, promptSeq: number, option: string): ActionError | null {
  const bad = checkChoice(c, promptSeq, option);
  if (bad) {
    emit(c, { code: `action.rejected.${bad.code}`, msg: `Decision: ${bad.message}` });
    return bad;
  }
  resolve(
    c,
    c.prompts.find((x) => x.seq === promptSeq)!,
    option,
    false,
  );
  return null;
}

/** Per tick: apply defaults whose deadline has passed, then open at most one new story. */
export function stepStories(c: Campaign): void {
  for (const p of c.prompts) {
    if (p.status === 'open' && c.tick >= p.deadlineTick) resolve(c, p, p.defaultOption, true);
  }
  // Conditions read the live forecast, which is not free: ask once a second, not every tick.
  if (c.tick % 10 !== 0) return;
  const thisEpoch = c.prompts.filter((p) => p.epoch === c.epoch);
  if (thisEpoch.length >= MAX_STORIES_PER_EPOCH) return;
  if (thisEpoch.some((p) => c.tick - p.openedTick < MIN_SPACING_TICKS)) return;
  // Nothing new in the last 10 s, when the player should be watching the countdown.
  if (c.tick > 450) return;
  for (const id of ORDER) {
    const def = STORIES[id];
    if (c.tick < def.at || thisEpoch.some((p) => p.story === id)) continue;
    if (!def.when(c)) continue;
    const b = def.build(c);
    const seq = (c.prompts.at(-1)?.seq ?? 0) + 1;
    const prompt: StoryPrompt = {
      seq,
      story: id,
      epoch: c.epoch,
      openedTick: c.tick,
      deadlineTick: c.tick + DEADLINE_TICKS,
      title: b.title,
      body: b.body,
      options: b.options,
      defaultOption: b.defaultOption,
      status: 'open',
      chosen: null,
      auto: false,
      outcome: null,
    };
    c.prompts.push(prompt);
    if (c.prompts.length > 18) c.prompts.splice(0, c.prompts.length - 18);
    emit(c, { code: `story.open.${id}`, msg: b.title });
    return;
  }
}
