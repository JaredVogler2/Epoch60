import { BUILDINGS } from '../content/buildings';
import { TECHS } from '../content/techs';
import { TRADITIONS } from '../content/traditions';
import { EPOCH_TICKS, UNIT } from '../core/constants';
import type {
  Action,
  BuildingKind,
  Campaign,
  HazardKind,
  LaborFocus,
  TechId,
  TraditionId,
} from '../core/types';
import { advanceFixedTick, dispatchAction } from '../campaign';
import { ruinYield } from '../legacy/inheritance';
import { findSpot, sumField, type SpotOptions } from './spots';
import { nextInt, createRngState } from '../core/prng';
import { hasTech } from '../economy/modifiers';
import { countKind } from '../economy/placement';
import { resolveHazard } from '../world/hazards';

/** One thing a policy wants, in priority order. Bots issue the first affordable, legal, unsatisfied want. */
export interface Want {
  id: string;
  kind?: BuildingKind;
  /** Desired count of this kind (non-rubble, including planned). */
  count?: number | ((c: Campaign) => number);
  spot?: SpotOptions | ((c: Campaign) => SpotOptions);
  research?: TechId;
  /** Earliest / latest tick (inclusive) to act. */
  from?: number;
  to?: number;
  /** Only when this holds. */
  when?: (c: Campaign) => boolean;
  /** Reinforce every standing building of these kinds against the epoch hazard. */
  reinforce?: BuildingKind[];
  rot?: (0 | 1)[];
  /** Build a protective line: place until the predicted hazard no longer hits `protect` kinds. */
  repair?: boolean;
}

export interface Policy {
  name: string;
  focus: (c: Campaign) => LaborFocus;
  wants: (c: Campaign) => Want[];
  /** Interregnum choices. */
  site: (c: Campaign) => number;
  tradition: (c: Campaign) => TraditionId;
  excavate: (c: Campaign) => number | null;
}

const soil = (c: Campaign) => (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.fertility, x, y, w, h) / (w * h) / 5;
const rock = (c: Campaign) => (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.rock, x - 1, y - 1, w + 2, h + 2) * 2;
const trees = (c: Campaign) => (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.forest, x - 3, y - 3, w + 6, h + 6) / 60;

export function spotFor(c: Campaign, w: Want): SpotOptions {
  const o = typeof w.spot === 'function' ? w.spot(c) : (w.spot ?? {});
  if (w.kind === 'farm') return { bonus: soil(c), ...o };
  if (w.kind === 'lumber_camp') return { bonus: trees(c), maxDist: 18, ...o };
  if (w.kind === 'quarry') return { bonus: rock(c), maxDist: 22, ...o };
  return o;
}

export function tryWant(c: Campaign, w: Want, rots: (0 | 1)[] = [0]): boolean {
  if (w.from !== undefined && c.tick < w.from) return false;
  if (w.to !== undefined && c.tick > w.to) return false;
  if (w.when && !w.when(c)) return false;
  if (w.research) {
    const r = dispatchAction(c, { type: 'research', tech: w.research });
    return r.ok;
  }
  if (w.reinforce) {
    const hz = resolveHazard(c).kind;
    for (const s of c.structures) {
      if (
        !w.reinforce.includes(s.kind) ||
        (s.status !== 'active' && s.status !== 'damaged') ||
        s.bonus[hz] > 0
      )
        continue;
      const r = dispatchAction(c, { type: 'reinforce', id: s.id, hazard: hz });
      if (r.ok) return true;
    }
    return false;
  }
  if (w.repair) {
    for (const s of c.structures) {
      if (s.status === 'damaged' || ((s.status === 'rubble' || s.status === 'buried') && s.excavated)) {
        const r = dispatchAction(c, { type: 'repair', id: s.id });
        if (r.ok) return true;
      }
    }
    return false;
  }
  if (!w.kind) return false;
  const want = typeof w.count === 'function' ? w.count(c) : (w.count ?? 1);
  if (countKind(c, w.kind) >= want) return false;
  const spot = findSpot(c, w.kind, { rots: w.rot ?? rots, ...spotFor(c, w) });
  if (!spot) return false;
  return dispatchAction(c, { type: 'build', kind: w.kind, x: spot.x, y: spot.y, rot: spot.rot }).ok;
}

/** Play the interregnum with a policy's choices. Pure function of the campaign state. */
export function playInterregnum(c: Campaign, p: Policy): void {
  const inter = c.lineage.interregnum;
  if (!inter) return;
  for (let i = 0; i < inter.surveysLeft; i++) {
    const ruin = c.structures.find(
      (s) =>
        (s.status === 'rubble' || s.status === 'buried') &&
        !s.surveyed &&
        (s.kind === 'archive' || s.kind === 'seed_vault'),
    );
    if (ruin) dispatchAction(c, { type: 'survey', id: ruin.id });
  }
  const ex = p.excavate(c);
  if (ex !== null) dispatchAction(c, { type: 'excavate', id: ex });
  const site = Math.min(p.site(c), inter.sites.length - 1);
  const wanted = p.tradition(c);
  const tr = inter.traditions.some((t) => t.id === wanted) ? wanted : inter.traditions[0]!.id;
  dispatchAction(c, { type: 'found', site: Math.max(0, site), tradition: tr });
}

