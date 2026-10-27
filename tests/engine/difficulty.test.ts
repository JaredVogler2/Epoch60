import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  computeHash,
  createCampaign,
  dispatchAction,
  runTicks,
  deserialize,
  DIFFICULTY,
  getForecast,
  GREENVALE,
  replayCampaign,
  resolveHazard,
  serialize,
  transcriptOf,
  victoryFor,
} from '../../src/engine';
import type { Campaign, Difficulty } from '../../src/engine';
import { playCampaign } from '../../src/engine/ai/bots';
import { ROUTES } from '../../src/engine/ai/routes';
import { isStanding } from '../../src/engine/economy/modifiers';
import { createStructure } from '../../src/engine/economy/structures';

const make = (d: Difficulty, scenario = 'greenvale') => createCampaign(6001, 'standard', scenario, d);

describe('difficulty tiers change the world and the goal, never the rules', () => {
  it('shift the victory thresholds from the authored ones', () => {
    expect(victoryFor(GREENVALE, 'normal')).toEqual(GREENVALE.victory);
    expect(victoryFor(GREENVALE, 'gentle')).toEqual({ minSurvivors: 6, minHeritage: 1, minRetainedTechs: 2 });
    expect(victoryFor(GREENVALE, 'hard')).toEqual({ minSurvivors: 10, minHeritage: 1, minRetainedTechs: 4 });
  });

  it('scale every hazard: the same village faces more fire, flood, quake and ash on Hard than on Gentle', () => {
    for (const [scenario, epochs] of [
      ['greenvale', [0, 1, 2]],
      ['ashen', [2]],
    ] as const) {
      for (const e of epochs) {
        const area = (d: Difficulty) => {
          const c = make(d, scenario);
          c.epoch = e;
          createStructure(c, 'cottage', 14, 14, 0, 'active');
          const r = resolveHazard(c);
          return { area: r.area, damage: r.impacts.reduce((n, i) => n + i.damage, 0) };
        };
        const g = area('gentle');
        const n = area('normal');
        const h = area('hard');
        expect(g.area, `${scenario} e${e}`).toBeLessThanOrEqual(n.area);
        expect(n.area).toBeLessThanOrEqual(h.area);
        expect(g.damage + n.damage + h.damage).toBeGreaterThan(0);
        expect(h.area + h.damage).toBeGreaterThan(g.area + g.damage);
      }
    }
  });

  it('keeps the forecast identical to the resolution on every tier', () => {
    for (const d of ['gentle', 'normal', 'hard'] as const) {
      const c = make(d);
      createStructure(c, 'cottage', 14, 14, 0, 'active');
      const predicted = getForecast(c).predicted.cells;
      dispatchAction(c, { type: 'beginEpoch' });
      runTicks(c, 600);
      expect(c.report!.result.cells, d).toEqual(predicted);
    }
  });

  it('is remembered by saves and transcripts, and old saves default to Normal', () => {
    const c = make('hard');
    expect(deserialize(serialize(c)).difficulty).toBe('hard');
    const t = transcriptOf(c);
    expect(t.difficulty).toBe('hard');
    expect(replayCampaign(t).difficulty).toBe('hard');
    expect(computeHash(replayCampaign(t))).toBe(computeHash(c));
    // A save written before tiers existed has no field (and the hash of that older shape).
    const legacy = JSON.parse(serialize(createCampaign(6001))) as { campaign: Campaign; hash: string };
    delete (legacy.campaign as Partial<Campaign>).difficulty;
    legacy.hash = computeHash(legacy.campaign);
    expect(deserialize(JSON.stringify(legacy)).difficulty).toBe('normal');
  });

  it('every tier has a plain-language description and a distinct hazard scale', () => {
    const scales = Object.values(DIFFICULTY).map((d) => d.strengthPm);
    expect(new Set(scales).size).toBe(3);
    for (const d of Object.values(DIFFICULTY)) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.blurb.length).toBeGreaterThan(10);
    }
  });
});

describe('what the tuned routes make of each tier (seed 6001)', () => {
  const verdictOf = (name: 'engineers' | 'archivists', d: Difficulty) => {
    const c = make(d);
    playCampaign(c, ROUTES[name]!);
    return { c, v: c.report!.verdict! };
  };

  it('Archivists win on Normal and report the Hard thresholds on Hard', () => {
    const normal = verdictOf('archivists', 'normal');
    expect(normal.v.outcome).toBe('victory');
    const hard = verdictOf('archivists', 'hard');
    expect(hard.v.conditions.map((x) => x.need)).toEqual([10, 1, 4]);
  }, 60_000);

  it('Hard still has two ways in on Greenvale: Engineers keep a hearth above the flood, Archivists a seed vault', () => {
    const landmarks = (c: Campaign) =>
      c.structures
        .filter((s) => BUILDINGS[s.kind].heritage && isStanding(s) && s.originEpoch < c.epoch)
        .map((s) => s.kind);
    const eng = verdictOf('engineers', 'hard');
    const arc = verdictOf('archivists', 'hard');
    expect(eng.v.outcome).toBe('victory');
    expect(arc.v.outcome).toBe('victory');
    // Different landmarks: the engineers hold the hearth they lit above the flood, the archivists carry a vault and
    // move on. (Without Open Hands after the flood the engineers end one survivor short on this seed.)
    expect(landmarks(eng.c)).toEqual(['hearth']);
    expect(landmarks(arc.c)).toContain('seed_vault');
    expect(landmarks(arc.c)).not.toContain('hearth');
  }, 120_000);

  it('Gentle is no harder than Normal for the same plan', () => {
    const g = verdictOf('engineers', 'gentle');
    expect(g.v.conditions.map((x) => x.need)).toEqual([6, 1, 2]);
    expect(g.v.outcome).toBe('victory');
  }, 60_000);
});
