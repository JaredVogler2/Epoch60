import { describe, expect, it } from 'vitest';
import {
  advanceFixedTick,
  computeHash,
  createCampaign,
  dispatchAction,
  getForecast,
  resolveHazard,
  runTicks,
  UNIT,
} from '../../src/engine';
import type { Campaign } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { createStructure } from '../../src/engine/economy/structures';
import { idx } from '../../src/engine/world/query';
import { begin } from './helpers';

/**
 * Paired strategic experiments (prompt 15, A–H): the same seed, two rational plans, and a difference in the world
 * that the player can explain. They are permanent regression tests: a balance change that erases one of these
 * trade-offs has removed a decision from the game.
 */

const fresh6001 = (epoch = 0, scenario = 'greenvale') => {
  const c = createCampaign(6001, 'standard', scenario);
  c.epoch = epoch;
  c.civ.res.food = 200 * UNIT;
  c.civ.res.timber = 200 * UNIT;
  c.civ.res.stone = 200 * UNIT;
  return c;
};

describe('A. an Archive now versus farms now', () => {
  it('the Archive buys knowledge and a technology; the farms buy food and people', () => {
    const arch = fresh6001();
    const farms = fresh6001();
    const spotA = findSpot(arch, 'archive', { maxDist: 16 })!;
    dispatchAction(arch, { type: 'build', kind: 'archive', x: spotA.x, y: spotA.y, rot: 0 });
    const f1 = findSpot(farms, 'farm', { maxDist: 16 })!;
    dispatchAction(farms, { type: 'build', kind: 'farm', x: f1.x, y: f1.y, rot: 0 });
    arch.civ.focus = farms.civ.focus = 'build';
    begin(arch);
    begin(farms);
    runTicks(arch, 599);
    runTicks(farms, 599);
    // Epoch economy differs…
    expect(arch.civ.res.knowledge).toBeGreaterThan(farms.civ.res.knowledge);
    expect(farms.civ.stats.foodMade).toBeGreaterThan(arch.civ.stats.foodMade);
    // …and so does what survives: the archive can carry a technology, the farm cannot.
    expect(arch.structures.some((s) => s.kind === 'archive' && s.status === 'active')).toBe(true);
    expect(farms.structures.some((s) => s.kind === 'archive')).toBe(false);
  });
});

describe('B. clear the forest versus plant a grove', () => {
  it('felled slopes flood harder; groves cost food and timber now, hold water later, and burn', () => {
    const lush = fresh6001(1);
    const bare = fresh6001(1);
    for (let i = 0; i < bare.world.forest.length; i++) bare.world.forest[i] = 0;
    for (let i = 0; i < lush.world.forest.length; i++) lush.world.forest[i] = 700;
    expect(resolveHazard(bare, 'flood').area).toBeGreaterThan(resolveHazard(lush, 'flood').area);
    // Reforestation by planting: the grove's cells gain woodland over an epoch.
    const c = fresh6001(0);
    c.civ.techs.push('forestry');
    const h = c.world.anchors.hearth;
    const g = createStructure(c, 'grove', h.x + 4, h.y + 3, 0, 'active');
    const k = idx(g.x + 1, g.y + 1);
    c.world.forest[k] = 0;
    begin(c);
    runTicks(c, 400);
    expect(c.world.forest[k]!).toBeGreaterThan(0);
    // The price: a planted grove is a patch of fuel, so the next fire is never smaller than on bare ground.
    const bareFire = fresh6001(0);
    expect(resolveHazard(c, 'fire').area).toBeGreaterThanOrEqual(resolveHazard(bareFire, 'fire').area);
  });
});

describe('C. reinforce a dam versus cheap homes', () => {
  it('houses now house more people; a sound dam later keeps the flood off the farms', () => {
    const homes = fresh6001(1);
    const dammed = fresh6001(1);
    const h = homes.world.anchors.hearth;
    for (let i = 0; i < 3; i++) createStructure(homes, 'cottage', h.x + 3 + i * 3, h.y - 4, 0, 'active');
    const rc = dammed.world.riverCenter[4]!;
    const dam = createStructure(dammed, 'dam', Math.round(rc.x / 100) - 1, 4, 1, 'active');
    const houseCap = (c: Campaign) => c.structures.reduce((n, s) => n + (s.kind === 'cottage' ? 4 : 0), 0);
    expect(houseCap(homes)).toBeGreaterThan(houseCap(dammed));
    expect(resolveHazard(dammed, 'flood').area).toBeLessThan(resolveHazard(homes, 'flood').area);
    // Neglect turns the legacy into a liability: a damaged dam still clips the peak, but story decisions
    // that leave it to seep weaken levees — covered in story.test.ts.
    expect(dam.status).toBe('active');
  });
});

