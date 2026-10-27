import { describe, expect, it } from 'vitest';
import {
  computeHash,
  createCampaign,
  dispatchAction,
  getForecast,
  resolveHazard,
  runTicks,
  UNIT,
} from '../../src/engine';
import type { Campaign } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { ASH_WINTER_TICKS, ashDepthAt, ventOf, winterLarder } from '../../src/engine/world/hazards';
import { idx } from '../../src/engine/world/query';

/** The Ashen Winter's final age: iron-age village, ash on the way. */
function winter(food = 40): Campaign {
  const c = createCampaign(6001, 'standard', 'ashen');
  c.epoch = 2;
  c.civ.res.food = food * UNIT;
  c.civ.res.timber = 200 * UNIT;
  c.civ.res.stone = 200 * UNIT;
  return c;
}

describe('ashfall: a fourth disaster with its own physics', () => {
  it('is a pure function of state: the forecast equals the resolution', () => {
    const c = winter();
    createStructure(c, 'cottage', 14, 14, 0, 'active');
    expect(c.civ.pop).toBeGreaterThan(0);
    const predicted = resolveHazard(c);
    expect(predicted.kind).toBe('ash');
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 600);
    expect(c.report!.result.cells).toEqual(predicted.cells);
  });

  it('falls heaviest near the vent and thins downwind; the river carries it away', () => {
    const c = winter();
    const v = ventOf(c);
    const near = ashDepthAt(c, v.x, v.y, 700);
    const downwind = ashDepthAt(c, 6, v.y, 700);
    const upwind = ashDepthAt(c, 31, v.y + 14, 700);
    expect(near).toBeGreaterThan(downwind);
    expect(downwind).toBeGreaterThan(0);
    expect(upwind).toBeLessThan(near);
    const r = resolveHazard(c);
    for (const cell of r.cells) expect(c.world.water[idx(cell.x, cell.y)]).toBe(0);
  });

  it('is a regional hazard: nowhere is perfectly safe, but robust roofs shed it', () => {
    const c = winter();
    const thatch = createStructure(c, 'cottage', 14, 14, 0, 'active');
    const stone = createStructure(c, 'stone_house', 14, 18, 0, 'active');
    const r = resolveHazard(c);
    const t = r.impacts.find((i) => i.id === thatch.id)!;
    const s = r.impacts.find((i) => i.id === stone.id)!;
    expect(t.damage).toBeGreaterThan(s.damage);
    expect(t.after).not.toBe('active');
    // A steep-roofed tradition and a re-pitched roof both help.
    c.civ.traditions.push('steep_roofs');
    expect(resolveHazard(c).impacts.find((i) => i.id === thatch.id)!.damage).toBeLessThan(t.damage);
    const d = winter();
    const t2 = createStructure(d, 'cottage', 14, 14, 0, 'active');
    t2.bonus.ash = 220;
    expect(resolveHazard(d).impacts.find((i) => i.id === t2.id)!.damage).toBeLessThan(t.damage);
  });
});

describe('the larder decides who eats', () => {
  it('counts the winter as a fixed span of lost harvest and what has been put by', () => {
    const c = winter(30);
    const l = winterLarder(c);
    expect(l.perPerson).toBeCloseTo((12 * ASH_WINTER_TICKS) / UNIT, 5);
    expect(l.need).toBe(Math.round(c.civ.pop * l.perPerson));
    expect(l.have).toBe(30);
    createStructure(c, 'granary', 10, 10, 0, 'active');
    expect(winterLarder(c).have).toBe(55);
    const damaged = createStructure(c, 'granary', 12, 10, 0, 'damaged');
    expect(damaged.status).toBe('damaged');
    expect(winterLarder(c).have).toBe(55 + 12);
  });

  it('shortfall is paid in lives, and food or a sealed granary prevents it', () => {
    const starved = (food: number, granaries = 0) => {
      const c = winter(food);
      c.civ.pop = 12;
      for (let i = 0; i < granaries; i++) createStructure(c, 'granary', 4 + i * 3, 4, 0, 'active');
      createStructure(c, 'stone_house', 20, 20, 0, 'active');
      createStructure(c, 'stone_house', 22, 20, 0, 'active');
      createStructure(c, 'stone_house', 24, 20, 0, 'active');
      return getForecast(c).predictedDeaths;
    };
    const poor = starved(0);
    const fed = starved(60);
    const sealed = starved(0, 2);
    expect(poor).toBeGreaterThan(fed);
    expect(sealed).toBeLessThan(poor);
    expect(poor).toBeLessThanOrEqual(12);
    // 12 people need 43.2 food; 60 covers it, so no one starves.
    expect(fed).toBe(0);
  });

  it('the debrief explains the famine and the remedy', () => {
    const c = winter(300);
    createStructure(c, 'stone_house', 20, 20, 0, 'active');
    c.civ.pop = 8;
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 599);
    c.civ.res.food = 5 * UNIT; // the stores ran down before the sky fell
    runTicks(c, 1);
    const r = c.report!;
    expect(r.hazard).toBe('ash');
    expect(r.causes.join(' ')).toMatch(/Granary/);
    expect(r.causes.join(' ')).toMatch(/starved|put by/);
  });
});

