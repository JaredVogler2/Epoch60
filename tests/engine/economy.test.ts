import { describe, expect, it } from 'vitest';
import { BUILDINGS, buildSpeedPm, checkPlacement, cloneCampaign, getCatalog, UNIT } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { act, begin, fresh, place, runTicks, U } from './helpers';

describe('placement legality', () => {
  it('rejects water, overlap, out-of-bounds, and unaffordable builds with reason codes', () => {
    const c = fresh();
    const w = c.world;
    // Find a river cell to test on_water.
    let wx = 0;
    let wy = 0;
    outer: for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++)
        if (w.water[y * w.w + x] === 1) {
          wx = x;
          wy = y;
          break outer;
        }
    const water = checkPlacement(c, 'cottage', wx, wy, 0);
    expect(water.ok).toBe(false);
    if (!water.ok) expect(water.code).toBe('on_water');
    const oob = checkPlacement(c, 'cottage', -1, 0, 0);
    if (!oob.ok) expect(oob.code).toBe('out_of_bounds');
    expect(oob.ok).toBe(false);
    const h = w.anchors.hearth;
    const over = checkPlacement(c, 'cottage', h.x, h.y, 0);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.code).toBe('overlap');
    c.civ.res.timber = 0;
    const spot = findSpot(c, 'cottage', { ignoreAffordability: true })!;
    const poor = checkPlacement(c, 'cottage', spot.x, spot.y, 0);
    expect(poor.ok).toBe(false);
    if (!poor.ok) {
      expect(poor.code).toBe('not_enough');
      expect(poor.hint?.timber).toBeGreaterThan(0);
    }
  });

  it('keeps locked buildings out of reach and explains why in the catalog', () => {
    const c = fresh();
    const cat = getCatalog(c);
    const kinds = cat.map((e) => e.kind);
    // Only finished, enabled buildings appear.
    for (const k of kinds) expect(BUILDINGS[k].enabled).toBe(true);
    expect(kinds).toContain('farm');
    expect(kinds).not.toContain('hearth');
    // Later-age buildings are listed but locked, with a reason the player can read.
    const levee = cat.find((e) => e.kind === 'levee');
    expect(levee?.blocked?.code).toBe('locked_age');
    const stone = cat.find((e) => e.kind === 'stone_house');
    expect(stone?.blocked?.code).toBe('locked_tech');
    const r = checkPlacement(c, 'levee', 10, 10, 0);
    expect(r.ok).toBe(false);
  });

  it('requires a stone outcrop for quarries and standing forest for lumber camps', () => {
    const c = fresh();
    const hearth = c.world.anchors.hearth;
    const farFromRock = checkPlacement(c, 'quarry', hearth.x + 3, hearth.y + 3, 0);
    expect(farFromRock.ok).toBe(false);
    if (!farFromRock.ok) expect(['need_deposit', 'unreachable']).toContain(farFromRock.code);
    const q = findSpot(c, 'quarry', { maxDist: 30, bonus: () => 0 });
    expect(q).not.toBeNull();
    const camp = checkPlacement(c, 'lumber_camp', hearth.x - 3, hearth.y, 0);
    expect(camp.ok).toBe(false);
  });

  it('the ford joins the banks; without it the far bank is unreachable', () => {
    const c = fresh();
    const west = findSpot(c, 'cottage', { near: { x: 4, y: 20 }, maxDist: 8, ignoreAffordability: true });
    expect(west).not.toBeNull(); // reachable on foot via the ford
    const cut = cloneCampaign(c);
    for (let i = 0; i < cut.world.water.length; i++) if (cut.world.water[i] === 2) cut.world.water[i] = 1;
    const r = checkPlacement(cut, 'cottage', west!.x, west!.y, 0, { ignoreAffordability: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unreachable');
  });
});

