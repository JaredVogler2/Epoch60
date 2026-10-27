import { footprint } from '../content/buildings';
import type { BuildingKind, Campaign } from '../core/types';
import { currentHearth } from '../ai/spots';
import { footprintCells, idx, inBounds } from '../world/query';
import { checkPlacement, isPlacementOk } from './placement';

export interface SuggestedSpot {
  x: number;
  y: number;
  rot: 0 | 1;
  w: number;
  h: number;
  /** Manhattan distance of the footprint centre from the village centre. */
  dist: number;
  /** How many cells of the footprint (plus a one-cell margin) lie inside the cells to avoid. */
  exposed: number;
}

/**
 * Legal, affordable sites for a building, nearest the village first and spread apart so a player (or a screen-reader
 * user) can cycle through genuinely different options instead of one-cell nudges. Sites inside `avoid` (typically the
 * forecast footprint) are ranked after safe ones. Pure and deterministic.
 */
export function suggestSpots(
  c: Campaign,
  kind: BuildingKind,
  opts: { near?: { x: number; y: number }; limit?: number; avoid?: Set<number>; spacing?: number } = {},
): SuggestedSpot[] {
  const near = opts.near ?? currentHearth(c);
  const limit = opts.limit ?? 12;
  const spacing = opts.spacing ?? 3;
  const all: SuggestedSpot[] = [];
  for (const rot of [0, 1] as const) {
    const { w, h } = footprint(kind, rot);
    if (rot === 1 && w === footprint(kind, 0).w && h === footprint(kind, 0).h) continue;
    for (let y = 0; y + h <= c.world.h; y++) {
      for (let x = 0; x + w <= c.world.w; x++) {
        if (!isPlacementOk(checkPlacement(c, kind, x, y, rot))) continue;
        let exposed = 0;
        if (opts.avoid) {
          for (const [cx, cy] of footprintCells(x - 1, y - 1, w + 2, h + 2)) {
            if (inBounds(cx, cy, c.world.w, c.world.h) && opts.avoid.has(idx(cx, cy, c.world.w))) exposed++;
          }
        }
        all.push({
          x,
          y,
          rot,
          w,
          h,
          dist: Math.abs(x + w / 2 - near.x) + Math.abs(y + h / 2 - near.y),
          exposed,
        });
      }
    }
  }
  all.sort((a, b) => a.exposed - b.exposed || a.dist - b.dist || a.y - b.y || a.x - b.x || a.rot - b.rot);
  const out: SuggestedSpot[] = [];
  for (const s of all) {
    if (out.length >= limit) break;
    if (out.some((o) => Math.abs(o.x - s.x) < spacing && Math.abs(o.y - s.y) < spacing)) continue;
    out.push(s);
  }
  return out;
}
