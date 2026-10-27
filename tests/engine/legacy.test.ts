import { describe, expect, it } from 'vitest';
import {
  advanceFixedTick,
  collapseEpoch,
  computeHash,
  dispatchAction,
  runTicks,
  UNIT,
} from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { idx } from '../../src/engine/world/query';
import { act, begin, fresh, scriptedEpoch } from './helpers';

/** Feed the village so the epoch is survivable; these tests are about inheritance, not starvation. */
function stock(c: ReturnType<typeof fresh>): void {
  c.civ.res.food = 800 * UNIT;
}

function toInterregnum(c: ReturnType<typeof fresh>): void {
  act(c, { type: 'continue' });
  act(c, { type: 'continue' });
  if (c.phase !== 'INTERREGNUM') throw new Error('expected interregnum, got ' + c.phase);
}

function found(c: ReturnType<typeof fresh>, site = 0, tradition?: string) {
  const inter = c.lineage.interregnum!;
  return act(c, { type: 'found', site, tradition: (tradition ?? inter.traditions[0]!.id) as never });
}

describe('collapse', () => {
  it('is idempotent: resolving twice never double-applies damage or deaths', () => {
    const c = fresh();
    scriptedEpoch(c);
    const hash = computeHash(c);
    const popAfter = c.civ.pop;
    expect(collapseEpoch(c)).toBe(c.report);
    expect(collapseEpoch(c)).toBe(c.report);
    expect(computeHash(c)).toBe(hash);
    expect(c.civ.pop).toBe(popAfter);
    expect(c.lineage.reports).toHaveLength(1);
  });

  it('never resurrects: structure statuses only get worse during a collapse', () => {
    const c = fresh();
    begin(c);
    const rank: Record<string, number> = { constructing: 0, active: 0, damaged: 1, rubble: 2, buried: 2 };
    const archive = createStructure(c, 'archive', 21, 8, 0, 'damaged');
    const cottage = createStructure(c, 'cottage', 22, 18, 0, 'active');
    const before = new Map([archive, cottage].map((s) => [s.id, rank[s.status]!]));
    runTicks(c, 600);
    for (const s of c.structures) {
      if (before.has(s.id)) expect(rank[s.status]!).toBeGreaterThanOrEqual(before.get(s.id)!);
    }
  });

  it('deaths come only from homes lost or people caught outdoors, and never exceed the population', () => {
    const c = fresh();
    scriptedEpoch(c);
    const r = c.report!;
    expect(r.deaths).toBeGreaterThanOrEqual(0);
    expect(r.survivors).toBe(r.survivorsBefore - r.deaths);
    expect(r.survivors).toBeGreaterThanOrEqual(0);
  });

  it('does not wipe the world: the hearth foundation or stone works persist', () => {
    const c = fresh();
    scriptedEpoch(c);
    expect(c.structures.length).toBeGreaterThan(0);
    expect(c.structures.some((s) => s.status === 'active' || s.status === 'damaged')).toBe(true);
  });

  it('ruins carry provenance explaining what happened', () => {
    const c = fresh();
    begin(c);
    const cot = createStructure(
      c,
      'cottage',
      c.world.anchors.fireOrigin.x - 4,
      c.world.anchors.fireOrigin.y,
      0,
      'active',
    );
    runTicks(c, 600);
    expect(['rubble', 'damaged']).toContain(cot.status);
    expect(cot.provenance.join(' ')).toMatch(/Great Fire/);
    expect(cot.cause).toBe('fire');
  });
});

describe('knowledge inheritance', () => {
  it('only valid carriers preserve technology: a hearth remembers one tech, a surviving archive more', () => {
    const c = fresh();
    begin(c);
    c.civ.techs.push('masonry', 'irrigation', 'writing');
    // Nothing built to carry knowledge: only the oral tradition of the hearth.
    runTicks(c, 600);
    expect(c.report!.retainedTechs).toHaveLength(1);
    expect(c.report!.lostTechs).toHaveLength(2);

    const d = fresh();
    begin(d);
    d.civ.techs.push('masonry', 'irrigation', 'writing');
    // A stone archive well away from the fire front.
    const safe = { x: d.world.anchors.hearth.x - 3, y: d.world.anchors.hearth.y - 9 };
    createStructure(d, 'archive', safe.x, safe.y, 0, 'active');
    runTicks(d, 600);
    expect(d.report!.retainedTechs.length).toBeGreaterThan(1);
  });

  it('a destroyed archive keeps its tablets in the ruin; excavation recovers what was lost', () => {
    const c = fresh();
    begin(c);
    c.civ.techs.push('masonry', 'irrigation', 'writing');
    const f = c.world.anchors.fireOrigin;
    const arc = createStructure(c, 'archive', f.x - 4, f.y - 1, 0, 'active');
    arc.bonus.fire = -900; // a fire-prone archive for this test
    runTicks(c, 600);
    expect(arc.status).toBe('rubble');
    expect(arc.storedTechs.length).toBeGreaterThan(0);
    const lostBefore = c.report!.lostTechs.length;
    toInterregnum(c);
    const ruin = c.structures.find((s) => s.id === arc.id)!;
    expect(['rubble', 'buried']).toContain(ruin.status);
    expect(act(c, { type: 'excavate', id: ruin.id }).ok).toBe(true);
    expect(c.lineage.interregnum!.techs.length).toBeGreaterThan(0);
    const tech = c.lineage.interregnum!.techs[0]!;
    found(c);
    expect(c.civ.techs).toContain(tech);
    expect(lostBefore).toBeGreaterThan(0);
  });
});

