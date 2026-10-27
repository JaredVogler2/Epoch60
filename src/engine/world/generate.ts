import { CELLS, GRID_H, GRID_W } from '../core/constants';
import { hash32 } from '../core/prng';
import type { World } from '../core/types';
import { clamp, idx, reachableSet, smooth } from './query';

/** Lattice value noise in [0,1). Pure integer hash + polynomial interpolation. */
function lattice(seed: number, ix: number, iy: number): number {
  return hash32(seed, ix, iy) / 4294967296;
}

function vnoise(seed: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = lattice(seed, ix, iy);
  const b = lattice(seed, ix + 1, iy);
  const c = lattice(seed, ix, iy + 1);
  const d = lattice(seed, ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(seed: number, x: number, y: number): number {
  return (
    vnoise(seed, x * 0.16, y * 0.16) * 0.6 +
    vnoise(seed + 7, x * 0.34, y * 0.34) * 0.28 +
    vnoise(seed + 13, x * 0.8, y * 0.8) * 0.12
  );
}

/** Uniform Catmull-Rom through control values. t in [0, n-1]. */
function catmull(ctrl: number[], t: number): number {
  const n = ctrl.length;
  const i = clamp(Math.floor(t), 0, n - 2);
  const f = t - i;
  const p0 = ctrl[Math.max(0, i - 1)]!;
  const p1 = ctrl[i]!;
  const p2 = ctrl[i + 1]!;
  const p3 = ctrl[Math.min(n - 1, i + 2)]!;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * f +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f +
      (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
  );
}

function bump(x: number, y: number, cx: number, cy: number, r: number, hgt: number): number {
  const dx = x - cx;
  const dy = y - cy;
  const t = 1 - (dx * dx + dy * dy) / (r * r);
  return t > 0 ? hgt * t * t : 0;
}

function emptyWorld(seed: number): World {
  const z = (v: number) => new Array<number>(CELLS).fill(v);
  return {
    w: GRID_W,
    h: GRID_H,
    seed,
    height: z(0),
    water: z(0),
    fertility: z(0),
    forest: z(0),
    rock: z(0),
    pollution: z(0),
    scar: z(0),
    silt: z(0),
    erosion: z(0),
    occ: z(-1),
    riverCenter: [],
    anchors: {
      hearth: { x: 0, y: 0 },
      fireOrigin: { x: 0, y: 0 },
      wind: { dx: -1, dy: 0 },
      quakeEpicenter: { x: 0, y: 0 },
      hills: [],
    },
  };
}

function build(seed: number, genSeed: number): World {
  const world = emptyWorld(seed);
  const W = GRID_W;
  const H = GRID_H;
  const n = (k: number) => hash32(genSeed, k) / 4294967296;

  // --- River: a meandering N→S ribbon. Centre stored in 1/100 cells per row.
  const ctrlX: number[] = [];
  const baseX = 11 + n(1) * 2;
  for (let i = 0; i < 7; i++) {
    const wob = (n(10 + i) - 0.5) * 5.0;
    ctrlX.push(clamp(baseX + (i % 2 === 0 ? 1 : -1) * (1.2 + n(30 + i) * 1.4) + wob * 0.4, 8, 14.5));
  }
  const rx = (y: number) => catmull(ctrlX, (y / (H - 1)) * (ctrlX.length - 1));
  for (let y = 0; y < H; y++) world.riverCenter.push({ x: Math.round(rx(y) * 100), y });

  // --- Landmarks.
  const hy = 16;
  const hx = Math.round(rx(hy)) + 7;
  const hills: { x: number; y: number }[] = [
    { x: 27 + Math.round(n(50) * 2), y: 9 + Math.round(n(51) * 3) },
    { x: 26 + Math.round(n(52) * 3), y: 25 + Math.round(n(53) * 2) },
  ];
  world.anchors.hills = hills;
  world.anchors.hearth = { x: hx, y: hy };

  // --- Height.
  for (let y = 0; y < H; y++) {
    const cx = rx(y);
    for (let x = 0; x < W; x++) {
      const s = x - cx; // signed distance east of the river
      const d = Math.abs(s);
      let h: number;
      if (s >= 0) h = 38 + smooth(d / 11) * 70 + smooth((d - 8) / 14) * 120;
      else h = 38 + smooth(d / 12) * 80 + smooth((d - 7) / 8) * 170;
      for (const hill of hills) h += bump(x, y, hill.x, hill.y, 9.5, 520);
      h += bump(x, y, 4, 6, 8, 220) + bump(x, y, 3, 27, 7, 180); // west ridge shoulders
      h += (fbm(genSeed, x, y) - 0.5) * 60;
      // Flatten a founding meadow so the first village has room to breathe.
      const md = Math.sqrt((x - hx) * (x - hx) + (y - hy) * (y - hy));
      const meadow = 1 - smooth((md - 6) / 5);
      h = h * (1 - meadow) + (62 + (x - hx) * 1.2) * meadow;
      // Carve the river channel with soft banks.
      const carve = 1 - smooth((d - 0.6) / 2.2);
      h = h * (1 - carve) + (-8 + (fbm(genSeed + 3, x, y) - 0.5) * 10) * carve;
      world.height[idx(x, y)] = Math.round(h);
      world.water[idx(x, y)] = d < 1.15 ? 1 : 0;
    }
  }
  // A shallow ford so both banks are connected in the stone age.
  const fordY = 22 + Math.round(n(60) * 2);
  for (let dy = 0; dy < 2; dy++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, fordY + dy);
      if (world.water[i] === 1) {
        world.water[i] = 2;
        world.height[i] = Math.max(world.height[i]!, 2);
      }
    }
  }

  // --- Rock outcrops: one small knoll near the village (scarcity) and big deposits in the hills.
  const knoll = { x: hx + 4 + Math.round(n(70) * 2), y: hy - 6 - Math.round(n(71) * 2) };
  const deposits: { x: number; y: number; r: number; amount: number }[] = [
    { x: knoll.x, y: knoll.y, r: 2.1, amount: 22 },
    { x: hills[0]!.x - 1, y: hills[0]!.y + 5, r: 3.0, amount: 46 },
    { x: hills[1]!.x - 2, y: hills[1]!.y - 3, r: 2.6, amount: 40 },
  ];
  for (const dep of deposits) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dd = Math.sqrt((x - dep.x) * (x - dep.x) + (y - dep.y) * (y - dep.y));
        if (dd >= dep.r) continue;
        const i = idx(x, y);
        if (world.water[i]) continue;
        const f = 1 - dd / dep.r;
        world.rock[i] = Math.max(
          world.rock[i]!,
          Math.round(dep.amount * (0.45 + f * 0.8) * (0.8 + n(80 + x + y * 32) * 0.4)),
        );
        world.height[i] = world.height[i]! + Math.round(f * 26); // outcrops stand proud
      }
    }
  }

  // --- Fertility and forest.
  const fire = {
    x: Math.min(W - 4, hx + 9 + Math.round(n(90) * 2)),
    y: clamp(hy + 3 + Math.round(n(91) * 3), 4, H - 4),
  };
  world.anchors.fireOrigin = fire;
  world.anchors.wind = { dx: -1, dy: 0 };
  world.anchors.quakeEpicenter = { x: clamp(hx + 8, 4, W - 4), y: clamp(hy - 8, 4, H - 4) };

  for (let y = 0; y < H; y++) {
    const cx = rx(y);
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (world.water[i]) continue;
      const d = Math.abs(x - cx);
      const hgt = world.height[i]!;
      // Floodplain soil is rich, hills are thin.
      let fert = 900 - d * 30 - Math.max(0, hgt - 90) * 1.4 + (fbm(genSeed + 5, x, y) - 0.5) * 220;
      if (world.rock[i]! > 0) fert = 40;
      world.fertility[i] = Math.round(clamp(fert, 60, 950));

      // Forest: dense on the eastern slopes and the west bank, thin on the floodplain.
      const east = x > cx;
      let forest = fbm(genSeed + 9, x * 1.1, y * 1.1) * 1500 - 520;
      forest += Math.max(0, hgt - 130) * (east ? 1.1 : 0.7);
      forest += east ? 0 : 130;
      if (east && d > 4.5 && d < 8.5) forest += 160; // the fuel belt between hills and floodplain
      if (d < 2) forest -= 200;
      if (world.rock[i]! > 0) forest = 0;
      world.forest[i] = Math.round(clamp(forest, 0, 950));
    }
  }
  // Clear the founding meadow, leaving a few edge trees.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const md = Math.sqrt((x - hx) * (x - hx) + (y - hy) * (y - hy));
      const i = idx(x, y);
      if (md < 5.2) world.forest[i] = Math.min(world.forest[i]!, Math.round(60 * smooth((md - 2) / 3)));
    }
  }
  // Guarantee a fuel corridor from the ignition point toward the village so the wildfire is a real threat.
  const steps = 14;
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(fire.x + ((hx + 4 - fire.x) * s) / steps);
    const y = Math.round(fire.y + ((hy + 1 - fire.y) * s) / steps);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const i = idx(cx, cy);
        if (world.water[i] || world.rock[i]! > 0) continue;
        const md = Math.sqrt((cx - hx) * (cx - hx) + (cy - hy) * (cy - hy));
        if (md < 5) continue;
        world.forest[i] = Math.max(world.forest[i]!, 560 + Math.round(n(100 + cx + cy * 32) * 260));
      }
    }
  }
  return world;
}