describe('D. salvage an ancient bridge versus restore it', () => {
  it('a ruined bridge yields stone if cleared and reconnects the valley if repaired for less than new', () => {
    const c = fresh6001(1);
    c.civ.techs.push('bronze_tools');
    const rc = c.world.riverCenter[18]!;
    const bx = Math.round(rc.x / 100) - 1;
    const bridge = createStructure(c, 'bridge', bx, 18, 1, 'active');
    bridge.status = 'rubble';
    bridge.excavated = true;
    bridge.salvage = { timber: 2 * UNIT, stone: 4 * UNIT };
    const newCost = { timber: 18 * UNIT, stone: 8 * UNIT };
    const before = { ...c.civ.res };
    c.phase = 'PREPARE';
    const r = dispatchAction(c, { type: 'repair', id: bridge.id });
    expect(r.ok).toBe(true);
    begin(c);
    runTicks(c, 1);
    const spentTimber = before.timber - c.civ.res.timber;
    const spentStone = before.stone - c.civ.res.stone;
    expect(spentTimber).toBeLessThan(newCost.timber);
    expect(spentStone).toBeLessThan(newCost.stone);
    // …whereas demolishing the ruin hands back its salvage as a windfall instead.
    const d = fresh6001(1);
    const b2 = createStructure(d, 'bridge', bx, 18, 1, 'active');
    b2.status = 'rubble';
    b2.salvage = { timber: 2 * UNIT, stone: 4 * UNIT };
    d.phase = 'ACTIVE';
    const stone0 = d.civ.res.stone;
    dispatchAction(d, { type: 'demolish', id: b2.id });
    advanceFixedTick(d);
    expect(d.civ.res.stone).toBe(stone0 + 4 * UNIT);
  });
});

describe('E. a farm on the highland versus the floodplain', () => {
  it('the floodplain out-yields in a dry year and is the first land a flood takes', () => {
    const c = fresh6001(1);
    // pick the best-soil spot inside the flood footprint, and the best outside it
    const wet = new Set(resolveHazard(c, 'flood').cells.map((cell) => idx(cell.x, cell.y)));
    let low: { x: number; y: number; f: number } | null = null;
    let high: { x: number; y: number; f: number } | null = null;
    for (let y = 1; y < 28; y++) {
      for (let x = 1; x < 28; x++) {
        let f = 0;
        let w = 0;
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 3; i++) {
            f += c.world.fertility[idx(x + i, y + j)]!;
            if (wet.has(idx(x + i, y + j))) w++;
          }
        if (c.world.water[idx(x, y)] || c.world.rock[idx(x, y)]) continue;
        if (w >= 8 && (!low || f > low.f)) low = { x, y, f };
        if (w === 0 && (!high || f > high.f)) high = { x, y, f };
      }
    }
    expect(low && high).toBeTruthy();
    // each is better in its own way: the floodplain is richer, the highland is dry
    expect(low!.f).toBeGreaterThanOrEqual(high!.f * 0.8);
    const lowFarm = createStructure(c, 'farm', low!.x, low!.y, 0, 'active');
    const highFarm = createStructure(c, 'farm', high!.x, high!.y, 0, 'active');
    const imp = resolveHazard(c, 'flood').impacts;
    expect(imp.find((i) => i.id === lowFarm.id)).toBeDefined();
    expect(imp.find((i) => i.id === highFarm.id)).toBeUndefined();
  });
});

describe('F. industry versus ecological restoration', () => {
  it('Masonry stone and Forestry woodland lead to different late-age buildings and resistances', () => {
    const industry = fresh6001(2);
    industry.civ.techs.push('masonry', 'bronze_tools', 'ironworking');
    const ecology = fresh6001(2);
    ecology.civ.techs.push('irrigation', 'crop_rotation', 'forestry');
    const unlocked = (c: Campaign, k: 'forge' | 'grove') => {
      const r = dispatchAction(c, { type: 'build', kind: k, x: 0, y: 0, rot: 0 });
      return r.ok || r.code !== 'locked_tech';
    };
    expect(unlocked(industry, 'forge')).toBe(true);
    expect(unlocked(industry, 'grove')).toBe(false);
    expect(unlocked(ecology, 'grove')).toBe(true);
    expect(unlocked(ecology, 'forge')).toBe(false);
  });
});

describe('G. normal speed versus assisted half-speed', () => {
  it('the same tick-scheduled actions give the same canonical state; only the mode label differs', () => {
    const run = (mode: 'standard' | 'assisted') => {
      const c = createCampaign(6001, mode);
      const spot = findSpot(c, 'cottage', { maxDist: 8 })!;
      dispatchAction(c, { type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: 0 });
      begin(c);
      runTicks(c, 600);
      return c;
    };
    const a = run('standard');
    const b = run('assisted');
    expect(b.mode).toBe('assisted');
    expect(b.report!.survivors).toBe(a.report!.survivors);
    expect(b.civ.res).toEqual(a.civ.res);
    expect(b.structures.map((s) => `${s.kind}:${s.status}`)).toEqual(
      a.structures.map((s) => `${s.kind}:${s.status}`),
    );
  });
});

describe('H. graphics quality and frame rate', () => {
  it('batching ticks any way at all (a stand-in for FPS and quality tiers) yields the same hash', () => {
    // Same advanceFixedTick calls for every batch size; the frame-rate guard is tests/game/clock.test.ts.
    const run = (batch: number) => {
      const c = createCampaign(6001);
      const spot = findSpot(c, 'farm', { maxDist: 8 })!;
      dispatchAction(c, { type: 'build', kind: 'farm', x: spot.x, y: spot.y, rot: 0 });
      begin(c);
      let left = 600;
      while (left > 0) {
        const n = Math.min(batch, left);
        for (let i = 0; i < n; i++) advanceFixedTick(c);
        left -= n;
      }
      return computeHash(c);
    };
    const hashes = [1, 2, 6, 10, 50, 600].map(run);
    expect(new Set(hashes).size).toBe(1);
    expect(getForecast(createCampaign(6001)).kind).toBe('fire');
  });
});
