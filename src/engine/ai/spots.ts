import { footprint } from '../content/buildings';
import type { BuildingKind, Campaign } from '../core/types';
import { checkPlacement, isPlacementOk } from '../economy/placement';
import { resolveHazard } from '../world/hazards';
import { footprintCells, idx, inBounds } from '../world/query';

export interface Spot {
  x: number;
  y: number;
  rot: 0 | 1;
  score: number;
}

export interface SpotOptions {
  /** Prefer cells near this point. */
  near?: { x: number; y: number };
  maxDist?: number;
  /** Penalize cells the coming hazard reaches. */
  avoidHazard?: boolean;
  /** Prefer high ground. */
  high?: boolean;
  /** Custom bonus. */
  bonus?: (x: number, y: number, w: number, h: number) => number;
  rots?: (0 | 1)[];
  ignoreAffordability?: boolean;
}

/** Brute-force search for the best legal footprint. Pure and deterministic (scan order breaks ties). */
export function findSpot(c: Campaign, kind: BuildingKind, opts: SpotOptions = {}): Spot | null {
  const near = opts.near ?? c.world.anchors.hearth;
  const maxDist = opts.maxDist ?? 14;
  const rots = opts.rots ?? [0];
  let hazardCells: Set<number> | null = null;
  if (opts.avoidHazard) {
    hazardCells = new Set(resolveHazard(c).cells.map((h) => idx(h.x, h.y, c.world.w)));
  }
  let best: Spot | null = null;
  for (const rot of rots) {
    const { w, h } = footprint(kind, rot);
    for (let y = 0; y < c.world.h - h + 1; y++) {
      for (let x = 0; x < c.world.w - w + 1; x++) {
        const dist = Math.abs(x + w / 2 - near.x) + Math.abs(y + h / 2 - near.y);
        if (dist > maxDist) continue;
        const chk = checkPlacement(c, kind, x, y, rot, { ignoreAffordability: opts.ignoreAffordability });
        if (!isPlacementOk(chk)) continue;
        let score = -dist * 3;
        if (opts.bonus) score += opts.bonus(x, y, w, h);
        if (opts.high) score += c.world.height[idx(x, y, c.world.w)]! * 0.2;
        if (hazardCells) {
          let hit = 0;
          for (const [cx, cy] of footprintCells(x - 1, y - 1, w + 2, h + 2)) {
            if (inBounds(cx, cy, c.world.w, c.world.h) && hazardCells.has(idx(cx, cy, c.world.w))) hit++;
          }
          score -= hit * 40;
        }
        if (!best || score > best.score) best = { x, y, rot, score };
      }
    }
  }
  return best;
}

export function sumField(c: Campaign, field: number[], x: number, y: number, w: number, h: number): number {
  let s = 0;
  for (const [cx, cy] of footprintCells(x, y, w, h))
    if (inBounds(cx, cy, c.world.w, c.world.h)) s += field[idx(cx, cy, c.world.w)]!;
  return s;
}