export interface WorldCheck {
  ok: boolean;
  problems: string[];
  stats: Record<string, number>;
}

/** Validity gate: a seed is only accepted if the founders have a viable, interesting valley. */
export function validateWorld(world: World): WorldCheck {
  const problems: string[] = [];
  const { hearth, fireOrigin } = world.anchors;
  const hi = idx(hearth.x, hearth.y);
  if (world.water[hi]) problems.push('hearth on water');
  const reach = reachableSet(world, new Set(), hearth.x, hearth.y);
  let rockReach = 0;
  let fertileReach = 0;
  let forestReach = 0;
  let landCells = 0;
  for (let i = 0; i < CELLS; i++) {
    if (!world.water[i]) landCells++;
    if (!reach.has(i)) continue;
    rockReach += world.rock[i]!;
    if (world.fertility[i]! >= 600) fertileReach++;
    if (world.forest[i]! >= 300) forestReach++;
  }
  if (reach.size < CELLS * 0.55) problems.push('founders can reach too little land');
  if (rockReach < 250) problems.push('stone unreachable');
  if (fertileReach < 40) problems.push('too little fertile land');
  if (forestReach < 40) problems.push('too little forest');
  if (world.forest[idx(fireOrigin.x, fireOrigin.y)]! < 300) problems.push('fire origin not forested');
  const dx = fireOrigin.x - hearth.x;
  const dy = fireOrigin.y - hearth.y;
  if (dx * dx + dy * dy < 49) problems.push('fire origin too close to hearth');
  // River must be continuous top to bottom.
  for (let y = 0; y < world.h; y++) {
    let any = false;
    for (let x = 0; x < world.w; x++) if (world.water[idx(x, y)]) any = true;
    if (!any) problems.push(`river broken at row ${y}`);
  }
  // Founding slope near hearth must be gentle.
  let lo = Infinity;
  let hiH = -Infinity;
  for (let j = -3; j <= 3; j++) {
    for (let i = -3; i <= 3; i++) {
      const v = world.height[idx(hearth.x + i, hearth.y + j)]!;
      lo = Math.min(lo, v);
      hiH = Math.max(hiH, v);
    }
  }
  if (hiH - lo > 90) problems.push('founding ground too steep');
  return {
    ok: problems.length === 0,
    problems,
    stats: { reach: reach.size, rockReach, fertileReach, forestReach, landCells },
  };
}

export const MAX_WORLD_ATTEMPTS = 8;

/**
 * Generate the persistent world for a seed. Retries with derived sub-seeds (bounded) until the validity
 * gate passes. The stored `seed` is always the campaign seed, so the result depends only on it.
 */
export function generateWorld(seed: number): World {
  let last: World | null = null;
  for (let attempt = 0; attempt < MAX_WORLD_ATTEMPTS; attempt++) {
    const genSeed = attempt === 0 ? seed : hash32(seed, attempt, 0x57a);
    const world = build(seed, genSeed);
    last = world;
    if (validateWorld(world).ok) return world;
  }
  // Bounded fallback: curated canonical valley.
  const canon = build(seed, 6001);
  return validateWorld(canon).ok ? canon : (last as World);
}
