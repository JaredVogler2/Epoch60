import { describe, expect, it } from 'vitest';
import { checkPlacement, dispatchAction, getCatalog, resolveHazard, runTicks, UNIT } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { BUILDINGS } from '../../src/engine/content/buildings';
import { TECHS } from '../../src/engine/content/techs';
import { createStructure } from '../../src/engine/economy/structures';
import { idx } from '../../src/engine/world/query';
import { begin, fresh } from './helpers';
import type { BuildingKind, TechId } from '../../src/engine';

type C = ReturnType<typeof fresh>;

/** A campaign standing in a given epoch with some techs known and plenty of material. */
function stage(epoch: number, techs: TechId[] = []): C {
  const c = fresh();
  c.epoch = epoch;
  c.civ.techs.push(...techs);
  c.civ.res.timber = 400 * UNIT;
  c.civ.res.stone = 400 * UNIT;
  c.civ.res.food = 400 * UNIT;
  return c;
}

describe('ages and technology gate the catalog', () => {
  const cases: { kind: BuildingKind; epoch: number; tech: TechId }[] = [
    { kind: 'stone_house', epoch: 0, tech: 'masonry' },
    { kind: 'grove', epoch: 0, tech: 'forestry' },
    { kind: 'levee', epoch: 1, tech: 'hydrology' },
    { kind: 'dam', epoch: 1, tech: 'hydrology' },
    { kind: 'bridge', epoch: 1, tech: 'bronze_tools' },
    { kind: 'forge', epoch: 2, tech: 'ironworking' },
    { kind: 'retaining_wall', epoch: 2, tech: 'seismic_engineering' },
  ];
  for (const { kind, epoch, tech } of cases) {
    it(`${kind} needs age ${epoch} and ${tech}`, () => {
      const early = stage(Math.max(0, epoch - 1), [tech]);
      if (epoch > 0) {
        expect(getCatalog(early).find((e) => e.kind === kind)?.blocked?.code).toBe('locked_age');
      }
      const untaught = stage(epoch);
      expect(getCatalog(untaught).find((e) => e.kind === kind)?.blocked?.code).toBe('locked_tech');
      const r = checkPlacement(untaught, kind, 10, 10, 0);
      expect(r.ok).toBe(false);
      const ready = stage(epoch, [tech]);
      expect(getCatalog(ready).find((e) => e.kind === kind)?.blocked ?? null).toBeNull();
    });
  }

  it('every technology is researchable once its prerequisites are known, and not before', () => {
    for (const def of Object.values(TECHS)) {
      expect(def.enabled, def.id).toBe(true);
      const c = stage(0);
      c.civ.res.knowledge = 200 * UNIT;
      if (def.requires.length) {
        const early = dispatchAction(c, { type: 'research', tech: def.id });
        expect(early.ok, `${def.id} without prerequisites`).toBe(false);
        c.civ.techs.push(...def.requires);
      }
      const r = dispatchAction(c, { type: 'research', tech: def.id });
      expect(r.ok, def.id).toBe(true);
    }
  });
});

describe('flood engineering', () => {
  it('a levee ring keeps the hearth dry that the open valley floods', () => {
    const open = stage(1, ['hydrology']);
    const h = open.world.anchors.hearth;
    const wet = (c: C) => new Set(resolveHazard(c, 'flood').cells.map((cell) => idx(cell.x, cell.y)));
    expect(wet(open).has(idx(h.x, h.y))).toBe(true);

    const ringed = stage(1, ['hydrology']);
    // Four banks around the 2x2 hearth at (h.x..h.x+1, h.y..h.y+1).
    createStructure(ringed, 'levee', h.x - 2, h.y - 2, 0, 'active');
    createStructure(ringed, 'levee', h.x - 2, h.y + 3, 0, 'active');
    createStructure(ringed, 'levee', h.x - 3, h.y - 2, 1, 'active');
    createStructure(ringed, 'levee', h.x + 3, h.y - 2, 1, 'active');
    const dry = wet(ringed);
    expect(dry.has(idx(h.x, h.y))).toBe(false);
    expect(dry.size).toBeLessThan(wet(open).size);
  });

  it('a damaged levee holds back less than a sound one', () => {
    const sound = stage(1, ['hydrology']);
    const half = stage(1, ['hydrology']);
    const h = sound.world.anchors.hearth;
    for (const c of [sound, half]) {
      const st = (c === sound ? 'active' : 'damaged') as 'active' | 'damaged';
      createStructure(c, 'levee', h.x - 2, h.y - 2, 0, st);
      createStructure(c, 'levee', h.x - 2, h.y + 3, 0, st);
      createStructure(c, 'levee', h.x - 3, h.y - 2, 1, st);
      createStructure(c, 'levee', h.x + 3, h.y - 2, 1, st);
    }
    expect(resolveHazard(half, 'flood').area).toBeGreaterThan(resolveHazard(sound, 'flood').area);
  });

  it('a dam irrigates farms near it', () => {
    const food = (withDam: boolean): number => {
      const c = stage(1);
      const h = c.world.anchors.hearth;
      createStructure(c, 'farm', h.x + 3, h.y - 1, 0, 'active');
      if (withDam) {
        const rc = c.world.riverCenter[4]!;
        const d = createStructure(c, 'dam', Math.round(rc.x / 100) - 1, 4, 1, 'active');
        // Keep the test about irrigation: put the dam within reach of the farm.
        d.x = h.x + 3;
        d.y = h.y + 3;
      }
      c.civ.res.food = 0;
      begin(c);
      runTicks(c, 100);
      return c.civ.stats.foodMade;
    };
    expect(food(true)).toBeGreaterThan(food(false));
  });

  it('a grove slows water: the same flood leaves fewer cells wet', () => {
    const open = stage(1, ['forestry']);
    const h = open.world.anchors.hearth;
    const groved = stage(1, ['forestry']);
    for (const [dx, dy] of [
      [-4, -3],
      [-4, 0],
      [-4, 3],
      [-1, -4],
      [2, -4],
      [-1, 4],
      [2, 4],
      [5, -3],
      [5, 0],
      [5, 3],
    ] as [number, number][])
      createStructure(groved, 'grove', h.x + dx, h.y + dy, 0, 'active');
    expect(resolveHazard(groved, 'flood').area).toBeLessThan(resolveHazard(open, 'flood').area);
  });
});

