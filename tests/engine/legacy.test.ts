import { describe, expect, it } from 'vitest';
import {
  advanceFixedTick,
  cloneCampaign,
  collapseEpoch,
  computeHash,
  createCampaign,
  dispatchAction,
  runTicks,
  UNIT,
} from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { idx, inBounds } from '../../src/engine/world/query';
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
    // Seed 42: the wildfire burns out before the hearth, so only what is built in its path is struck.
    const deaths = (kind: 'farm' | 'cottage', pop: number) => {
      const c = fresh(42);
      begin(c);
      stock(c);
      createStructure(c, kind, 23, kind === 'farm' ? 16 : 20, 0, 'active');
      c.civ.pop = pop;
      runTicks(c, 600);
      const r = c.report!;
      expect(r.result.impacts.map((i) => `${i.kind}:${i.after}`)).toEqual([`${kind}:rubble`]);
      expect(r.survivors).toBe(r.survivorsBefore - r.deaths);
      return r.deaths;
    };
    expect(deaths('farm', 6)).toBe(0); // a field burns; everyone sleeps under the hearth's roof
    expect(deaths('cottage', 10)).toBe(3); // 55% of the cottage's 4 occupants, rounded up
    expect(deaths('cottage', 12)).toBe(3 + 1); // ...and 40% of the 2 sleeping outdoors

    // An ash winter with an empty larder starves everyone: the toll stops at the population.
    const w = createCampaign(42, 'standard', 'ashen');
    w.epoch = 2;
    stock(w);
    createStructure(w, 'cottage', 14, 14, 0, 'active');
    w.civ.pop = 12;
    begin(w);
    runTicks(w, 599);
    w.civ.res.food = 0;
    runTicks(w, 1);
    expect(w.report!.deaths).toBe(12);
    expect(w.report!.survivors).toBe(0);
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
    const scarBefore = c.world.scar[i]!;
    toInterregnum(c);
    expect(c.world.scar[i]!).toBeLessThan(scarBefore * 0.6);
    expect(c.world.fertility[i]!).toBeGreaterThanOrEqual(fertBefore);
    expect(c.world.forest[i]!).toBeGreaterThan(100);
  });

  it('a surviving seed vault reseeds the land and feeds the next founders', () => {
    // The same valley twice, except that in one of them the vault did not last the centuries.
    const valley = (vaultStands: boolean) => {
      const c = fresh();
      begin(c);
      stock(c);
      const h = c.world.anchors.hearth;
      const vault = createStructure(c, 'seed_vault', h.x - 3, h.y - 9, 0, 'active');
      runTicks(c, 600);
      expect(vault.status).toBe('active');
      if (!vaultStands) vault.status = 'rubble';
      toInterregnum(c);
      return { c, vault };
    };
    const kept = valley(true);
    const fell = valley(false);
    // Land within 7 cells of the vault (but not under it) is 140 more fertile, up to 950.
    const v = kept.vault;
    const near: number[] = [];
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const under = dx >= 0 && dx < v.w && dy >= 0 && dy < v.h;
        if (dx * dx + dy * dy > 49 || under || !inBounds(v.x + dx, v.y + dy)) continue;
        const i = idx(v.x + dx, v.y + dy);
        if (!kept.c.world.water[i] && !kept.c.world.rock[i]) near.push(i);
      }
    }
    expect(near.length).toBeGreaterThan(50);
    expect(near.map((i) => kept.c.world.fertility[i])).toEqual(
      near.map((i) => Math.min(950, fell.c.world.fertility[i]! + 140)),
    );
    // Its grain feeds the founders whatever tradition they adopt.
    for (const { id } of kept.c.lineage.interregnum!.traditions) {
      const a = cloneCampaign(kept.c);
      const b = cloneCampaign(fell.c);
      expect(found(a, 0, id).ok).toBe(true);
      expect(found(b, 0, id).ok).toBe(true);
      expect(a.civ.res.food - b.civ.res.food, id).toBe(10 * UNIT);
    }
  });

  it('an excavated seed vault reseeds the fields around it and its grain feeds the next founders', () => {
    const c = fresh();
    begin(c);
    stock(c);
    const f = c.world.anchors.fireOrigin;
    const vault = createStructure(c, 'seed_vault', f.x - 4, f.y - 1, 0, 'active');
    vault.bonus.fire = -900; // a vault that burns, for this test
    runTicks(c, 600);
    expect(vault.status).toBe('rubble');
    toInterregnum(c);
    const undug = cloneCampaign(c);
    const before = c.world.fertility.slice();
    expect(act(c, { type: 'excavate', id: vault.id }).ok).toBe(true);
    // Fields 4 cells before to 5 past the vault gain 120 fertility (up to 950); nothing else changes.
    const reseeded = (i: number) => {
      const dx = (i % c.world.w) - vault.x;
      const dy = Math.floor(i / c.world.w) - vault.y;
      return dx >= -4 && dx <= 5 && dy >= -4 && dy <= 5 && !c.world.water[i] && !c.world.rock[i];
    };
    expect(before.filter((_, i) => reseeded(i)).length).toBeGreaterThan(50);
    expect(c.world.fertility).toEqual(before.map((v, i) => (reseeded(i) ? Math.min(950, v + 120) : v)));
    // Its grain feeds the founders whatever tradition they adopt.
    for (const { id } of c.lineage.interregnum!.traditions) {
      const dug = cloneCampaign(c);
      const left = cloneCampaign(undug);
      expect(found(dug, 0, id).ok).toBe(true);
      expect(found(left, 0, id).ok).toBe(true);
      expect(dug.civ.res.food - left.civ.res.food, id).toBe(12 * UNIT);
    }
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

describe('founding never soft-locks', () => {
  it('offers sites even when the last hearth stood on a river bank', () => {
    const c = fresh();
    scriptedEpoch(c);
    act(c, { type: 'continue' });
    expect(c.phase).toBe('DEBRIEF');
    // The old hearth sat where the cell diagonally up-left of it is open river.
    const hearth = c.structures.find((s) => s.kind === 'hearth')!;
    hearth.x = 15;
    hearth.y = 21;
    act(c, { type: 'continue' });
    expect(c.phase).toBe('INTERREGNUM');
    const sites = c.lineage.interregnum!.sites;
    expect(sites.length).toBeGreaterThan(0);
    expect(found(c, 0).ok).toBe(true);
    expect(c.phase).toBe('PREPARE');
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

describe('collapse presentation data', () => {
  it('records the pre-collapse state of every hazard cell without affecting the simulation', () => {
    const c = fresh();
    begin(c);
    stock(c);
    const forestBefore = c.world.forest.slice();
    const scarBefore = c.world.scar.slice();
    runTicks(c, 600);
    const r = c.report!;
    expect(r.before.cells).toHaveLength(r.result.cells.length);
    for (let k = 0; k < r.before.cells.length; k++) {
      const i = r.before.cells[k]!;
      expect(r.before.forest[k]).toBe(forestBefore[i]);
      expect(r.before.scar[k]).toBe(scarBefore[i]);
    }
    // The world itself is already in its final (scarred) state when the presentation starts.
    const k = r.before.cells.findIndex((i) => forestBefore[i]! > 300);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(c.world.forest[r.before.cells[k]!]).toBeLessThan(forestBefore[r.before.cells[k]!]!);
  });
});
