import { BUILDINGS, costOf, footprint } from '../content/buildings';
import { UNIT } from '../core/constants';
import type { ActionError, BuildingKind, Campaign, ErrorCode, Resources } from '../core/types';
import { footprintCells, idx, inBounds, reachableSet, slopeSpread, meanHeight } from '../world/query';
import { canAfford, hasTech, isStanding, reservedCost } from './modifiers';

export interface PlacementOk {
  ok: true;
  w: number;
  h: number;
  cost: Resources;
  /** Terrain height the pad will be levelled to. */
  padHeight: number;
  slope: number;
  /** Rubble structures that will be cleared by building here. */
  clears: number[];
  notes: string[];
}

function err(code: ErrorCode, message: string, hint?: ActionError['hint']): ActionError {
  return { ok: false, code, message, hint };
}

export function bridgeCells(c: Campaign): Set<number> {
  const out = new Set<number>();
  for (const s of c.structures) {
    if (s.kind !== 'bridge' || !isStanding(s)) continue;
    for (const [x, y] of footprintCells(s.x, s.y, s.w, s.h)) out.add(idx(x, y, c.world.w));
  }
  return out;
}

const reachCache = new WeakMap<Campaign, { key: string; set: Set<number> }>();

/**
 * Cells reachable on foot from the standing hearth(s). Cached against the only things that can change it —
 * standing hearths and bridges — so placement scans stay cheap.
 */
export function reachableFromHearth(c: Campaign): Set<number> {
  let key = '';
  for (const s of c.structures) {
    if ((s.kind === 'hearth' || s.kind === 'bridge') && isStanding(s)) key += `${s.id}:${s.x},${s.y};`;
  }
  const hit = reachCache.get(c);
  if (hit && hit.key === key) return hit.set;
  const bridges = bridgeCells(c);
  const merged = new Set<number>();
  for (const s of c.structures) {
    if (s.kind !== 'hearth' || !isStanding(s)) continue;
    // Start from any walkable cell touching the hearth footprint.
    for (const [x, y] of footprintCells(s.x - 1, s.y - 1, s.w + 2, s.h + 2)) {
      if (!inBounds(x, y, c.world.w, c.world.h)) continue;
      if (merged.has(idx(x, y, c.world.w))) continue;
      for (const v of reachableSet(c.world, bridges, x, y)) merged.add(v);
    }
  }
  reachCache.set(c, { key, set: merged });
  return merged;
}

export function countKind(c: Campaign, kind: BuildingKind, includeQueued = true): number {
  let n = 0;
  for (const s of c.structures) if (s.kind === kind && s.status !== 'rubble' && s.status !== 'buried') n++;
  if (includeQueued) for (const q of c.queue) if (q.action.type === 'build' && q.action.kind === kind) n++;
  return n;
}

/**
 * Full legality check for placing a building. Used by the live ghost preview, by dispatch, and again when the
 * queued action is applied at the tick boundary. Returns precise reason codes and hints.
 */
