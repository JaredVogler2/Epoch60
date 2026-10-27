import { describe, expect, it } from 'vitest';
import {
  advanceFixedTick,
  BUILDING_KINDS,
  computeHash,
  createCampaign,
  dispatchAction,
  runTicks,
  UNIT,
} from '../../src/engine';
import type { Action, Campaign, HazardKind, TechId } from '../../src/engine';
import { checkInvariants } from '../../src/engine/ai/invariants';
import { findSpot } from '../../src/engine/ai/spots';
import { createRngState, nextInt } from '../../src/engine/core/prng';
import { TECH_IDS } from '../../src/engine';

const HAZARDS: HazardKind[] = ['fire', 'flood', 'quake'];

/** Random legal-or-not actions of every type. The engine must refuse nonsense without corrupting anything. */
function chaos(c: Campaign, rng: ReturnType<typeof createRngState>): Action {
  const pick = <T>(xs: readonly T[]) => xs[nextInt(rng, xs.length)]!;
  const id = () => (c.structures.length && nextInt(rng, 4) ? pick(c.structures).id : nextInt(rng, 60));
  switch (nextInt(rng, 14)) {
    case 0:
    case 1:
    case 2:
    case 3:
      return {
        type: 'build',
        kind: pick(BUILDING_KINDS),
        x: nextInt(rng, 38) - 3,
        y: nextInt(rng, 38) - 3,
        rot: nextInt(rng, 2) as 0 | 1,
      };
    case 4:
      return { type: 'cancel', id: id() };
    case 5:
      return { type: 'demolish', id: id() };
    case 6:
      return { type: 'repair', id: id() };
    case 7:
      return { type: 'reinforce', id: id(), hazard: pick(HAZARDS) };
    case 8:
      return { type: 'research', tech: pick(TECH_IDS as TechId[]) };
    case 9:
      return {
        type: 'setFocus',
        focus: pick(['balanced', 'food', 'timber', 'stone', 'knowledge', 'build'] as const),
      };
    case 10:
      return { type: 'choose', prompt: nextInt(rng, 5), option: pick(['ignore', 'welcome', 'fund', 'x']) };
    case 11:
      return { type: 'survey', id: id() };
    case 12:
      return { type: 'excavate', id: id() };
    default:
      return { type: 'continue' };
  }
}

function playChaos(seed: number): { c: Campaign; violations: string[]; accepted: number } {
  const c = createCampaign(seed);
  const rng = createRngState(seed, 7);
  const violations: string[] = [];
  let accepted = 0;
  let guard = 0;
  while (c.phase !== 'VICTORY' && c.phase !== 'DEFEAT' && guard++ < 6000) {
    for (let i = 0; i < 1 + nextInt(rng, 3); i++) {
      if (dispatchAction(c, chaos(c, rng)).ok) accepted++;
    }
    if (c.phase === 'PREPARE' && nextInt(rng, 3) === 0) dispatchAction(c, { type: 'beginEpoch' });
    if (c.phase === 'INTERREGNUM' && c.lineage.interregnum) {
      const inter = c.lineage.interregnum;
      dispatchAction(c, {
        type: 'found',
        site: nextInt(rng, inter.sites.length + 1),
        tradition: inter.traditions[nextInt(rng, inter.traditions.length)]!.id,
      });
    }
    if (c.phase === 'ACTIVE') runTicks(c, 1 + nextInt(rng, 20));
    if (c.phase === 'COLLAPSING' || c.phase === 'DEBRIEF') dispatchAction(c, { type: 'continue' });
    if (guard % 7 === 0) {
      const v = checkInvariants(c);
      if (v.length) {
        violations.push(...v.map((x) => `seed ${seed} step ${guard} ${c.phase}: ${x}`));
        break;
      }
    }
  }
  violations.push(...checkInvariants(c));
  return { c, violations, accepted };
}

describe('random-action fuzz', () => {
  it('never crashes, goes NaN/negative, or corrupts the map across 30 seeds of chaotic play', () => {
    let accepted = 0;
    let finished = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = playChaos(seed);
      expect(r.violations, `seed ${seed}`).toEqual([]);
      accepted += r.accepted;
      if (r.c.phase === 'VICTORY' || r.c.phase === 'DEFEAT') finished++;
    }
    // The fuzzer must actually be doing things, not being refused everywhere.
    expect(accepted).toBeGreaterThan(300);
    expect(finished).toBeGreaterThan(5);
  }, 120_000);

  it('chaos on the canonical seed is reproducible: same actions, same hash', () => {
    const a = playChaos(6001);
    const b = playChaos(6001);
    expect(computeHash(a.c)).toBe(computeHash(b.c));
  }, 60_000);
});

