import { describe, expect, it } from 'vitest';
import { checkPlacement, resolveHazard, UNIT } from '../../src/engine';
import { isPlacementOk } from '../../src/engine/economy/placement';
import { suggestSpots } from '../../src/engine/economy/suggest';
import { idx } from '../../src/engine/world/query';
import { fresh } from './helpers';

describe('suggested sites (the accessible way to place)', () => {
  it('returns legal, affordable, distinct sites, nearest the village first', () => {
    const c = fresh();
    const spots = suggestSpots(c, 'cottage', { limit: 6 });
    expect(spots.length).toBeGreaterThan(2);
    for (const s of spots) expect(isPlacementOk(checkPlacement(c, 'cottage', s.x, s.y, s.rot))).toBe(true);
    for (let i = 1; i < spots.length; i++) expect(spots[i]!.exposed >= spots[i - 1]!.exposed).toBe(true);
    // spread: no two within 3 cells on both axes
    for (const a of spots)
      for (const b of spots)
        if (a !== b) expect(Math.abs(a.x - b.x) >= 3 || Math.abs(a.y - b.y) >= 3).toBe(true);
  });

  it('ranks sites outside the forecast footprint ahead of exposed ones', () => {
    const c = fresh();
    const hazard = new Set(resolveHazard(c).cells.map((h) => idx(h.x, h.y)));
    const blind = suggestSpots(c, 'cottage', { limit: 5 });
    const aware = suggestSpots(c, 'cottage', { limit: 5, avoid: hazard });
    expect(aware[0]!.exposed).toBeLessThanOrEqual(blind[0]!.exposed);
  });

  it('offers rotated sites for long buildings and nothing when the village cannot pay', () => {
    const c = fresh();
    const walls = suggestSpots(c, 'firebreak', { limit: 10 });
    expect(walls.some((s) => s.rot === 1)).toBe(true);
    expect(walls.some((s) => s.rot === 0)).toBe(true);
    c.civ.res.timber = 0;
    expect(suggestSpots(c, 'cottage')).toEqual([]);
    c.civ.res.timber = 100 * UNIT;
    expect(suggestSpots(c, 'cottage').length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(suggestSpots(fresh(), 'farm')).toEqual(suggestSpots(fresh(), 'farm'));
  });
});
