import { BUILDINGS, GRID_H, GRID_W } from '../engine';
import type { Campaign, Structure } from '../engine';

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
export const INF = 32000;

/** 1 where people can walk: land, fords, standing bridges; blocked by water and by standing buildings. */
export function buildWalkable(c: Campaign): Uint8Array {
  const w = c.world;
  const walk = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < walk.length; i++) walk[i] = w.water[i] === 1 ? 0 : 1;
  for (const s of c.structures) {
    const standing = s.status === 'active' || s.status === 'damaged' || s.status === 'constructing';
    if (s.kind === 'bridge' && standing) {
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) walk[(s.y + j) * GRID_W + s.x + i] = 1;
      continue;
    }
    if (!standing) continue;
    if (BUILDINGS[s.kind].water === 'require') continue;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) walk[(s.y + j) * GRID_W + s.x + i] = 0;
  }
  return walk;
}

/** Breadth-first distance (in steps) from the target cells over walkable cells, 8-connected without corner cutting. */
export function distanceField(walk: Uint8Array, targets: number[]): Int16Array {
  const dist = new Int16Array(GRID_W * GRID_H).fill(INF);
  const q: number[] = [];
  for (const t of targets) {
    dist[t] = 0;
    q.push(t);
  }
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi]!;
    const cx = cur % GRID_W;
    const cy = (cur - cx) / GRID_W;
    const d = dist[cur]!;
    for (const [dx, dy] of N8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const ni = ny * GRID_W + nx;
      if (!walk[ni] || dist[ni]! <= d + 1) continue;
      if (dx !== 0 && dy !== 0 && (!walk[cy * GRID_W + nx] || !walk[ny * GRID_W + cx])) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}

/** The walkable cell beside a footprint that faces the hearth: where people stand to work. */
export function entranceCell(walk: Uint8Array, s: Structure, toward: { x: number; y: number }): number {
  let best = -1;
  let bestD = Infinity;
  for (let j = -1; j <= s.h; j++) {
    for (let i = -1; i <= s.w; i++) {
      const inside = i >= 0 && j >= 0 && i < s.w && j < s.h;
      if (inside) continue;
      const x = s.x + i;
      const y = s.y + j;
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
      const k = y * GRID_W + x;
      if (!walk[k]) continue;
      const d = Math.hypot(x + 0.5 - toward.x, y + 0.5 - toward.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
  }
  return best;
}

export function hearthOf(c: Campaign): Structure | undefined {
  let best: Structure | undefined;
  for (const s of c.structures) {
    if (s.kind === 'hearth' && (s.status === 'active' || s.status === 'damaged') && (!best || s.id > best.id))
      best = s;
  }
  return best;
}

/** Soft dirt-road mask (0..1 per cell): walking routes from the hearth to every living building. */
export function roadMask(c: Campaign, walk: Uint8Array): Float32Array {
  const mask = new Float32Array(GRID_W * GRID_H);
  const hearth = hearthOf(c);
  if (!hearth) return mask;
  const hc = { x: hearth.x + hearth.w / 2, y: hearth.y + hearth.h / 2 };
  const home = entranceCell(walk, hearth, { x: hc.x, y: hc.y + 5 });
  if (home < 0) return mask;
  const field = distanceField(walk, [home]);
  const trace = (from: number) => {
    let cur = from;
    for (let guard = 0; guard < 80; guard++) {
      mask[cur] = Math.max(mask[cur]!, 1);
      const cx = cur % GRID_W;
      const cy = (cur - cx) / GRID_W;
      let best = cur;
      let bd = field[cur]!;
      if (bd === 0 || bd >= INF) break;
      for (const [dx, dy] of N8) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        const ni = ny * GRID_W + nx;
        if (field[ni]! < bd) {
          bd = field[ni]!;
          best = ni;
        }
      }
      if (best === cur) break;
      cur = best;
    }
  };
  for (const s of c.structures) {
    if (s.kind === 'hearth' || s.kind === 'firebreak' || s.status === 'rubble' || s.status === 'buried')
      continue;
    const e = entranceCell(walk, s, hc);
    if (e >= 0 && field[e]! < INF) trace(e);
  }
  return mask;
}
