import { BufferAttribute, BufferGeometry } from 'three';
import type { Structure, World } from '../engine';
import { BUILDINGS } from '../engine';
import { GRID_H, GRID_W } from '../engine';
import { PAL, h01, mix, rgb, shade } from './geo';
import type { RGB } from './geo';

/** Quads per cell edge. 4 keeps the valley smooth at ~17k vertices. */
export const RES = 4;
export const NV = GRID_W * RES + 1;
/** Heights are stored in 1/100 cells. */
export const VS = 0.01;
/** Water surface sits just above the river bed. */
export const WATER_LEVEL = 0.07;
export const BASE_Y = -2.6;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
}

/** Catmull-Rom smoothed sample of a per-cell field at continuous cell coords (cell centres at +0.5). */
export function sampleSmooth(field: ArrayLike<number>, fx: number, fy: number): number {
  const gx = fx - 0.5;
  const gy = fy - 0.5;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const tx = gx - ix;
  const ty = gy - iy;
  const at = (x: number, y: number) =>
    field[clamp(y, 0, GRID_H - 1) * GRID_W + clamp(x, 0, GRID_W - 1)] as number;
  const rows: number[] = [];
  for (let j = -1; j <= 2; j++)
    rows.push(cr(at(ix - 1, iy + j), at(ix, iy + j), at(ix + 1, iy + j), at(ix + 2, iy + j), tx));
  return cr(rows[0]!, rows[1]!, rows[2]!, rows[3]!, ty);
}

