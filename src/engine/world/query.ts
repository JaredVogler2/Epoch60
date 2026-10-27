import { GRID_H, GRID_W } from '../core/constants';
import type { Structure, World } from '../core/types';

export const idx = (x: number, y: number, w = GRID_W): number => y * w + x;

export function inBounds(x: number, y: number, w = GRID_W, h = GRID_H): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export const N4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const N8: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function* footprintCells(x: number, y: number, w: number, h: number): Generator<[number, number]> {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) yield [x + i, y + j];
}

/** Smooth 0..1 ramp used by the generator (polynomial: exact in IEEE arithmetic). */
export function smooth(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

export function cellsOf(s: Structure): [number, number][] {
  const out: [number, number][] = [];
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) out.push([s.x + i, s.y + j]);
  return out;
}

/** Mean terrain height under a footprint (used when a pad is levelled). */
export function meanHeight(world: World, x: number, y: number, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (const [cx, cy] of footprintCells(x, y, w, h)) {
    sum += world.height[idx(cx, cy, world.w)] ?? 0;
    n++;
  }
  return Math.round(sum / Math.max(1, n));
}

/** Height spread (max-min) under a footprint. */
export function slopeSpread(world: World, x: number, y: number, w: number, h: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [cx, cy] of footprintCells(x, y, w, h)) {
    const v = world.height[idx(cx, cy, world.w)] ?? 0;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
}

/** Cells reachable on foot from a start cell. Water blocks, fords and bridges pass. */
export function walkable(world: World, bridgeCells: Set<number>, x: number, y: number): boolean {
  if (!inBounds(x, y, world.w, world.h)) return false;
  const i = idx(x, y, world.w);
  if (world.water[i] === 1) return bridgeCells.has(i);
  return true;
}

export function reachableSet(world: World, bridgeCells: Set<number>, sx: number, sy: number): Set<number> {
  const seen = new Set<number>();
  if (!walkable(world, bridgeCells, sx, sy)) return seen;
  const stack: number[] = [idx(sx, sy, world.w)];
  seen.add(stack[0]!);
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % world.w;
    const cy = (cur - cx) / world.w;
    for (const [dx, dy] of N4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(world, bridgeCells, nx, ny)) continue;
      const ni = idx(nx, ny, world.w);
      if (seen.has(ni)) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  return seen;
}