describe('combination effects', () => {
  it('ash poisons the soil for generations: pollution rises, fertility and trees fall, and the farms feel it', () => {
    const c = winter(80);
    const before = c.world.fertility.slice();
    const forestBefore = c.world.forest.slice();
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 600);
    const cells = c.report!.result.cells;
    let polluted = 0;
    let lowered = 0;
    let fewerTrees = 0;
    for (const cell of cells) {
      const i = idx(cell.x, cell.y);
      if (c.world.pollution[i]! > 0) polluted++;
      if (c.world.fertility[i]! < before[i]!) lowered++;
      if (c.world.forest[i]! < forestBefore[i]!) fewerTrees++;
    }
    expect(polluted).toBeGreaterThan(cells.length * 0.9);
    expect(lowered).toBeGreaterThan(cells.length * 0.5);
    expect(fewerTrees).toBeGreaterThan(0);
  });

  it('a Grove planted against floods becomes fuel for the next fire (a legacy that turns on you)', () => {
    const base = createCampaign(6001);
    const withGroves = createCampaign(6001);
    const h = base.world.anchors.hearth;
    for (const [dx, dy] of [
      [4, -3],
      [4, 0],
      [4, 3],
      [7, -3],
      [7, 0],
      [7, 3],
    ] as [number, number][])
      createStructure(withGroves, 'grove', h.x + dx, h.y + dy, 0, 'active');
    const flood = (c: Campaign) => {
      c.epoch = 1;
      return resolveHazard(c, 'flood').area;
    };
    expect(flood(withGroves)).toBeLessThanOrEqual(flood(base));
    const fire = (c: Campaign) => {
      c.epoch = 0;
      return resolveHazard(c, 'fire').area;
    };
    expect(fire(withGroves)).toBeGreaterThan(fire(base));
  });

  it('a Forge-fouled valley and ash stack: the same land is poorer after both', () => {
    const clean = winter(80);
    const forged = winter(80);
    const f = createStructure(forged, 'forge', 18, 14, 0, 'active');
    forged.civ.pop = 12;
    dispatchAction(forged, { type: 'beginEpoch' });
    runTicks(forged, 300);
    dispatchAction(clean, { type: 'beginEpoch' });
    runTicks(clean, 300);
    const k = idx(f.x + 1, f.y + 1);
    expect(forged.world.fertility[k]!).toBeLessThan(clean.world.fertility[k]!);
  });
});

describe('the Ashen Winter scenario', () => {
  it('shares Greenvale’s first two ages and ends in an ashfall winter', () => {
    const c = createCampaign(6001, 'standard', 'ashen');
    expect(c.scenario).toBe('ashen');
    const a = [0, 1, 2].map((e) => {
      c.epoch = e;
      return resolveHazard(c).kind;
    });
    expect(a).toEqual(['fire', 'flood', 'ash']);
  });

  it('is deterministic: the same actions give the same hash', () => {
    const run = () => {
      const c = winter(30);
      createStructure(c, 'granary', 10, 10, 0, 'active');
      dispatchAction(c, { type: 'beginEpoch' });
      runTicks(c, 600);
      return computeHash(c);
    };
    expect(run()).toBe(run());
  });
});