describe('exploit probes', () => {
  const rich = (c: Campaign) => {
    c.civ.res.timber = 400 * UNIT;
    c.civ.res.stone = 400 * UNIT;
    c.civ.res.food = 400 * UNIT;
  };

  it('build-then-cancel loops can never mint resources', () => {
    const c = createCampaign(6001);
    rich(c);
    dispatchAction(c, { type: 'beginEpoch' });
    const start = { ...c.civ.res };
    for (let i = 0; i < 40; i++) {
      const h = c.world.anchors.hearth;
      const r = dispatchAction(c, { type: 'build', kind: 'cottage', x: h.x + 4, y: h.y + (i % 3), rot: 0 });
      if (!r.ok) continue;
      runTicks(c, 1);
      const s = c.structures.filter((x) => x.kind === 'cottage' && x.status === 'constructing').at(-1);
      if (s) dispatchAction(c, { type: 'cancel', id: s.id });
      runTicks(c, 1);
    }
    expect(c.civ.res.timber).toBeLessThanOrEqual(start.timber);
    expect(c.civ.res.stone).toBeLessThanOrEqual(start.stone);
  });

  it('build-then-demolish loops are strictly lossy', () => {
    const c = createCampaign(6001);
    rich(c);
    dispatchAction(c, { type: 'beginEpoch' });
    c.civ.focus = 'build';
    const start = c.civ.res.timber;
    for (let round = 0; round < 3; round++) {
      const h = c.world.anchors.hearth;
      dispatchAction(c, { type: 'build', kind: 'cottage', x: h.x + 4, y: h.y, rot: 0 });
      runTicks(c, 120);
      const s = c.structures.find((x) => x.kind === 'cottage' && x.status === 'active');
      if (s) dispatchAction(c, { type: 'demolish', id: s.id });
      runTicks(c, 2);
    }
    expect(c.civ.res.timber).toBeLessThan(start);
  });

  it('repairing never refunds, and reinforcing twice is refused', () => {
    const c = createCampaign(6001);
    rich(c);
    dispatchAction(c, { type: 'beginEpoch' });
    const spot = findSpot(c, 'archive', { maxDist: 16 })!;
    expect(dispatchAction(c, { type: 'build', kind: 'archive', x: spot.x, y: spot.y, rot: 0 }).ok).toBe(true);
    c.civ.focus = 'build';
    runTicks(c, 300);
    const a = c.structures.find((x) => x.kind === 'archive' && x.status === 'active')!;
    expect(a).toBeDefined();
    // Damaged and repaired again and again: every repair costs timber and stone, none pays anything back.
    for (let round = 0; round < 3; round++) {
      a.status = 'damaged';
      const before = { ...c.civ.res };
      expect(dispatchAction(c, { type: 'repair', id: a.id }).ok).toBe(true);
      runTicks(c, 1);
      expect(a.status).toBe('constructing');
      expect(c.civ.res.timber).toBeLessThan(before.timber);
      expect(c.civ.res.stone).toBeLessThan(before.stone);
      runTicks(c, 60);
      expect(a.status).toBe('active');
    }
    expect(dispatchAction(c, { type: 'reinforce', id: a.id, hazard: 'fire' }).ok).toBe(true);
    runTicks(c, 1);
    expect(dispatchAction(c, { type: 'reinforce', id: a.id, hazard: 'fire' }).ok).toBe(false);
  });

  it('founding twice, continuing out of order and acting after the end are all refused', () => {
    const c = createCampaign(6001);
    expect(dispatchAction(c, { type: 'continue' }).ok).toBe(false);
    expect(dispatchAction(c, { type: 'found', site: 0, tradition: 'open_hands' }).ok).toBe(false);
    dispatchAction(c, { type: 'beginEpoch' });
    expect(dispatchAction(c, { type: 'beginEpoch' }).ok).toBe(false);
    let guard = 0;
    while (c.phase === 'ACTIVE' && guard++ < 700) advanceFixedTick(c);
    expect(dispatchAction(c, { type: 'build', kind: 'farm', x: 1, y: 1, rot: 0 }).ok).toBe(false);
  });

  it('a decision cannot be answered during planning, and never charges when refused', () => {
    const c = createCampaign(6001);
    const before = { ...c.civ.res };
    expect(dispatchAction(c, { type: 'choose', prompt: 1, option: 'welcome' }).ok).toBe(false);
    expect(c.civ.res).toEqual(before);
  });
});