/** Bilinear sample (for colour fields). */
export function sampleBilinear(field: ArrayLike<number>, fx: number, fy: number): number {
  const gx = clamp(fx - 0.5, 0, GRID_W - 1.0001);
  const gy = clamp(fy - 0.5, 0, GRID_H - 1.0001);
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const tx = gx - ix;
  const ty = gy - iy;
  const a = field[iy * GRID_W + ix] as number;
  const b = field[iy * GRID_W + ix + 1] as number;
  const c = field[(iy + 1) * GRID_W + ix] as number;
  const d = field[(iy + 1) * GRID_W + ix + 1] as number;
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export interface TerrainModel {
  geometry: BufferGeometry;
  /** nv × nv heights in world units. */
  heights: Float32Array;
  heightAt(x: number, z: number): number;
}

const C = {
  dry: rgb('#b9b25a'),
  lush: rgb('#6ea944'),
  rich: rgb('#4b9a3d'),
  forestFloor: rgb('#3d6230'),
  hillGrass: rgb('#8fa650'),
  rock: rgb('#938a7b'),
  rockLight: rgb('#b3aa98'),
  earth: rgb('#8d7252'),
  mud: rgb('#6d5a3f'),
  sand: rgb('#c2ac7c'),
  char: rgb('#2c2724'),
  ash: rgb('#6b655e'),
  silt: rgb('#b49b6e'),
  pad: rgb('#aa8d62'),
  path: rgb('#b89c6c'),
  wetGrass: rgb('#4f8a45'),
};

function noise2(x: number, y: number, seed: number): number {
  // smooth value noise from hash, in [0,1)
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = h01(ix, iy, seed);
  const b = h01(ix + 1, iy, seed);
  const c = h01(ix, iy + 1, seed);
  const d = h01(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export interface PadRect {
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  /** 0 = natural look, 1 = packed earth yard. */
  yard: number;
}

export function padsOf(structures: Structure[], world: World): PadRect[] {
  const out: PadRect[] = [];
  for (const s of structures) {
    const def = BUILDINGS[s.kind];
    if (def.water === 'require' || s.kind === 'levee') continue;
    let sum = 0;
    for (let j = 0; j < s.h; j++)
      for (let i = 0; i < s.w; i++) sum += world.height[(s.y + j) * world.w + s.x + i] ?? 0;
    const yard = s.kind === 'firebreak' ? 1 : s.kind === 'grove' ? 0 : 0.85;
    out.push({ x: s.x, y: s.y, w: s.w, h: s.h, height: (sum / (s.w * s.h)) * VS, yard });
  }
  return out;
}

export function buildTerrain(
  world: World,
  pads: PadRect[],
  pathMask: Float32Array | null,
  geometry?: BufferGeometry,
): TerrainModel {
  const nv = NV;
  const heights = new Float32Array(nv * nv);
  const pos = new Float32Array(nv * nv * 3);
  const nor = new Float32Array(nv * nv * 3);
  const col = new Float32Array(nv * nv * 3);
  const uv = new Float32Array(nv * nv * 2);

  // 1. smoothed heights
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const fx = i / RES;
      const fy = j / RES;
      heights[j * nv + i] = sampleSmooth(world.height, fx, fy) * VS;
    }
  }
  // 2. level building pads (blend in a small margin so terraces read as cut into the slope)
  const margin = 0.55;
  for (const p of pads) {
    const x0 = p.x - margin;
    const x1 = p.x + p.w + margin;
    const y0 = p.y - margin;
    const y1 = p.y + p.h + margin;
    const i0 = Math.max(0, Math.floor(x0 * RES));
    const i1 = Math.min(nv - 1, Math.ceil(x1 * RES));
    const j0 = Math.max(0, Math.floor(y0 * RES));
    const j1 = Math.min(nv - 1, Math.ceil(y1 * RES));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = i / RES;
        const y = j / RES;
        const dx = Math.max(p.x - x, 0, x - (p.x + p.w));
        const dy = Math.max(p.y - y, 0, y - (p.y + p.h));
        const d = Math.hypot(dx, dy);
        const t = 1 - smooth(d / margin);
        if (t <= 0) continue;
        const k = j * nv + i;
        heights[k] = heights[k]! + (p.height - heights[k]!) * t;
      }
    }
  }
  // 3. positions
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const k = (j * nv + i) * 3;
      pos[k] = i / RES;
      pos[k + 1] = heights[j * nv + i]!;
      pos[k + 2] = j / RES;
      uv[(j * nv + i) * 2] = i / RES / 2.5;
      uv[(j * nv + i) * 2 + 1] = j / RES / 2.5;
    }
  }
  // 4. normals from central differences
  const step = 1 / RES;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const hl = heights[j * nv + Math.max(0, i - 1)]!;
      const hr = heights[j * nv + Math.min(nv - 1, i + 1)]!;
      const hu = heights[Math.max(0, j - 1) * nv + i]!;
      const hd = heights[Math.min(nv - 1, j + 1) * nv + i]!;
      const nx = (hl - hr) / (2 * step);
      const nz = (hu - hd) / (2 * step);
      const l = Math.hypot(nx, 1, nz);
      const k = (j * nv + i) * 3;
      nor[k] = nx / l;
      nor[k + 1] = 1 / l;
      nor[k + 2] = nz / l;
    }
  }
  // 5. colours
  const yardAt = (x: number, y: number): number => {
    let m = 0;
    for (const p of pads) {
      if (p.yard <= 0) continue;
      const dx = Math.max(p.x - x, 0, x - (p.x + p.w));
      const dy = Math.max(p.y - y, 0, y - (p.y + p.h));
      const d = Math.hypot(dx, dy);
      const t = 1 - smooth(d / 0.45);
      if (t > m) m = t * p.yard;
    }
    return m;
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const fx = i / RES;
      const fy = j / RES;
      const h = heights[j * nv + i]!;
      const gx =
        (heights[j * nv + Math.min(nv - 1, i + 1)]! - heights[j * nv + Math.max(0, i - 1)]!) / (2 * step);
      const gy =
        (heights[Math.min(nv - 1, j + 1) * nv + i]! - heights[Math.max(0, j - 1) * nv + i]!) / (2 * step);
      const slope = Math.hypot(gx, gy);
      const fert = clamp(sampleBilinear(world.fertility, fx, fy) / 1000, 0, 1);
      const forest = clamp(sampleBilinear(world.forest, fx, fy) / 1000, 0, 1);
      const rockV = sampleBilinear(world.rock, fx, fy);
      const scar = clamp(sampleBilinear(world.scar, fx, fy) / 1000, 0, 1);
      const silt = clamp(sampleBilinear(world.silt, fx, fy) / 1000, 0, 1);
      const eros = clamp(sampleBilinear(world.erosion, fx, fy) / 1000, 0, 1);
      const fouled = clamp(sampleBilinear(world.pollution, fx, fy) / 350, 0, 0.72);

      const n1 = noise2(fx * 1.7, fy * 1.7, 11);
      const n2 = noise2(fx * 5.3, fy * 5.3, 23);
      let c: RGB = fert < 0.55 ? mix(C.dry, C.lush, fert / 0.55) : mix(C.lush, C.rich, (fert - 0.55) / 0.45);
      c = mix(c, C.hillGrass, smooth((h - 2.2) / 3.2) * 0.55);
      c = mix(c, C.forestFloor, forest * 0.75);
      c = shade(c, 0.9 + n1 * 0.2 + (n2 - 0.5) * 0.1);
      // wet margin and banks
      const wet = 1 - smooth((h - WATER_LEVEL + 0.04) / 0.34);
      c = mix(c, C.mud, wet * 0.85);
      c = mix(c, C.sand, smooth(1 - Math.abs(h - 0.2) / 0.16) * 0.5 * (1 - forest));
      c = mix(c, C.wetGrass, smooth(1 - Math.abs(h - 0.5) / 0.35) * 0.25);
      // slope exposes rock/earth
      const steep = smooth((slope - 0.45) / 0.9);
      c = mix(c, mix(C.earth, C.rock, clamp(h / 5, 0, 1)), steep * 0.85);
      if (rockV > 0) c = mix(c, mix(C.rock, C.rockLight, n2), clamp(rockV / 22, 0.45, 0.95));
      if (h > 5.4) c = mix(c, C.rockLight, smooth((h - 5.4) / 1.4) * 0.5);
      c = mix(c, C.silt, silt * 0.7);
      c = mix(c, C.earth, eros * 0.55);
      c = mix(c, mix(C.ash, C.char, n2), scar * 0.9);
      // Fallen ash: a pale grey blanket that outlasts the winter and poisons the soil beneath.
      c = mix(c, mix(rgb('#aaa69d'), rgb('#8d8982'), n2), fouled);
      if (pathMask) c = mix(c, C.path, clamp(sampleBilinear(pathMask, fx, fy), 0, 1) * 0.8);
      const y = yardAt(fx, fy);
      if (y > 0) c = mix(c, mix(C.pad, PAL.earth, n2 * 0.4), y * 0.9);
      const k = (j * nv + i) * 3;
      col[k] = c[0];
      col[k + 1] = c[1];
      col[k + 2] = c[2];
    }
  }

  let g = geometry;
  if (!g) {
    g = new BufferGeometry();
    const idx = new Uint32Array((nv - 1) * (nv - 1) * 6);
    let t = 0;
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nv - 1; i++) {
        const a = j * nv + i;
        const b = a + 1;
        const c2 = a + nv;
        const d = c2 + 1;
        // alternate the diagonal for a less directional triangulation
        if ((i + j) % 2 === 0) idx.set([a, c2, b, b, c2, d], t);
        else idx.set([a, c2, d, a, d, b], t);
        t += 6;
      }
    }
    g.setIndex(new BufferAttribute(idx, 1));
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(nor, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
  } else {
    (g.getAttribute('position') as BufferAttribute).set(pos);
    (g.getAttribute('normal') as BufferAttribute).set(nor);
    (g.getAttribute('color') as BufferAttribute).set(col);
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('normal') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();

  const heightAt = (x: number, z: number): number => {
    const gx = clamp(x * RES, 0, nv - 1.0001);
    const gz = clamp(z * RES, 0, nv - 1.0001);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const tx = gx - ix;
    const tz = gz - iz;
    const a = heights[iz * nv + ix]!;
    const b = heights[iz * nv + ix + 1]!;
    const c3 = heights[(iz + 1) * nv + ix]!;
    const d = heights[(iz + 1) * nv + ix + 1]!;
    return a + (b - a) * tx + (c3 - a) * tz + (a - b - c3 + d) * tx * tz;
  };
  return { geometry: g, heights, heightAt };
}

