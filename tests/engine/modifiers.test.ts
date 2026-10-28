import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MODIFIERS,
  TRADITIONS,
  checkModifiers,
  computeHash,
  createCampaign,
  deserialize,
  getForecast,
  hazardStrength,
  mods,
  quakeIntensityAt,
  replayCampaign,
  resolveHazard,
  scaledStrength,
  serialize,
  transcriptOf,
} from '../../src/engine';
import type { Campaign, ModifierId, Transcript } from '../../src/engine';
import { hashValue } from '../../src/engine/core/hash';
import {
  FAULT_OFFSET,
  FLOODPLAIN_FERTILITY,
  FLOODPLAIN_REACH,
  LIBRARY_TECHS,
} from '../../src/engine/content/modifiers';
import { findSites } from '../../src/engine/legacy/inheritance';
import { idx } from '../../src/engine/world/query';
import { act, begin, runTicks, scriptedEpoch } from './helpers';

const SEED = 6001;
const make = (m: ModifierId[], scenario = 'greenvale', seed = SEED) =>
  createCampaign(seed, 'standard', scenario, 'normal', m);
const flood = (c: Campaign) => resolveHazard({ ...c, epoch: 1 }, 'flood', 200);

describe('challenges: which sets are allowed', () => {
  it('come back in canonical order; unknown, repeated, clashing, unsuited or too many are refused', () => {
    expect(checkModifiers(['buried_library', 'soft_rock'], 'greenvale')).toEqual({
      ok: true,
      ids: ['soft_rock', 'buried_library'],
    });
    expect(checkModifiers([], 'greenvale')).toEqual({ ok: true, ids: [] });
    expect(checkModifiers(['tidal_wave'], 'greenvale').ok).toBe(false);
    expect(checkModifiers(['__proto__'], 'greenvale').ok).toBe(false);
    expect(checkModifiers(['soft_rock', 'soft_rock'], 'greenvale').ok).toBe(false);
    expect(checkModifiers(['fertile_floodplain', 'dry_summers'], 'greenvale').ok).toBe(false);
    // No quake comes in the Ashen Winter, so the quake challenges do not suit it.
    expect(checkModifiers(['soft_rock'], 'ashen').ok).toBe(false);
    expect(checkModifiers(['fractured_fault'], 'ashen').ok).toBe(false);
    expect(
      checkModifiers(['soft_rock', 'fractured_fault', 'overcrowded_refuge', 'buried_library'], 'greenvale')
        .ok,
    ).toBe(false);
    expect(() => make(['dry_summers', 'fertile_floodplain'])).toThrow(/cannot be combined/);
  });

  it('a standard lineage carries no challenge field at all, so it hashes exactly as before', () => {
    const c = createCampaign(SEED);
    expect('modifiers' in c).toBe(false);
    expect(computeHash(make([]))).toBe(computeHash(c));
    // The hash really does read the field when it is there.
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 1, modifiers: [] }));
  });
});