describe('quake engineering', () => {
  it('a retaining wall steadies nearby buildings but not distant ones', () => {
    const c = stage(2, ['seismic_engineering']);
    const e = c.world.anchors.quakeEpicenter;
    const spot = findSpot(c, 'cottage', { near: e, maxDist: 14, ignoreAffordability: true })!;
    const near = createStructure(c, 'cottage', spot.x, spot.y, 0, 'active');
    const far = createStructure(c, 'cottage', 1, 1, 0, 'active');
    const damage = (id: number) => resolveHazard(c, 'quake').impacts.find((i) => i.id === id)?.damage ?? 0;
    const before = damage(near.id);
    const farBefore = damage(far.id);
    createStructure(c, 'retaining_wall', spot.x, spot.y + 3, 0, 'active');
    expect(damage(near.id)).toBeLessThan(before);
    expect(damage(far.id)).toBe(farBefore);
  });

  it('stone houses shelter more people and resist fire and quake better than cottages', () => {
    const c = stage(0, ['masonry']);
    const cot = createStructure(c, 'cottage', 5, 5, 0, 'active');
    const stone = createStructure(c, 'stone_house', 9, 5, 0, 'active');
    const m = BUILDINGS;
    expect(m.stone_house.housing).toBeGreaterThan(m.cottage.housing);
    expect(m.stone_house.resist.fire).toBeGreaterThan(m.cottage.resist.fire * 4);
    expect(m.stone_house.resist.quake).toBeGreaterThan(m.cottage.resist.quake);
    expect(cot.kind).not.toBe(stone.kind);
  });
});

describe('industry and ecology', () => {
  it('a staffed forge speeds a quarry within reach and taints nearby soil', () => {
    const run = (withForge: boolean) => {
      const c = stage(2, ['ironworking', 'masonry']);
      const q = findSpot(c, 'quarry', { maxDist: 30, ignoreAffordability: true })!;
      createStructure(c, 'quarry', q.x, q.y, 0, 'active');
      let fertAt = 0;
      if (withForge) {
        const f = createStructure(c, 'forge', q.x + 4, q.y, 0, 'active');
        fertAt = idx(f.x + 1, f.y + 1);
        c.world.fertility[fertAt] = 800;
      }
      c.civ.pop = 20;
      c.civ.res.timber = 300 * UNIT;
      begin(c);
      runTicks(c, 240);
      return { stone: c.civ.stats.stoneMade, fert: fertAt ? c.world.fertility[fertAt]! : 800 };
    };
    const base = run(false);
    const forged = run(true);
    expect(forged.stone).toBeGreaterThan(base.stone);
    expect(forged.fert).toBeLessThan(800);
  });

  it('a grove regrows woodland by itself', () => {
    const c = stage(0, ['forestry']);
    const h = c.world.anchors.hearth;
    const g = createStructure(c, 'grove', h.x + 4, h.y + 3, 0, 'active');
    const k = idx(g.x + 1, g.y + 1);
    c.world.forest[k] = 0;
    begin(c);
    runTicks(c, 300);
    expect(c.world.forest[k]!).toBeGreaterThan(100);
  });

  it('crop rotation stops the soil being mined and slowly restores it', () => {
    const soilAfter = (rotation: boolean) => {
      const c = stage(1, rotation ? ['irrigation', 'crop_rotation'] : ['irrigation']);
      const h = c.world.anchors.hearth;
      const f = createStructure(c, 'farm', h.x + 3, h.y - 1, 0, 'active');
      const k = idx(f.x + 1, f.y + 1);
      c.world.fertility[k] = 500;
      c.civ.pop = 30;
      begin(c);
      runTicks(c, 580);
      return c.world.fertility[k]!;
    };
    expect(soilAfter(false)).toBeLessThan(500);
    expect(soilAfter(true)).toBeGreaterThanOrEqual(500);
  });
});