/** Excavate the ruin with the best expected yield (techs first, then food/stone). */
export function bestExcavation(c: Campaign): number | null {
  let best: { id: number; v: number } | null = null;
  for (const s of c.structures) {
    if (s.status !== 'rubble' && s.status !== 'buried') continue;
    const y = ruinYield(s);
    let v =
      y.techs.length * 40 +
      y.resources.knowledge / UNIT +
      y.resources.food / UNIT +
      y.resources.stone / UNIT +
      y.resources.timber / (2 * UNIT);
    if (s.kind === 'dam' || s.kind === 'bridge' || s.kind === 'levee') v += 12;
    if (s.kind === 'seed_vault') v += 10;
    if (!best || v > best.v) best = { id: s.id, v };
  }
  return best && best.v > 0 ? best.id : null;
}

export interface BotRun {
  campaign: Campaign;
  /** Per-epoch snapshot of what happened, for traces and reports. */
  epochs: {
    epoch: number;
    survivors: number;
    deaths: number;
    decisions: number;
    hazard: HazardKind;
    headline: string;
  }[];
}

/** Drive a whole campaign with a policy. `think` runs every `step` ticks. */
export function playCampaign(
  c: Campaign,
  p: Policy,
  opts: { step?: number; maxEpochs?: number } = {},
): BotRun {
  const step = opts.step ?? 5;
  const run: BotRun = { campaign: c, epochs: [] };
  let guard = 0;
  while (c.phase !== 'VICTORY' && c.phase !== 'DEFEAT' && guard++ < 50_000) {
    if (c.phase === 'PREPARE') {
      dispatchAction(c, { type: 'setFocus', focus: p.focus(c) });
      // Opening plan slots: the first wants that are legal at tick 0.
      for (const w of p.wants(c)) {
        if (c.queue.length >= 3) break;
        if ((w.from ?? 0) > 0 || w.research || w.reinforce) continue;
        tryWant(c, w);
      }
      dispatchAction(c, { type: 'beginEpoch' });
    } else if (c.phase === 'ACTIVE') {
      if (c.tick % step === 0) {
        const f = p.focus(c);
        if (f !== c.civ.focus) dispatchAction(c, { type: 'setFocus', focus: f });
        for (const w of p.wants(c)) {
          if (tryWant(c, w)) break;
        }
      }
      advanceFixedTick(c);
    } else if (c.phase === 'COLLAPSING') {
      const r = c.report!;
      run.epochs.push({
        epoch: c.epoch,
        survivors: r.survivors,
        deaths: r.deaths,
        decisions: c.civ.stats.decisions,
        hazard: r.hazard,
        headline: r.headline,
      });
      dispatchAction(c, { type: 'continue' });
    } else if (c.phase === 'DEBRIEF') {
      dispatchAction(c, { type: 'continue' });
    } else if (c.phase === 'INTERREGNUM') {
      playInterregnum(c, p);
    } else {
      break;
    }
    if (opts.maxEpochs !== undefined && run.epochs.length >= opts.maxEpochs && c.phase !== 'ACTIVE') break;
  }
  return run;
}

/** Baselines ---------------------------------------------------------- */

export const noopPolicy: Policy = {
  name: 'noop',
  focus: () => 'balanced',
  wants: () => [],
  site: () => 0,
  tradition: () => 'open_hands',
  excavate: () => null,
};

/** Random legal spam: the strategy thoughtful play must beat. */
export function randomPolicy(seed: number): Policy {
  const rng = createRngState(seed, 99);
  return {
    name: 'random',
    focus: () => 'balanced',
    wants: (c) => {
      const kinds = Object.values(BUILDINGS)
        .filter((d) => d.enabled && !d.founder && d.age <= c.epoch && (!d.tech || hasTech(c, d.tech)))
        .map((d) => d.kind);
      const kind = kinds[nextInt(rng, kinds.length)]!;
      const techs = Object.values(TECHS).filter((t) => t.enabled);
      const tech = techs[nextInt(rng, techs.length)]!.id;
      const pick = nextInt(rng, 5);
      return pick === 0
        ? [{ id: 'r-tech', research: tech }]
        : [{ id: 'r-build', kind, count: 99, spot: { maxDist: 16 } as SpotOptions }];
    },
    site: () => 0,
    tradition: () => 'open_hands',
    excavate: () => null,
  };
}

export { TRADITIONS, EPOCH_TICKS };
export type { Action };