describe('challenges: each changes what it says', () => {
  const base = createCampaign(SEED);

  it('Fertile Floodplain: richer soil near the river only, and a higher flood', () => {
    const c = make(['fertile_floodplain']);
    let near = 0;
    for (let y = 0; y < c.world.h; y++)
      for (let x = 0; x < c.world.w; x++) {
        const i = idx(x, y, c.world.w);
        const inReach =
          !c.world.water[i] &&
          !c.world.rock[i] &&
          Math.abs(x * 100 - c.world.riverCenter[y]!.x) <= FLOODPLAIN_REACH * 100;
        const want = inReach
          ? Math.min(950, base.world.fertility[i]! + FLOODPLAIN_FERTILITY)
          : base.world.fertility[i];
        // The founding hearth's pad is levelled in both, so its cells compare like any other.
        expect(c.world.fertility[i]).toBe(want);
        if (inReach && c.world.fertility[i]! > base.world.fertility[i]!) near++;
      }
    expect(near).toBeGreaterThan(200);
    expect(hazardStrength(c, 'flood', 200)).toBe(260);
    expect(flood(c).cells.length).toBeGreaterThan(flood(base).cells.length);
  });

  it('Dry Summers: a fiercer fire, a weaker flood and thinner harvests', () => {
    const c = make(['dry_summers']);
    expect(hazardStrength(c, 'fire', 330)).toBe(429);
    expect(hazardStrength(c, 'flood', 200)).toBe(160);
    expect(resolveHazard(c).cells.length).toBeGreaterThan(resolveHazard(base).cells.length);
    expect(flood(c).cells.length).toBeLessThan(flood(base).cells.length);
    expect(mods(c).foodRate).toBe(-150);
    expect(mods(base).foodRate).toBe(0);
  });

  it('Soft Rock: half as much stone again in every deposit, faster quarries, a harder quake', () => {
    const c = make(['soft_rock']);
    for (let i = 0; i < c.world.rock.length; i++)
      expect(c.world.rock[i]).toBe(Math.min(1000, Math.round((base.world.rock[i]! * 1500) / 1000)));
    expect(c.world.rock.reduce((a, b) => a + b, 0)).toBeGreaterThan(
      base.world.rock.reduce((a, b) => a + b, 0),
    );
    expect(mods(c).stoneRate).toBe(250);
    expect(hazardStrength(c, 'quake', 940)).toBe(1128);
  });

  it('Fractured Fault: the epicentre beside the first hearth, so the village shakes far harder', () => {
    const c = make(['fractured_fault']);
    const h = c.world.anchors.hearth;
    expect(c.world.anchors.quakeEpicenter).toEqual({ x: h.x + FAULT_OFFSET.dx, y: h.y + FAULT_OFFSET.dy });
    const atHearth = (x: Campaign) => quakeIntensityAt(x, h.x, h.y, 940);
    expect(atHearth(c)).toBeGreaterThan(atHearth(base) * 2);
  });

  it('Overcrowded Refuge: four more people and ten less food, at the start and at every founding', () => {
    const c = make(['overcrowded_refuge']);
    expect(c.civ.pop).toBe(base.civ.pop + 4);
    expect(c.civ.labor.total).toBe(c.civ.pop);
    expect(c.civ.res.food).toBe(base.civ.res.food - 10_000);
    // Through the first catastrophe and into the second age, against the same lineage without refugees.
    const found = (x: Campaign) => {
      scriptedEpoch(x);
      act(x, { type: 'continue' });
      act(x, { type: 'continue' });
      const tradition = x.lineage.interregnum!.traditions.find((t) => !TRADITIONS[t.id].mods.startPop)!.id;
      expect(act(x, { type: 'found', site: 0, tradition }).ok).toBe(true);
      return x;
    };
    const a = found(make(['overcrowded_refuge']));
    const b = found(createCampaign(SEED));
    const expected = (x: Campaign, extra: number) =>
      Math.min(16, Math.max(5, Math.round(8 * 0.5 + x.lineage.reports[0]!.survivors * 0.7) + extra));
    expect(a.civ.pop).toBe(expected(a, 4));
    expect(b.civ.pop).toBe(expected(b, 0));
  });

  it('Buried Library: an Archive older than the founders, west of the hearth, whose tablets reach the next age', () => {
    const c = make(['buried_library']);
    const lib = c.structures.find((s) => s.originEpoch < 0)!;
    expect(lib).toMatchObject({ kind: 'archive', status: 'buried', burial: 3, storedTechs: LIBRARY_TECHS });
    expect(lib.x + 1).toBeLessThan(c.world.anchors.hearth.x);
    for (let y = lib.y; y < lib.y + lib.h; y++)
      for (let x = lib.x; x < lib.x + lib.w; x++) {
        const i = idx(x, y, c.world.w);
        expect([c.world.water[i], c.world.rock[i], c.world.occ[i]]).toEqual([0, 0, lib.id]);
      }
    expect(c.structures.find((s) => s.kind === 'hearth')!.id).toBe(1);
    // No hazard of the first age strikes a ruin, and the dig between ages brings the tablets in.
    scriptedEpoch(c);
    act(c, { type: 'continue' });
    act(c, { type: 'continue' });
    expect(c.phase).toBe('INTERREGNUM');
    expect(act(c, { type: 'survey', id: lib.id }).ok).toBe(true);
    expect(act(c, { type: 'excavate', id: lib.id }).ok).toBe(true);
    const tradition = c.lineage.interregnum!.traditions[0]!.id;
    expect(act(c, { type: 'found', site: 0, tradition }).ok).toBe(true);
    for (const t of LIBRARY_TECHS) expect(c.civ.techs).toContain(t);
    // Its people were not this lineage's grandparents.
    expect(c.lineage.feats.map((f) => f.id)).not.toContain('grandparents_library');
  });

  it('every valley of the first 120 seeds has room for the library, and keeps the fault inside the map', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const c = make(['fractured_fault', 'buried_library'], 'greenvale', seed);
      expect(
        c.structures.some((s) => s.originEpoch < 0),
        `seed ${seed}`,
      ).toBe(true);
      const e = c.world.anchors.quakeEpicenter;
      expect(e.x >= 4 && e.x <= c.world.w - 4 && e.y >= 4 && e.y <= c.world.h - 4).toBe(true);
    }
  });
});