/** Diorama skirt: soil strata around the four edges, plus the underside. */
export function buildSkirt(model: TerrainModel): BufferGeometry {
  const nv = NV;
  const pos: number[] = [];
  const col: number[] = [];
  const nor: number[] = [];
  const bands: { y0: number; c: RGB }[] = [
    { y0: 0, c: rgb('#6c9a42') },
    { y0: -0.28, c: rgb('#7a5a3a') },
    { y0: -0.9, c: rgb('#8f6f48') },
    { y0: -1.5, c: rgb('#6e5a47') },
    { y0: -2.0, c: rgb('#8a8173') },
  ];
  const addStrip = (
    get: (t: number) => [number, number, number],
    normal: [number, number, number],
    flip: boolean,
  ) => {
    for (let k = 0; k < nv - 1; k++) {
      const a = get(k);
      const b = get(k + 1);
      // bands top→bottom, using each edge vertex' own height for the top
      let prevA = a[1];
      let prevB = b[1];
      for (let bi = 0; bi < bands.length; bi++) {
        const band = bands[bi]!;
        const nextY = bi + 1 < bands.length ? bands[bi + 1]!.y0 : BASE_Y;
        const yA = bi === 0 ? prevA : Math.min(prevA, band.y0);
        const yB = bi === 0 ? prevB : Math.min(prevB, band.y0);
        const lowA = bi + 1 < bands.length ? Math.min(yA, nextY) : BASE_Y;
        const lowB = bi + 1 < bands.length ? Math.min(yB, nextY) : BASE_Y;
        const jit = 0.92 + h01(k, bi, 7) * 0.16;
        const c = shade(band.c, jit);
        const quad = flip
          ? [
              [a[0], yA, a[2]],
              [b[0], yB, b[2]],
              [b[0], lowB, b[2]],
              [a[0], lowA, a[2]],
            ]
          : [
              [b[0], yB, b[2]],
              [a[0], yA, a[2]],
              [a[0], lowA, a[2]],
              [b[0], lowB, b[2]],
            ];
        const order = [0, 1, 2, 0, 2, 3];
        for (const o of order) {
          pos.push(quad[o]![0]!, quad[o]![1]!, quad[o]![2]!);
          col.push(c[0], c[1], c[2]);
          nor.push(normal[0], normal[1], normal[2]);
        }
        prevA = lowA;
        prevB = lowB;
      }
    }
  };
  const H = model.heights;
  const W = GRID_W;
  addStrip((k) => [k / RES, H[k]!, 0], [0, 0, -1], true); // north edge (z=0)
  addStrip((k) => [k / RES, H[(nv - 1) * nv + k]!, W], [0, 0, 1], false); // south edge
  addStrip((k) => [0, H[k * nv]!, k / RES], [-1, 0, 0], false); // west edge
  addStrip((k) => [W, H[k * nv + nv - 1]!, k / RES], [1, 0, 0], true); // east edge
  // underside
  const floor = rgb('#3a2f26');
  for (const [x, z] of [
    [0, 0],
    [W, 0],
    [W, W],
    [0, 0],
    [W, W],
    [0, W],
  ] as [number, number][]) {
    pos.push(x, BASE_Y, z);
    col.push(floor[0], floor[1], floor[2]);
    nor.push(0, -1, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.computeBoundingSphere();
  return g;
}

/** Water surface sharing the terrain grid: per-vertex depth drives colour, foam and discard. */
export function buildWater(model: TerrainModel): BufferGeometry {
  const nv = NV;
  const pos = new Float32Array(nv * nv * 3);
  const depth = new Float32Array(nv * nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nv; i++) {
      const k = j * nv + i;
      pos[k * 3] = i / RES;
      pos[k * 3 + 1] = WATER_LEVEL;
      pos[k * 3 + 2] = j / RES;
      depth[k] = WATER_LEVEL - model.heights[k]!;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nv - 1; i++) {
      const a = j * nv + i;
      const b = a + 1;
      const c = a + nv;
      const d = c + 1;
      // skip quads that are entirely dry
      if (depth[a]! < -0.06 && depth[b]! < -0.06 && depth[c]! < -0.06 && depth[d]! < -0.06) continue;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new BufferAttribute(depth, 1));
  g.computeBoundingSphere();
  return g;
}
