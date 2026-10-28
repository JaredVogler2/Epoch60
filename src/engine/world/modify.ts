import { BUILDINGS } from '../content/buildings';
import {
  FAULT_OFFSET,
  FLOODPLAIN_FERTILITY,
  FLOODPLAIN_REACH,
  LIBRARY_TECHS,
  SOFT_ROCK_PM,
} from '../content/modifiers';
import { UNIT } from '../core/constants';
import type { Campaign, ModifierId, Structure } from '../core/types';
import { createStructure } from '../economy/structures';
import { clamp, idx } from './query';

const has = (c: Campaign, id: ModifierId) => c.modifiers?.includes(id) ?? false;

/**
 * What a lineage's challenges change in the valley itself, applied once when the lineage begins: after the world is
 * generated, before the founders level their hearth. Integer arithmetic only (this is hashed state).
 */
export function applyWorldModifiers(c: Campaign): void {
  const w = c.world;
  if (has(c, 'fertile_floodplain')) {
    for (let y = 0; y < w.h; y++) {
      const centre = w.riverCenter[y]!.x; // in 1/100 cells
      for (let x = 0; x < w.w; x++) {
        const i = idx(x, y, w.w);
        if (w.water[i] || w.rock[i] || Math.abs(x * 100 - centre) > FLOODPLAIN_REACH * 100) continue;
        w.fertility[i] = Math.min(950, w.fertility[i]! + FLOODPLAIN_FERTILITY);
      }
    }
  }
  if (has(c, 'soft_rock')) {
    for (let i = 0; i < w.rock.length; i++)
      if (w.rock[i]! > 0) w.rock[i] = Math.min(1000, Math.round((w.rock[i]! * SOFT_ROCK_PM) / 1000));
  }
  if (has(c, 'fractured_fault')) {
    const h = w.anchors.hearth;
    w.anchors.quakeEpicenter = {
      x: clamp(h.x + FAULT_OFFSET.dx, 4, w.w - 4),
      y: clamp(h.y + FAULT_OFFSET.dy, 4, w.h - 4),
    };
  }
}

/**
 * Buried Library: the Archive of a people older than the founders, deep in the floodplain silt west of the first
 * hearth (about seven cells out, never on water, rock or another building), its tablets intact. Called after the
 * hearth exists, so the hearth keeps id 1.
 */
export function placeBuriedLibrary(c: Campaign): Structure | null {
  if (!has(c, 'buried_library')) return null;
  const w = c.world;
  const def = BUILDINGS.archive;
  const hx = w.anchors.hearth.x + 1;
  const hy = w.anchors.hearth.y + 1;
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = 1; y + def.h < w.h; y++) {
    for (let x = 1; x + def.w < w.w; x++) {
      const dx = x + 1 - hx;
      const dy = y + 1 - hy;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < 5 || d > 12) continue;
      let clear = true;
      for (let yy = y; yy < y + def.h && clear; yy++)
        for (let xx = x; xx < x + def.w && clear; xx++) {
          const i = idx(xx, yy, w.w);
          if (w.water[i] || w.rock[i] || w.occ[i] !== -1) clear = false;
        }
      if (!clear) continue;
      // The floodplain west of the hearth first, then the nearest to seven cells out, then the nearest row.
      const score = (dx > 0 ? 1000 : 0) + Math.abs(d - 7) * 10 + Math.abs(dy);
      if (!best || score < best.score) best = { x, y, score };
    }
  }
  if (!best) return null;
  const s = createStructure(c, 'archive', best.x, best.y, 0, 'buried');
  s.originEpoch = -1;
  s.integrity = 0;
  s.burial = 3;
  s.cause = 'decay';
  s.storedTechs = [...LIBRARY_TECHS];
  s.salvage = { timber: 0, stone: Math.round((def.cost.stone ?? 0) * UNIT * def.salvage * 0.0007) };
  s.provenance.push(
    'Raised by a people who lived in the valley before the founders.',
    'Abandoned, it crumbled with the centuries.',
    'The river buried it in silt, its tablets sealed in clay.',
  );
  return s;
}