export function checkPlacement(
  c: Campaign,
  kind: BuildingKind,
  x: number,
  y: number,
  rot: 0 | 1,
  opts: { skipQueueId?: number; ignoreAffordability?: boolean } = {},
): PlacementOk | ActionError {
  const def = BUILDINGS[kind];
  if (!def || !def.enabled || def.founder) return err('unknown_kind', `${kind} cannot be built`);
  const spec = epochAge(c);
  if (def.age > spec) return err('locked_age', `${def.name} belongs to a later age`);
  if (def.tech && !hasTech(c, def.tech))
    return err('locked_tech', `${def.name} needs ${def.tech}`, { tech: def.tech });
  const { w, h } = footprint(kind, rot);
  const W = c.world.w;
  const H = c.world.h;
  if (!inBounds(x, y, W, H) || !inBounds(x + w - 1, y + h - 1, W, H))
    return err('out_of_bounds', 'Outside the valley');

  let waterCells = 0;
  const clears: number[] = [];
  for (const [cx, cy] of footprintCells(x, y, w, h)) {
    const i = idx(cx, cy, W);
    const wt = c.world.water[i]!;
    if (wt === 1) waterCells++;
    else if (wt === 2 && def.water === 'forbid')
      return err('on_water', 'Fords are for walking, not building');
    const occ = c.world.occ[i]!;
    if (occ !== -1) {
      const o = c.structures.find((s) => s.id === occ);
      if (o && o.status !== 'rubble' && o.status !== 'buried')
        return err('overlap', `Blocked by ${BUILDINGS[o.kind].name}`);
      if (o && !clears.includes(o.id)) clears.push(o.id);
    }
  }
  if (def.water === 'forbid' && waterCells > 0) return err('on_water', 'Cannot build on water');
  if (def.water === 'require' && waterCells < 2) return err('need_river', `${def.name} must span the river`);

  // Queued-but-unapplied builds reserve their cells too.
  for (const q of c.queue) {
    if (q.action.type !== 'build' || q.seq === opts.skipQueueId) continue;
    const f = footprint(q.action.kind, q.action.rot);
    if (x < q.action.x + f.w && q.action.x < x + w && y < q.action.y + f.h && q.action.y < y + h) {
      return err('overlap', 'Another building is already planned here');
    }
  }

  const slope = slopeSpread(c.world, x, y, w, h);
  if (slope > def.slopeMax && def.water === 'forbid')
    return err('too_steep', 'Too steep to level', { slope, max: def.slopeMax });

  if (def.needsRock) {
    let rock = 0;
    for (const [cx, cy] of footprintCells(x - 1, y - 1, w + 2, h + 2)) {
      if (inBounds(cx, cy, W, H)) rock += c.world.rock[idx(cx, cy, W)]!;
    }
    if (rock < 12) return err('need_deposit', 'Needs a stone outcrop underfoot', { rock });
  }
  if (def.needsForest) {
    let forest = 0;
    const cx0 = x + (w - 1) / 2;
    const cy0 = y + (h - 1) / 2;
    for (let j = -4; j <= 4; j++) {
      for (let i = -4; i <= 4; i++) {
        const px = Math.round(cx0) + i;
        const py = Math.round(cy0) + j;
        if (i * i + j * j > 16 || !inBounds(px, py, W, H)) continue;
        forest += c.world.forest[idx(px, py, W)]!;
      }
    }
    if (forest < 2500) return err('need_forest', 'Needs standing forest nearby', { forest });
  }

  const limit = def.limit;
  if (limit !== null) {
    const have = countKind(c, kind, true) - (opts.skipQueueId !== undefined ? 1 : 0);
    if (have >= limit) return err('limit_reached', `Only ${limit} ${def.name} allowed`, { limit });
  }

  if (def.water === 'forbid') {
    const reach = reachableFromHearth(c);
    let touches = false;
    for (const [cx, cy] of footprintCells(x - 1, y - 1, w + 2, h + 2)) {
      if (inBounds(cx, cy, W, H) && reach.has(idx(cx, cy, W))) {
        touches = true;
        break;
      }
    }
    if (!touches) return err('unreachable', 'Your people cannot walk there — no ford or bridge');
  }

  const cost = costOf(kind);
  if (!opts.ignoreAffordability) {
    const reserved = reservedCost(c);
    const eff: Resources = {
      food: c.civ.res.food - reserved.food,
      timber: c.civ.res.timber - reserved.timber,
      stone: c.civ.res.stone - reserved.stone,
      knowledge: c.civ.res.knowledge - reserved.knowledge,
    };
    const a = canAfford(eff, cost);
    if (!a.ok) {
      const hint: Record<string, number> = {};
      for (const k of Object.keys(a.missing) as (keyof Resources)[])
        hint[k] = Math.ceil((a.missing[k] ?? 0) / UNIT);
      return err('not_enough', 'Not enough resources', hint);
    }
  }

  const notes: string[] = [];
  if (kind === 'farm') {
    let f = 0;
    for (const [cx, cy] of footprintCells(x, y, w, h)) f += c.world.fertility[idx(cx, cy, W)]!;
    notes.push(`Soil ${Math.round(f / (w * h) / 10)}% fertile`);
  }
  return { ok: true, w, h, cost, padHeight: meanHeight(c.world, x, y, w, h), slope, clears, notes };
}

export function epochAge(c: Campaign): number {
  // The epoch index doubles as the age index for the Greenvale slice.
  return c.epoch;
}

export function isPlacementOk(r: PlacementOk | ActionError): r is PlacementOk {
  return r.ok;
}