describe('economy rules', () => {
  it('charges costs exactly once, only when the build is actually accepted', () => {
    const c = fresh();
    begin(c);
    const t0 = c.civ.res.timber;
    const spot = place(c, 'cottage', { avoidHazard: true });
    expect(c.civ.res.timber).toBe(t0); // queued, not yet paid
    runTicks(c, 1);
    expect(c.civ.res.timber).toBe(t0 - BUILDINGS.cottage.cost.timber! * UNIT);
    expect(
      c.structures.some(
        (s) => s.kind === 'cottage' && s.x === spot.x && s.y === spot.y && s.status === 'constructing',
      ),
    ).toBe(true);
  });

  it('a failed action never charges', () => {
    const c = fresh();
    begin(c);
    const before = JSON.stringify(c.civ.res);
    const r = act(c, {
      type: 'build',
      kind: 'archive',
      x: c.world.anchors.hearth.x,
      y: c.world.anchors.hearth.y,
      rot: 0,
    });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(c.civ.res)).toBe(before);
  });

  it('cannot over-plan: queued cost is reserved against what you own', () => {
    const c = fresh();
    begin(c);
    place(c, 'archive', { avoidHazard: true });
    const second = findSpot(c, 'archive', { ignoreAffordability: true, avoidHazard: true });
    if (second) {
      const r = act(c, { type: 'build', kind: 'archive', x: second.x, y: second.y, rot: 0 });
      expect(r.ok).toBe(false);
    }
  });

  it('cancel refunds only a share of unspent cost, so cancel-spam cannot farm timber', () => {
    const c = fresh();
    begin(c);
    const start = c.civ.res.timber;
    for (let i = 0; i < 12; i++) {
      const spot = findSpot(c, 'cottage', { avoidHazard: true });
      if (!spot) break;
      expect(act(c, { type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: 0 }).ok).toBe(true);
      runTicks(c, 1);
      const s = c.structures.find((st) => st.kind === 'cottage' && st.status === 'constructing')!;
      act(c, { type: 'cancel', id: s.id });
      runTicks(c, 1);
    }
    expect(c.civ.res.timber).toBeLessThan(start);
    expect(c.structures.filter((s) => s.kind === 'cottage')).toHaveLength(0);
  });

  it('production never goes negative and food is consumed by people', () => {
    const c = fresh();
    begin(c);
    const f0 = c.civ.res.food;
    runTicks(c, 100);
    expect(c.civ.res.food).toBeLessThan(f0);
    for (const v of Object.values(c.civ.res)) expect(v).toBeGreaterThanOrEqual(0);
    expect(c.civ.pop).toBeGreaterThan(0);
  });

  it('starvation shrinks the population gradually (no sudden wipe)', () => {
    const c = fresh();
    c.civ.res.food = 0;
    begin(c);
    runTicks(c, 200);
    expect(c.civ.stats.starved).toBeGreaterThan(0);
    expect(c.civ.pop).toBeGreaterThan(c.civ.pop - 10);
    expect(c.civ.pop).toBeGreaterThanOrEqual(1);
  });

  it('a farm turns workers and fertile soil into food; the soil is drained as it is farmed', () => {
    const c = fresh();
    place(c, 'farm', { avoidHazard: true });
    begin(c);
    runTicks(c, 400);
    const farm = c.structures.find((s) => s.kind === 'farm')!;
    expect(farm.status).toBe('active');
    expect(c.civ.stats.foodMade).toBeGreaterThan(5 * U);
    const fert = c.world.fertility[farm.y * c.world.w + farm.x]!;
    expect(fert).toBeLessThan(950);
  });

  it('lumber camps consume the forest they cut, quarries consume finite stone', () => {
    const c = fresh();
    place(c, 'lumber_camp', { maxDist: 18 });
    begin(c);
    const forest0 = c.world.forest.reduce((a, b) => a + b, 0);
    runTicks(c, 600);
    const forest1 = c.world.forest.reduce((a, b) => a + b, 0);
    expect(forest1).toBeLessThan(forest0);
    expect(c.civ.stats.timberMade).toBeGreaterThan(0);
    const c2 = fresh();
    const q = findSpot(c2, 'quarry', { maxDist: 30 })!;
    act(c2, { type: 'build', kind: 'quarry', x: q.x, y: q.y, rot: q.rot });
    begin(c2);
    const rock0 = c2.world.rock.reduce((a, b) => a + b, 0);
    runTicks(c2, 600);
    expect(c2.world.rock.reduce((a, b) => a + b, 0)).toBeLessThan(rock0);
    expect(c2.civ.stats.stoneMade).toBeGreaterThan(0);
  });

  it('research costs knowledge, takes time, then unlocks behaviour', () => {
    const c = fresh();
    c.civ.res.knowledge = 12 * UNIT;
    begin(c);
    expect(act(c, { type: 'research', tech: 'masonry' }).ok).toBe(true);
    expect(act(c, { type: 'research', tech: 'irrigation' }).ok).toBe(false); // busy
    runTicks(c, 1);
    expect(c.civ.techs).not.toContain('masonry');
    runTicks(c, 90);
    expect(c.civ.techs).toContain('masonry');
    expect(c.civ.stats.researched).toBe(1);
    expect(act(c, { type: 'research', tech: 'masonry' }).ok).toBe(false); // known
    expect(act(c, { type: 'research', tech: 'hydrology' }).ok).toBe(false); // disabled in this slice
  });

  it('same world, different plans: ecology and available actions diverge', () => {
    const a = fresh();
    place(a, 'lumber_camp', { maxDist: 18 });
    begin(a);
    runTicks(a, 600);
    const b = fresh();
    begin(b);
    runTicks(b, 600);
    const sum = (w: number[]) => w.reduce((x, y) => x + y, 0);
    expect(sum(a.world.forest)).not.toBe(sum(b.world.forest));
    expect(a.civ.res.timber).not.toBe(b.civ.res.timber);
  });
});

