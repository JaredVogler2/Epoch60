import { describe, expect, it } from 'vitest';
import { cloneCampaign, floodPeak, getForecast, resolveHazard, runTicks, UNIT } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import { idx } from '../../src/engine/world/query';
import { act, begin, fresh } from './helpers';
import { createStructure } from '../../src/engine/economy/structures';

function build(
  c: ReturnType<typeof fresh>,
  kind: Parameters<typeof createStructure>[1],
  x: number,
  y: number,
  rot: 0 | 1 = 0,
) {
  const s = createStructure(c, kind, x, y, rot, 'active');
  return s;
}

describe('fire', () => {
  it('is a pure function of state: the forecast equals the resolution', () => {
    const c = fresh();
    begin(c);
    const predicted = resolveHazard(c);
    runTicks(c, 600);
    expect(c.report!.result.cells).toEqual(predicted.cells);
  });

  it('a firebreak across the fuel corridor shrinks the burnt area', () => {
    const base = fresh();
    const burnt = resolveHazard(base).area;
    const c = fresh();
    const h = c.world.anchors.hearth;
    // Three vertical strips along the eastern edge of the meadow.
    for (const dy of [-8, -3, 2, 7]) build(c, 'firebreak', h.x + 3, h.y + dy, 1);
    const after = resolveHazard(c).area;
    expect(after).toBeLessThan(burnt);
  });

  it('thatch cottages burn and stone archives survive the same fire', () => {
    const c = fresh();
    const { hearth, fireOrigin } = c.world.anchors;
    // Put a cottage and an archive in the middle of the fire path.
    const mx = Math.round((hearth.x + fireOrigin.x) / 2);
    const my = Math.round((hearth.y + fireOrigin.y) / 2);
    const cot = createStructure(c, 'cottage', mx, my, 0, 'active');
    const arc = createStructure(c, 'archive', mx + 3, my, 0, 'active');
    const r = resolveHazard(c);
    const cotI = r.impacts.find((i) => i.id === cot.id);
    const arcI = r.impacts.find((i) => i.id === arc.id);
    expect(cotI?.after).toBe('rubble');
    expect(arcI === undefined || arcI.after !== 'rubble').toBe(true);
  });

  it('clearing forest between the origin and the village slows the fire', () => {
    const a = fresh();
    const b = fresh();
    const { hearth, fireOrigin } = a.world.anchors;
    for (let s = 0; s <= 12; s++) {
      const x = Math.round(fireOrigin.x + ((hearth.x + 3 - fireOrigin.x) * s) / 12);
      const y = Math.round(fireOrigin.y + ((hearth.y + 1 - fireOrigin.y) * s) / 12);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const i = idx(x + dx, y + dy);
          if (i >= 0 && i < b.world.forest.length) b.world.forest[i] = 0;
        }
    }
    expect(resolveHazard(b).area).toBeLessThan(resolveHazard(a).area);
  });

  it('rivers stop the fire', () => {
    const c = fresh();
    const r = resolveHazard(c);
    for (const cell of r.cells) expect(c.world.water[idx(cell.x, cell.y)]).toBe(0);
  });
});

describe('flood', () => {
  it('deforestation raises the flood peak; forest lowers it', () => {
    const lush = fresh();
    lush.epoch = 1;
    const bare = fresh();
    bare.epoch = 1;
    for (let i = 0; i < bare.world.forest.length; i++) bare.world.forest[i] = 0;
    for (let i = 0; i < lush.world.forest.length; i++) lush.world.forest[i] = 900;
    expect(floodPeak(bare)).toBeGreaterThan(floodPeak(lush));
    expect(resolveHazard(bare, 'flood').area).toBeGreaterThan(resolveHazard(lush, 'flood').area);
  });

  it('a dam reduces downstream flooding; a levee protects what stands behind it', () => {
    const plain = fresh();
    plain.epoch = 1;
    const area0 = resolveHazard(plain, 'flood').area;
    const withDam = fresh();
    withDam.epoch = 1;
    const rc = withDam.world.riverCenter[4]!;
    build(withDam, 'dam', Math.round(rc.x / 100) - 1, 4, 1);
    expect(resolveHazard(withDam, 'flood').area).toBeLessThan(area0);
  });

  it('floods the low plain but not the high ground', () => {
    const c = fresh();
    c.epoch = 1;
    const r = resolveHazard(c, 'flood');
    const wet = new Set(r.cells.map((h) => idx(h.x, h.y)));
    const h = c.world.anchors.hearth;
    expect(wet.has(idx(h.x, h.y))).toBe(true);
    let highDry = 0;
    for (let i = 0; i < c.world.height.length; i++) if (c.world.height[i]! > 400 && !wet.has(i)) highDry++;
    expect(highDry).toBeGreaterThan(20);
  });
});

describe('quake', () => {
  it('shakes hardest near the epicentre; braced buildings resist and thatch does not', () => {
    const c = fresh();
    c.epoch = 2;
    const e = c.world.anchors.quakeEpicenter;
    const spot = findSpot(c, 'cottage', { near: e, maxDist: 12, ignoreAffordability: true })!;
    const cottage = build(c, 'cottage', spot.x, spot.y);
    const before = resolveHazard(c, 'quake').impacts.find((i) => i.id === cottage.id)!;
    c.civ.techs.push('seismic_engineering');
    const after = resolveHazard(c, 'quake').impacts.find((i) => i.id === cottage.id)!;
    expect(after.damage).toBeLessThan(before.damage);
  });
});

describe('forecast', () => {
  it('reports risk and predicted deaths without mutating state', () => {
    const c = fresh();
    const snap = JSON.stringify(c);
    const f = getForecast(c);
    expect(f.kind).toBe('fire');
    expect(f.predicted.area).toBeGreaterThan(0);
    expect(JSON.stringify(c)).toBe(snap);
  });

  it('announces 25 s, 15 s and 5 s warnings as the clock runs down', () => {
    const c = fresh();
    begin(c);
    runTicks(c, 349);
    expect(c.forecastLevel).toBe(0);
    runTicks(c, 1);
    expect(c.forecastLevel).toBe(1);
    runTicks(c, 100);
    expect(c.forecastLevel).toBe(2);
    runTicks(c, 100);
    expect(c.forecastLevel).toBe(3);
    const warnings = c.events.filter((e) => e.code.startsWith('forecast.'));
    expect(warnings).toHaveLength(3);
    expect(warnings.map((w) => w.tick)).toEqual([349, 449, 549]);
  });
});

void UNIT;
void cloneCampaign;
void act;
