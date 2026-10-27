import { describe, expect, it } from 'vitest';
import { TRADITIONS, UNIT, createCampaign, dispatchAction, getScenario, runTicks } from '../../src/engine';
import type { Campaign, TraditionId } from '../../src/engine';

/** Play the current epoch out (well fed, nothing built) and step into the interregnum, if anyone survives. */
function toInterregnum(c: Campaign): boolean {
  c.civ.res.food = 900 * UNIT;
  if (c.phase === 'PREPARE') dispatchAction(c, { type: 'beginEpoch' });
  runTicks(c, 700);
  for (let i = 0; i < 3 && c.phase !== 'INTERREGNUM'; i++) dispatchAction(c, { type: 'continue' });
  return c.phase === 'INTERREGNUM';
}

describe('traditions', () => {
  it('every tradition can be offered in some lineage of the shipped scenarios', () => {
    const seen = new Set<TraditionId>();
    for (const scenario of ['greenvale', 'ashen'])
      for (let seed = 1; seed <= 10; seed++) {
        const c = createCampaign(seed, 'standard', scenario);
        while (c.epoch < getScenario(scenario).epochs.length - 1 && toInterregnum(c)) {
          const offers = c.lineage.interregnum!.traditions;
          for (const o of offers) seen.add(o.id);
          const pick = offers[seed % offers.length]!.id;
          dispatchAction(c, { type: 'found', site: 0, tradition: pick });
        }
      }
    expect([...seen].sort()).toEqual((Object.keys(TRADITIONS) as TraditionId[]).sort());
  });

  it('each offer looks back at what struck and ahead at what is coming, with no repeats', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const c = createCampaign(seed);
      while (c.epoch < 2 && toInterregnum(c)) {
        const offers = c.lineage.interregnum!.traditions;
        const struck = getScenario(c.scenario).epochs[c.epoch]!.hazard.kind;
        const next = getScenario(c.scenario).epochs[c.epoch + 1]!.hazard.kind;
        expect(offers).toHaveLength(3);
        expect(new Set(offers.map((o) => o.id)).size).toBe(3);
        expect(offers.some((o) => c.lineage.traditions.includes(o.id))).toBe(false);
        expect(offers.some((o) => TRADITIONS[o.id].after === struck)).toBe(true);
        expect(offers.some((o) => TRADITIONS[o.id].after === next)).toBe(true);
        dispatchAction(c, { type: 'found', site: 0, tradition: offers[0]!.id });
      }
    }
  });
});