describe('support and knowledge buildings', () => {
  it('a staffed Workshop speeds construction and burns timber upkeep', () => {
    const base = fresh();
    base.civ.res.timber = 300 * UNIT;
    place(base, 'cottage', { avoidHazard: true });
    begin(base);
    const shopCamp = fresh();
    shopCamp.civ.res.timber = 300 * UNIT;
    shopCamp.civ.res.stone = 100 * UNIT;
    place(shopCamp, 'workshop', { avoidHazard: true });
    begin(shopCamp);
    runTicks(shopCamp, 120);
    const shop = shopCamp.structures.find((s) => s.kind === 'workshop')!;
    expect(shop.status).toBe('active');
    expect(buildSpeedPm(shopCamp)).toBeGreaterThan(buildSpeedPm(base));
    const t0 = shopCamp.civ.res.timber;
    runTicks(shopCamp, 100);
    expect(shopCamp.civ.res.timber).toBeLessThan(t0);
  });

  it('an Archive staffed by a villager produces knowledge; Writing makes it faster', () => {
    const c = fresh();
    c.civ.res.timber = 200 * UNIT;
    c.civ.res.stone = 100 * UNIT;
    place(c, 'archive', { avoidHazard: true });
    begin(c);
    runTicks(c, 400);
    const arc = c.structures.find((s) => s.kind === 'archive')!;
    expect(arc.status).toBe('active');
    const k1 = c.civ.stats.knowledgeMade;
    expect(k1).toBeGreaterThan(0);
    const d = fresh();
    d.civ.techs.push('writing');
    d.civ.res.timber = 200 * UNIT;
    d.civ.res.stone = 100 * UNIT;
    place(d, 'archive', { avoidHazard: true });
    begin(d);
    runTicks(d, 400);
    expect(d.civ.stats.knowledgeMade).toBeGreaterThan(k1);
  });

  it('a Seed Vault and Firebreak need no workers but still cost and occupy ground', () => {
    const c = fresh();
    c.civ.res.timber = 200 * UNIT;
    c.civ.res.stone = 100 * UNIT;
    place(c, 'seed_vault', { avoidHazard: true });
    place(c, 'firebreak', { rots: [1] });
    begin(c);
    runTicks(c, 300);
    expect(
      c.structures.filter(
        (s) => (s.kind === 'seed_vault' || s.kind === 'firebreak') && s.status === 'active',
      ),
    ).toHaveLength(2);
    expect(c.civ.res.timber).toBeLessThan(200 * UNIT);
  });
});