describe('challenges: one rule for every caller, and kept through replays and saves', () => {
  it('the forecast, the resolution and the founding sites all use the challenged strength', () => {
    const c = make(['dry_summers']);
    expect(getForecast(c).predicted.cells).toEqual(resolveHazard(c).cells);
    expect(hazardStrength(createCampaign(SEED), 'fire', 330)).toBe(scaledStrength('normal', 330));
    const hard = createCampaign(SEED, 'standard', 'greenvale', 'hard', ['dry_summers']);
    expect(hazardStrength(hard, 'fire', 330)).toBe(Math.round((scaledStrength('hard', 330) * 1300) / 1000));
  });

  it('the founding sites weigh the next quake at the challenged strength', () => {
    const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as Transcript;
    const k = t.actions.findIndex((a) => a.action.type === 'found' && a.epoch === 1);
    const c = replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
    expect([c.phase, c.epoch]).toEqual(['INTERREGNUM', 1]);
    const soft: Campaign = { ...c, modifiers: ['soft_rock'] };
    const strength = hazardStrength(soft, 'quake', 940);
    const reach = new Map(
      resolveHazard({ ...soft, epoch: 2 }, 'quake', 940).cells.map((q) => [
        idx(q.x, q.y, c.world.w),
        q.intensity,
      ]),
    );
    const sites = findSites(soft);
    expect(sites.length).toBeGreaterThan(1);
    for (const site of sites) {
      let r = quakeIntensityAt(soft, site.x, site.y, strength);
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        r = Math.max(r, reach.get(idx(site.x + dx, site.y + dy, c.world.w)) ?? 0);
      expect(site.risk, site.label).toBe(r);
    }
    const plain = findSites(c);
    expect(sites.some((s) => s.risk > (plain.find((p) => p.x === s.x && p.y === s.y)?.risk ?? 1000))).toBe(
      true,
    );
  });

  it('a transcript replays the same lineage, challenges and all, and a save keeps them', () => {
    const c = make(['soft_rock', 'buried_library']);
    begin(c);
    runTicks(c, 120);
    const t = transcriptOf(c);
    expect(t.modifiers).toEqual(['soft_rock', 'buried_library']);
    expect(computeHash(replayCampaign(t))).toBe(t.finalHash);
    // The same actions without the challenges are a different lineage.
    expect(computeHash(replayCampaign({ ...t, modifiers: undefined }))).not.toBe(t.finalHash);
    const back = deserialize(serialize(c));
    expect(back.modifiers).toEqual(['soft_rock', 'buried_library']);
    expect(computeHash(back)).toBe(computeHash(c));
    expect('modifiers' in transcriptOf(createCampaign(SEED))).toBe(false);
  });

  it('a save naming challenges this build cannot run as written is refused, not trimmed', () => {
    const forged = (m: unknown) => {
      const c = make(['soft_rock']) as unknown as { modifiers: unknown };
      c.modifiers = m;
      const file = JSON.parse(serialize(c as unknown as Campaign)) as { hash: string; campaign: Campaign };
      file.hash = computeHash(file.campaign);
      return JSON.stringify(file);
    };
    expect(() => deserialize(forged(['soft_rock']))).not.toThrow();
    expect(() => deserialize(forged(['tidal_wave']))).toThrow(/challenges/);
    expect(() => deserialize(forged([]))).toThrow(/challenges/);
    expect(() => deserialize(forged(['buried_library', 'soft_rock']))).toThrow(/challenges/);
    expect(() => deserialize(forged('soft_rock'))).toThrow(/challenges/);
  });

  it('every challenge says what it changes', () => {
    for (const d of Object.values(MODIFIERS)) {
      expect(d.effects.length).toBeGreaterThan(0);
      expect(d.summary.length).toBeGreaterThan(10);
    }
  });
});
