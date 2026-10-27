import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  cloneCampaign,
  createCampaign,
  EPOCH_TICKS,
  getForecast,
  housingCapacity,
  resolveHazard,
  TECHS,
  TRADITIONS,
} from '../../src/engine';
import type { BuildingKind, Campaign, TechId, TraditionId } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { createStructure } from '../../src/engine/economy/structures';
import { idx } from '../../src/engine/world/query';
import { act, begin, CANON, fresh, runTicks, U } from './helpers';

/**
 * Behavioural tests for rules a mutation could once neutralise unnoticed. Most compare the same village with
 * and without the effect, so they fail as soon as the effect stops doing anything.
 */

/** A campaign standing in `epoch` with full stores, so hunger never muddies a comparison. */
function stage(epoch = 0, seed = CANON): Campaign {
  const c = fresh(seed);
  c.epoch = epoch;
  c.civ.res.food = 400 * U;
  c.civ.res.timber = 400 * U;
  c.civ.res.stone = 400 * U;
  return c;
}

function build(c: Campaign, kind: BuildingKind, status: 'active' | 'damaged' | 'constructing' = 'active') {
  const spot = findSpot(c, kind, { maxDist: 18, ignoreAffordability: true })!;
  return createStructure(c, kind, spot.x, spot.y, 0, status);
}

describe('technologies', () => {
  it('Irrigation makes the same farm yield 25% more food', () => {
    const harvest = (techs: TechId[]) => {
      const c = stage();
      c.civ.techs.push(...techs);
      build(c, 'farm');
      begin(c);
      runTicks(c, 100);
      return c.civ.stats.foodMade;
    };
    const dry = harvest([]);
    expect(dry).toBeGreaterThan(0);
    expect(harvest(['irrigation']) / dry).toBeCloseTo(1.25, 2);
  });

  it('Crop Rotation restores worn soil instead of mining it, and stops draining good soil', () => {
    const soil = (techs: TechId[]) => {
      const c = stage();
      c.civ.techs.push(...techs);
      const farm = build(c, 'farm');
      const worn = idx(farm.x, farm.y);
      const rich = idx(farm.x + 2, farm.y + 2);
      c.world.fertility[worn] = 500;
      c.world.fertility[rich] = 900;
      begin(c);
      runTicks(c, 100);
      return { worn: c.world.fertility[worn]!, rich: c.world.fertility[rich]! };
    };
    const mined = soil(['irrigation']);
    expect(mined.worn).toBeLessThan(500);
    expect(mined.rich).toBeLessThan(900);
    const rotated = soil(['irrigation', 'crop_rotation']);
    expect(rotated.worn).toBeGreaterThan(500);
    expect(rotated.rich).toBe(900);
  });

  it('Forestry spares the forest: the same camp fells far fewer trees for as much timber', () => {
    const cut = (techs: TechId[]) => {
      const c = stage();
      c.civ.techs.push(...techs);
      build(c, 'lumber_camp');
      const forest = () => c.world.forest.reduce((a, b) => a + b, 0);
      const before = forest();
      begin(c);
      runTicks(c, 200);
      return { felled: before - forest(), timber: c.civ.stats.timberMade };
    };
    const plain = cut([]);
    const managed = cut(['forestry']);
    expect(plain.felled).toBeGreaterThan(0);
    expect(managed.timber).toBeGreaterThanOrEqual(plain.timber);
    expect(managed.felled).toBeLessThan(plain.felled * 0.75);
  });

  it('a staffed Forge speeds a lumber camp within reach', () => {
    const timber = (withForge: boolean) => {
      const c = stage(2);
      c.civ.techs.push('masonry', 'bronze_tools', 'ironworking');
      const camp = build(c, 'lumber_camp');
      if (withForge) {
        const near = { x: camp.x + 1, y: camp.y + 1 };
        const spot = findSpot(c, 'forge', { near, maxDist: 6, ignoreAffordability: true })!;
        createStructure(c, 'forge', spot.x, spot.y, 0, 'active');
      }
      begin(c);
      runTicks(c, 100);
      return c.civ.stats.timberMade;
    };
    expect(timber(true)).toBeGreaterThan(timber(false) * 1.2);
  });

  it('Bronze Tools make builders work 15% faster', () => {
    const progress = (techs: TechId[]) => {
      const c = stage();
      c.civ.techs.push(...techs);
      const site = build(c, 'cottage', 'constructing');
      begin(c);
      runTicks(c, 40);
      expect(site.status).toBe('constructing');
      return site.progress;
    };
    expect(progress(['masonry', 'bronze_tools']) * 100).toBe(progress(['masonry']) * 115);
  });

  it('a technology lost in a collapse is rediscovered for 35% less knowledge', () => {
    const c = stage();
    begin(c);
    c.civ.techs.push('masonry', 'writing'); // only the hearth to remember them: one is lost
    runTicks(c, EPOCH_TICKS);
    const lost = c.report!.lostTechs[0]!;
    expect(lost).toBeDefined();
    act(c, { type: 'continue' });
    act(c, { type: 'continue' });
    const plain = c.lineage.interregnum!.traditions.find((t) => !TRADITIONS[t.id].mods.researchCost)!;
    expect(act(c, { type: 'found', site: 0, tradition: plain.id }).ok).toBe(true);
    begin(c);
    c.civ.res.knowledge = 40 * U;
    // Irrigation was never known and has the same authored cost.
    expect(TECHS.irrigation.cost).toBe(TECHS[lost].cost);
    const left = (tech: TechId) => {
      const d = cloneCampaign(c);
      expect(act(d, { type: 'research', tech }).ok).toBe(true);
      runTicks(d, 1);
      return d.civ.res.knowledge;
    };
    expect(left(lost) - left('irrigation')).toBe((TECHS.irrigation.cost * U * 350) / 1000);
  });
});