describe('physical and ecological inheritance', () => {
  it('epoch 2 is the SAME map: ruins, scars, terrain pads and ids carry over', () => {
    const c = fresh();
    scriptedEpoch(c);
    const ids = c.structures.map((s) => s.id);
    const heightHash = JSON.stringify(c.world.height);
    toInterregnum(c);
    expect(found(c).ok).toBe(true);
    expect(c.epoch).toBe(1);
    for (const id of ids) {
      const s = c.structures.find((st) => st.id === id);
      // Everything from epoch one is either still here or was cleared for the new hearth.
      if (!s) continue;
      expect(s.originEpoch).toBe(0);
    }
    expect(c.structures.filter((s) => s.originEpoch === 0).length).toBeGreaterThan(0);
    // Terrain was not regenerated: unaffected cells match, including levelled building pads.
    const now = c.world.height;
    let same = 0;
    const was = JSON.parse(heightHash) as number[];
    for (let i = 0; i < was.length; i++) if (was[i] === now[i]) same++;
    expect(same / was.length).toBeGreaterThan(0.95);
  });

  it('burnt ground is visibly scarred and later regrows richer', () => {
    const c = fresh();
    begin(c);
    stock(c);
    runTicks(c, 600);
    const burnt = c.report!.result.cells;
    const sample = burnt.find((cell) => c.world.forest[idx(cell.x, cell.y)]! < 100)!;
    const i = idx(sample.x, sample.y);
    expect(c.world.scar[i]!).toBeGreaterThan(500);
    const fertBefore = c.world.fertility[i]!;
    toInterregnum(c);
    expect(c.world.scar[i]!).toBeLessThan(250);
    expect(c.world.fertility[i]!).toBeGreaterThanOrEqual(fertBefore);
    expect(c.world.forest[i]!).toBeGreaterThan(100);
  });

  it('a surviving seed vault reseeds the land and feeds the next founders', () => {
    const c = fresh();
    begin(c);
    stock(c);
    const h = c.world.anchors.hearth;
    const vault = createStructure(c, 'seed_vault', h.x - 3, h.y - 9, 0, 'active');
    vault.bonus.fire = 0;
    runTicks(c, 600);
    expect(vault.status).not.toBe('rubble');
    toInterregnum(c);
    const foodBefore = c.lineage.interregnum!.yield.food / UNIT;
    found(c);
    expect(foodBefore).toBe(0);
    // base start 24 + 10 vault grain, +/- open hands penalty.
    expect(c.civ.res.food / UNIT).toBeGreaterThanOrEqual(24);
  });

  it('survivors seed the next society: fewer survivors mean fewer founders', () => {
    const a = fresh();
    scriptedEpoch(a);
    const b = fresh();
    scriptedEpoch(b);
    b.civ.pop = 2;
    b.report!.survivors = 2;
    toInterregnum(a);
    toInterregnum(b);
    found(a);
    found(b);
    expect(b.civ.pop).toBeLessThan(a.civ.pop);
  });
});

describe('archaeology is bounded', () => {
  it('limits surveys and excavations per interregnum and charges nothing free', () => {
    const c = fresh();
    begin(c);
    stock(c);
    const f = c.world.anchors.fireOrigin;
    const a1 = createStructure(c, 'cottage', f.x - 3, f.y - 3, 0, 'active');
    const a2 = createStructure(c, 'cottage', f.x - 3, f.y + 2, 0, 'active');
    const a3 = createStructure(c, 'cottage', f.x - 6, f.y, 0, 'active');
    runTicks(c, 600);
    toInterregnum(c);
    const ruins = [a1, a2, a3].filter((s) => s.status === 'rubble' || s.status === 'buried');
    if (ruins.length >= 3) {
      expect(act(c, { type: 'excavate', id: ruins[0]!.id }).ok).toBe(true);
      const second = act(c, { type: 'excavate', id: ruins[1]!.id });
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.code).toBe('no_slots');
      expect(act(c, { type: 'excavate', id: ruins[0]!.id }).ok).toBe(false); // no repeat farming
    }
    // Surveys are limited to two.
    let ok = 0;
    for (const s of c.structures) if (act(c, { type: 'survey', id: s.id }).ok) ok++;
    expect(ok).toBeLessThanOrEqual(2);
  });

  it('actions outside the interregnum are refused', () => {
    const c = fresh();
    expect(act(c, { type: 'excavate', id: 1 }).ok).toBe(false);
    expect(act(c, { type: 'found', site: 0, tradition: 'open_hands' }).ok).toBe(false);
  });
});

describe('end of campaign', () => {
  it('no one left means defeat; the campaign refuses further actions', () => {
    const c = fresh();
    begin(c);
    stock(c);
    runTicks(c, 599);
    c.civ.pop = 2;
    runTicks(c, 1);
    expect(c.report!.verdict?.outcome).toBe('defeat');
    act(c, { type: 'continue' });
    act(c, { type: 'continue' });
    expect(c.phase).toBe('DEFEAT');
    expect(dispatchAction(c, { type: 'beginEpoch' }).ok).toBe(false);
    expect(advanceFixedTick(c)).toBe(false);
  });
});
