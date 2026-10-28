import { footprint } from '../content/buildings';
import { MAX_AGES, epochSpec, getScenario } from '../content/scenario';
import type { BuildingKind, Campaign } from '../core/types';
import { checkPlacement, isPlacementOk } from '../economy/placement';
import { resolveHazard } from '../world/hazards';
import { footprintCells, idx, inBounds } from '../world/query';

export interface Spot {
  x: number;
  y: number;
  rot: 0 | 1;
  /** Footprint after rotation. */
  w: number;
  h: number;
  score: number;
}

export interface SpotOptions {
  /** Prefer cells near this point. */
  near?: { x: number; y: number };
  maxDist?: number;
  /** Penalize cells the coming hazard reaches. */
  avoidHazard?: boolean;
  /**
   * Penalize cells that the hazards of these epochs of the scenario will reach (a veteran's foresight, used to
   * site landmarks that must outlive several collapses). Quakes count where they are strong enough to topple.
   */
  avoidEpochs?: number[];
  /** Prefer high ground. */
  high?: boolean;
  /** Custom bonus. */
  bonus?: (x: number, y: number, w: number, h: number) => number;
  rots?: (0 | 1)[];
  ignoreAffordability?: boolean;
}

/** The standing hearth (the society may have relocated), else the founders' original site. */
export function currentHearth(c: Campaign): { x: number; y: number } {
  let best: { x: number; y: number; id: number } | null = null;
  for (const s of c.structures) {
    if (s.kind === 'hearth' && (s.status === 'active' || s.status === 'damaged') && (!best || s.id > best.id))
      best = { x: s.x + 1, y: s.y + 1, id: s.id };
  }
  return best ?? c.world.anchors.hearth;
}

const futureCache = new WeakMap<Campaign, Map<string, Set<number>>>();

/** Cells the hazards of the given scenario epochs would reach on the map as it stands (cached per state). */
function futureHazardCells(c: Campaign, epochs: number[]): Set<number> {
  let perCampaign = futureCache.get(c);
  if (!perCampaign) futureCache.set(c, (perCampaign = new Map()));
  const key = `${epochs.join(',')}|${c.nextId}|${c.epoch}`;
  const hit = perCampaign.get(key);
  if (hit) return hit;
  perCampaign.clear();
  const out = new Set<number>();
  const ages = c.endless ? MAX_AGES : getScenario(c.scenario).epochs.length;
  for (const e of epochs) {
    const hz = e < ages ? epochSpec(c, e).hazard : null;
    if (!hz) continue;
    for (const h of resolveHazard(c, hz.kind, hz.strength).cells) {
      if (hz.kind === 'quake' && h.intensity < 420) continue;
      out.add(idx(h.x, h.y, c.world.w));
    }
  }
  perCampaign.set(key, out);
  return out;
}

/** Brute-force search for the best legal footprint. Pure and deterministic (scan order breaks ties). */
export function findSpot(c: Campaign, kind: BuildingKind, opts: SpotOptions = {}): Spot | null {
  const near = opts.near ?? currentHearth(c);
  const maxDist = opts.maxDist ?? 14;
  const rots = opts.rots ?? [0];
  let hazardCells: Set<number> | null = null;
  if (opts.avoidHazard) {
    hazardCells = new Set(resolveHazard(c).cells.map((h) => idx(h.x, h.y, c.world.w)));
  }
  if (opts.avoidEpochs) {
    hazardCells ??= new Set<number>();
    for (const i of futureHazardCells(c, opts.avoidEpochs)) hazardCells.add(i);
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
        if (!best || score > best.score) best = { x, y, rot, w, h, score };
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