describe('people and homes', () => {
  it('damaged homes shelter half as many: the village stops growing at half their beds', () => {
    const grown = (status: 'active' | 'damaged') => {
      const c = stage();
      build(c, 'cottage', status);
      build(c, 'cottage', status);
      c.civ.pop = 8;
      begin(c);
      runTicks(c, 400);
      return c.civ.pop;
    };
    expect(grown('damaged')).toBe(6 + 2 + 2); // the hearth's 6 beds and half of each cottage's 4
    expect(grown('active')).toBeGreaterThan(10);
  });

  it('nobody dies in the open when the catastrophe strikes no building', () => {
    // On seed 42 the wildfire burns out before it reaches the hearth.
    const deaths = (field: boolean) => {
      const c = stage(0, 42);
      if (field) createStructure(c, 'farm', 23, 16, 0, 'active'); // in the fire's path, houses nobody
      begin(c);
      expect(c.civ.pop - housingCapacity(c)).toBe(4); // ten settlers, six beds
      runTicks(c, EPOCH_TICKS);
      expect(c.report!.result.impacts.length > 0).toBe(field);
      return c.report!.deaths;
    };
    expect(deaths(false)).toBe(0);
    expect(deaths(true)).toBe(2); // 40% of the four sleeping outdoors, rounded up
  });

  it('welcoming refugees brings three more people and 3 knowledge', () => {
    const answer = (option: 'welcome' | 'turn_away') => {
      const c = stage(1);
      createStructure(c, 'stone_house', 8, 8, 0, 'active');
      createStructure(c, 'stone_house', 12, 8, 0, 'active');
      begin(c);
      runTicks(c, 120);
      const p = c.prompts.find((x) => x.story === 'refugees')!;
      expect(act(c, { type: 'choose', prompt: p.seq, option }).ok).toBe(true);
      runTicks(c, 1);
      return c.civ;
    };
    const welcomed = answer('welcome');
    const refused = answer('turn_away');
    expect(welcomed.pop - refused.pop).toBe(3);
    expect(welcomed.res.knowledge - refused.res.knowledge).toBe(3 * U);
  });
});

describe('orders', () => {
  it('cancelling refunds less the further construction has got', () => {
    const refund = (percentDone: number) => {
      const c = stage();
      begin(c);
      const site = build(c, 'cottage', 'constructing');
      site.progress = (BUILDINGS.cottage.buildWork * 1000 * percentDone) / 100;
      const before = c.civ.res.timber;
      expect(act(c, { type: 'cancel', id: site.id }).ok).toBe(true);
      runTicks(c, 1);
      return c.civ.res.timber - before;
    };
    const cost = BUILDINGS.cottage.cost.timber! * U;
    expect(refund(0)).toBe((cost * 600) / 1000); // untouched: 60% back
    expect(refund(50)).toBe((cost * 300) / 1000); // half built: 30%
    expect(refund(90)).toBe((cost * 60) / 1000); // nearly done: 6%
  });

  it('at most 16 orders can be pending while time runs', () => {
    const c = stage();
    begin(c);
    const order = () => {
      const spot = findSpot(c, 'cottage')!;
      return act(c, { type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: 0 });
    };
    for (let i = 0; i < 16; i++) expect(order().ok).toBe(true);
    const full = order();
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.code).toBe('queue_full');
    runTicks(c, 1); // the queue is applied at the tick boundary...
    expect(order().ok).toBe(true); // ...and takes orders again
  });
});

