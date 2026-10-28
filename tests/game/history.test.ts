import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCampaign, replayCampaign } from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { ERODED_AT, historyLayers, lensShown } from '../../src/render/history';

/** The Archivists' recorded lineage up to the n-th founding: between ages, or (`founded`) planning the next age. */
function between(n: number, founded = false): Campaign {
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as Transcript;
  let seen = 0;
  const k = t.actions.findIndex((a) => a.action.type === 'found' && ++seen === n) + (founded ? 1 : 0);
  const c = replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
  expect(c.phase).toBe(founded ? 'PREPARE' : 'INTERREGNUM');
  return c;
}

describe('the history lens reads what each age left', () => {
  it('marks every building and ruin with the age that raised it', () => {
    const c = between(2);
    const h = historyLayers(c);
    expect(h.sites).toHaveLength(c.structures.length);
    for (const site of h.sites) {
      const s = c.structures.find((x) => x.id === site.id)!;
      expect(site.epoch).toBe(s.originEpoch);
      expect(site.ruin).toBe(s.status === 'rubble' || s.status === 'buried');
    }
    // Both earlier ages left something, and the ages are named in order for the legend.
    expect(new Set(h.sites.map((x) => x.epoch))).toEqual(new Set([0, 1]));
    expect(h.ages).toEqual(['Age of Thatch', 'Age of Bronze']);
  });

  it("shows where each catastrophe reached: exactly the cells its report recorded, the flood's included", () => {
    const first = between(1);
    expect(historyLayers(first).reach.map((r) => [r.epoch, r.kind, r.name])).toEqual([
      [0, 'fire', 'The Great Fire'],
    ]);
    const c = between(2);
    const h = historyLayers(c);
    expect(h.reach.map((r) => [r.epoch, r.kind, r.name])).toEqual([
      [0, 'fire', 'The Great Fire'],
      [1, 'flood', 'The Great Flood'],
    ]);
    h.reach.forEach((r, i) => expect(r.cells).toEqual(c.lineage.reports[i]!.result.cells));
    // The flood's own erosion fades below the eroded-ground mark between ages: only the record still shows its reach.
    const flood = h.reach[1]!.cells;
    expect(flood.length).toBeGreaterThan(100);
    const fadedOut = flood.filter((q) => c.world.erosion[q.y * c.world.w + q.x]! < ERODED_AT);
    expect(fadedOut.length).toBeGreaterThan(flood.length / 2);
  });

  it('marks as eroded only land the world records as worn away', () => {
    const c = between(2);
    const h = historyLayers(c);
    expect(h.eroded.length).toBeGreaterThan(0);
    let expected = 0;
    for (let i = 0; i < c.world.erosion.length; i++)
      if (c.world.water[i] !== 1 && c.world.erosion[i]! >= ERODED_AT) expected++;
    expect(h.eroded).toHaveLength(expected);
    for (const cell of h.eroded) {
      const i = cell.y * c.world.w + cell.x;
      expect(cell.intensity).toBe(c.world.erosion[i]);
      expect(c.world.water[i]).not.toBe(1);
    }
    // The river is never eroded ground, however much a run of floods has scoured its bed.
    const river = c.world.water.findIndex((v) => v === 1);
    c.world.erosion[river] = 500;
    expect(historyLayers(c).eroded).toHaveLength(expected);
  });

  it('is on between ages, on request while planning an inherited age, and never over the first age', () => {
    expect(lensShown(between(1), 'game', false)).toBe(true);
    expect(lensShown(between(1), 'title', false)).toBe(false);
    const second = between(1, true);
    expect(lensShown(second, 'game', false)).toBe(false);
    expect(lensShown(second, 'game', true)).toBe(true);
    // A toggle left on by an earlier lineage must not hide the first age's forecast: it has no history to show.
    expect(lensShown(createCampaign(7), 'game', true)).toBe(false);
    expect(lensShown(null, 'game', true)).toBe(false);
  });
});