describe('the forecast is what the collapse resolves', () => {
  it('counts as at risk exactly the buildings the collapse damages or destroys', () => {
    const c = stage();
    const { hearth, fireOrigin } = c.world.anchors;
    const mx = Math.round((hearth.x + fireOrigin.x) / 2);
    const my = Math.round((hearth.y + fireOrigin.y) / 2);
    createStructure(c, 'cottage', mx, my, 0, 'active'); // thatch in the fire's path
    createStructure(c, 'archive', mx + 3, my, 0, 'active'); // scorched stone that stands
    begin(c);
    runTicks(c, EPOCH_TICKS - 1);
    const f = getForecast(c);
    runTicks(c, 1);
    const r = c.report!;
    expect(f.atRisk).toBeGreaterThan(0);
    expect(f.atRisk).toBe(r.structuresLost + r.structuresDamaged);
    expect(f.predicted.impacts.length).toBeGreaterThan(f.atRisk);
  });

  /** Homes in and out of harm's way, and one more person than beds, who sleeps outdoors. */
  function village(epoch: number, homes: [BuildingKind, number, number][]): Campaign {
    const c = stage(epoch);
    for (const [kind, x, y] of homes) createStructure(c, kind, x, y, 0, 'active');
    c.civ.pop = housingCapacity(c) + 1;
    begin(c);
    return c;
  }

  /** At the last tick before the collapse the forecast names the cells, buildings and deaths it resolves. */
  function expectForecastHolds(c: Campaign): void {
    runTicks(c, EPOCH_TICKS - 1);
    const f = getForecast(c);
    runTicks(c, 1);
    const r = c.report!;
    expect(r.result.cells).toEqual(f.predicted.cells);
    const predicted = f.predicted.impacts.map((i) => ({ id: i.id, after: i.after }));
    expect(r.result.impacts.map((i) => ({ id: i.id, after: i.after }))).toEqual(predicted);
    const resolved = predicted.map(({ id }) => ({
      id,
      after: c.structures.find((s) => s.id === id)!.status,
    }));
    expect(resolved).toEqual(predicted);
    expect(r.deaths).toBe(f.predictedDeaths);
    // Not a vacuous match: homes fall, crack and stand, and people die.
    expect(new Set(predicted.map((i) => i.after))).toEqual(new Set(['active', 'damaged', 'rubble']));
    expect(r.deaths).toBeGreaterThan(0);
  }

  it('flood: cells, struck buildings and deaths match at the last tick', () => {
    const c = village(1, [
      ['cottage', 14, 14],
      ['stone_house', 20, 14],
      ['cottage', 8, 8],
      ['stone_house', 12, 8],
    ]);
    expect(getForecast(c).kind).toBe('flood');
    expectForecastHolds(c);
  });

  it('quake: cells, struck buildings and deaths match at the last tick', () => {
    const c = village(2, [
      ['cottage', 20, 7],
      ['stone_house', 23, 11],
      ['cottage', 1, 1],
      ['stone_house', 14, 14],
    ]);
    expect(getForecast(c).kind).toBe('quake');
    expectForecastHolds(c);
  });
});

describe('traditions', () => {
  const struck = (c: Campaign, id: number) => resolveHazard(c).impacts.find((i) => i.id === id)!;

  it('Remember the Fire: the fire that would crack the hearth leaves it intact', () => {
    const c = stage(0);
    const hearth = c.structures.find((s) => s.kind === 'hearth')!;
    const before = struck(c, hearth.id);
    c.civ.traditions.push('remember_fire');
    const after = struck(c, hearth.id);
    expect(before.after).toBe('damaged');
    expect(after.after).toBe('active');
    expect(after.damage).toBeLessThan(before.damage);
  });

  it('High Ground: homes take less damage from the flood and from the quake', () => {
    for (const epoch of [1, 2]) {
      const c = stage(epoch);
      const home = createStructure(c, 'cottage', 14, 14, 0, 'active');
      const plain = struck(c, home.id).damage;
      c.civ.traditions.push('high_ground');
      expect(struck(c, home.id).damage, `epoch ${epoch}`).toBeLessThan(plain);
    }
  });

  it('Deep Larders: founders start with 8 more food, and roofs carry more ash', () => {
    const c = stage(0);
    begin(c);
    runTicks(c, EPOCH_TICKS);
    act(c, { type: 'continue' });
    act(c, { type: 'continue' });
    // Deep Larders is offered after an ash winter; offer it here to compare like with like.
    const foundedWith = (tradition: TraditionId) => {
      const d = cloneCampaign(c);
      d.lineage.interregnum!.traditions = [{ id: tradition, because: 'test' }];
      expect(act(d, { type: 'found', site: 0, tradition }).ok).toBe(true);
      return d.civ.res.food;
    };
    expect(foundedWith('deep_larders') - foundedWith('remember_fire')).toBe(8 * U);

    const winter = createCampaign(CANON, 'standard', 'ashen');
    winter.epoch = 2;
    const roof = createStructure(winter, 'cottage', 14, 14, 0, 'active');
    const plain = struck(winter, roof.id).damage;
    winter.civ.traditions.push('deep_larders');
    expect(struck(winter, roof.id).damage).toBeLessThan(plain);
  });
});
