import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BufferAttribute, BufferGeometry, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { Material } from 'three';
import { GRID_H, GRID_W } from '../engine';
import { store } from '../game/store';
import { atmosphere } from './atmosphere';
import { h01, mix, rgb, shade } from './geo';
import type { RGB } from './geo';
import { hueFor, type FoliageKind } from './Foliage';
import { broadleafGeometry, coniferGeometry, cypressGeometry, birchTreeGeometry } from './models/trees';
import { WATER_LEVEL } from './terrain';
import type { TerrainModel } from './terrain';
import { graphics } from './Post';
import { linkWaterAtmosphere, makeWaterMaterial } from './water';
import { worldModel } from './world';

/**
 * The valley beyond the board: rolling hills and forest that continue past the playable edge and dissolve into haze,
 * with the river carrying on outward. Purely decorative and slightly muted, so the playable valley still reads as the
 * stage. Never pickable, never in the shadow map, rebuilt only when the land changes.
 */

const MIN = -42;
const MAX = GRID_W + 42;
const STEP = 1;
const N = Math.round((MAX - MIN) / STEP) + 1;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
function vnoise(x: number, y: number, seed: number): number {
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
const fbm = (x: number, y: number, seed: number) =>
  vnoise(x, y, seed) * 0.55 +
  vnoise(x * 2.1, y * 2.1, seed + 1) * 0.3 +
  vnoise(x * 4.3, y * 4.3, seed + 2) * 0.15;

const MEADOW = rgb('#7c9449');
const DRY = rgb('#9c9a58');
const FLOOR = rgb('#55703a');
const BANK = rgb('#b3a688');
const BED = rgb('#6f6a4e');

interface Ring {
  ground: BufferGeometry;
  water: BufferGeometry;
  trees: Record<
    'broadleaf' | 'conifer' | 'cypress' | 'birch',
    { x: number; y: number; z: number; rot: number; s: number; tint: number }[]
  >;
}

function insideBoard(x: number, z: number): boolean {
  return x > 0.02 && z > 0.02 && x < GRID_W - 0.02 && z < GRID_H - 0.02;
}

function build(T: TerrainModel, density: number): Ring {
  const pos = new Float32Array(N * N * 3);
  const col = new Float32Array(N * N * 3);
  const hgt = new Float32Array(N * N);
  const depth = new Float32Array(N * N);
  const forestAt = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = MIN + i * STEP;
      const z = MIN + j * STEP;
      const ex = clamp(x, 0, GRID_W);
      const ez = clamp(z, 0, GRID_H);
      const edge = T.heightAt(ex, ez);
      const d = Math.hypot(x - ex, z - ez);
      const river = edge < WATER_LEVEL + 0.05;
      const hills = fbm(x * 0.055, z * 0.055, 401) * 4.6 - 0.4;
      const k = smooth(d / 9);
      // A river leaving the board keeps its bed; everything else rises into hills away from the edge.
      const h =
        (river ? edge + smooth((d - 14) / 20) * 1.5 : edge * (1 - k) + Math.max(0.4, hills) * k) - 0.04;
      const kk = j * N + i;
      hgt[kk] = h;
      depth[kk] = WATER_LEVEL - h;
      pos[kk * 3] = x;
      pos[kk * 3 + 1] = h;
      pos[kk * 3 + 2] = z;
      const forest = smooth((fbm(x * 0.09, z * 0.09, 433) - 0.42) / 0.16);
      forestAt[kk] = forest;
      let c: RGB = mix(MEADOW, DRY, fbm(x * 0.07, z * 0.07, 451) * 0.6);
      c = mix(c, FLOOR, forest * 0.8);
      const bank = smooth(1 - Math.abs(h - (WATER_LEVEL + 0.07)) / 0.12);
      c = mix(c, BANK, bank * 0.6);
      c = mix(c, BED, smooth((WATER_LEVEL - h) / 0.05));
      // out of bounds reads a touch quieter than the stage
      const lum = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
      c = shade(mix(c, [lum, lum, lum], 0.18), 0.93 + vnoise(x * 0.8, z * 0.8, 467) * 0.1);
      col[kk * 3] = c[0];
      col[kk * 3 + 1] = c[1];
      col[kk * 3 + 2] = c[2];
    }
  const idx: number[] = [];
  const widx: number[] = [];
  for (let j = 0; j < N - 1; j++)
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      const cx = MIN + (i + 0.5) * STEP;
      const cz = MIN + (j + 0.5) * STEP;
      if (insideBoard(cx - 0.5, cz - 0.5) && insideBoard(cx + 0.5, cz + 0.5)) continue;
      idx.push(a, c, b, b, c, d);
      if (depth[a]! > -0.06 || depth[b]! > -0.06 || depth[c]! > -0.06 || depth[d]! > -0.06)
        widx.push(a, c, b, b, c, d);
    }
  const ground = new BufferGeometry();
  ground.setIndex(idx);
  ground.setAttribute('position', new BufferAttribute(pos, 3));
  ground.setAttribute('color', new BufferAttribute(col, 3));
  ground.computeVertexNormals();
  const wpos = new Float32Array(N * N * 3);
  for (let k = 0; k < N * N; k++) {
    wpos[k * 3] = pos[k * 3]!;
    wpos[k * 3 + 1] = WATER_LEVEL;
    wpos[k * 3 + 2] = pos[k * 3 + 2]!;
  }
  const water = new BufferGeometry();
  water.setIndex(widx);
  water.setAttribute('position', new BufferAttribute(wpos, 3));
  water.setAttribute('aDepth', new BufferAttribute(depth, 1));

  const trees: Ring['trees'] = { broadleaf: [], conifer: [], cypress: [], birch: [] };
  for (let j = 0; j < N - 1; j++)
    for (let i = 0; i < N - 1; i++) {
      const x0 = MIN + i * STEP;
      const z0 = MIN + j * STEP;
      const ex = clamp(x0, 0, GRID_W);
      const ez = clamp(z0, 0, GRID_H);
      const d = Math.hypot(x0 - ex, z0 - ez);
      if (d < 0.8 || d > 26) continue;
      const kk = j * N + i;
      const f = forestAt[kk]!;
      const n = Math.floor(f * 1.6 * density + h01(i, j, 471));
      for (let t = 0; t < n; t++) {
        const x = x0 + h01(i, j, 480 + t) * STEP;
        const z = z0 + h01(j, i, 490 + t) * STEP;
        if (insideBoard(x, z)) continue;
        const y = hgt[kk]!;
        if (y < WATER_LEVEL + 0.12) continue;
        const r = h01(i * 7 + t, j, 500);
        const kind =
          y > 3
            ? r < 0.6
              ? 'conifer'
              : r < 0.82
                ? 'cypress'
                : 'broadleaf'
            : r < 0.5
              ? 'broadleaf'
              : r < 0.72
                ? 'conifer'
                : r < 0.88
                  ? 'cypress'
                  : 'birch';
        trees[kind].push({
          x,
          y,
          z,
          rot: h01(i, j, 510 + t) * Math.PI * 2,
          s: (0.75 + h01(i, j, 520 + t) * 0.6) * 0.82,
          tint: h01(j, i, 530 + t),
        });
      }
    }
  return { ground, water, trees };
}

const dummy = new Object3D();
const KINDS = ['broadleaf', 'conifer', 'cypress', 'birch'] as const;
const CAP = 2600;

export function Outskirts({ density, crown }: { density: number; crown: Material }) {
  const revs = useSyncExternalStore(
    store.subscribe,
    () => `${store.campaign?.epoch ?? -1}:${store.worldRev}`,
  );
  const ring = useMemo(() => {
    void revs;
    const T = worldModel.terrain;
    return T ? build(T, density) : null;
  }, [revs, density]);
  const groundMat = useMemo(
    () =>
      atmosphere(new MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }), {
        paint: true,
      }),
    [],
  );
  const water = useMemo(() => linkWaterAtmosphere(makeWaterMaterial()), []);
  const geoms = useMemo(
    () => ({
      broadleaf: broadleafGeometry(),
      conifer: coniferGeometry(),
      cypress: cypressGeometry(),
      birch: birchTreeGeometry(),
    }),
    [],
  );
  useEffect(
    () => () => {
      groundMat.dispose();
      water.dispose();
      for (const g of Object.values(geoms)) g.dispose();
    },
    [groundMat, water, geoms],
  );
  const refs = useRef<Partial<Record<(typeof KINDS)[number], InstancedMesh | null>>>({});
  const group = useRef<Group>(null);
  // The frame-time governor's second shed step hides the valley beyond the board.
  useFrame(() => {
    if (group.current) group.current.visible = graphics.shed < 2;
  });
  useEffect(() => {
    if (!ring) return;
    for (const k of KINDS) {
      const m = refs.current[k];
      if (!m) continue;
      const list = ring.trees[k];
      const n = Math.min(list.length, CAP);
      for (let i = 0; i < n; i++) {
        const it = list[i]!;
        dummy.position.set(it.x, it.y - 0.02, it.z);
        dummy.rotation.set(0, it.rot, 0);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        m.setColorAt(i, hueFor(k as FoliageKind, { ...it, sy: undefined }));
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [ring]);
  useEffect(
    () => () => {
      ring?.ground.dispose();
      ring?.water.dispose();
    },
    [ring],
  );
  if (!ring) return null;
  return (
    <group ref={group}>
      <mesh geometry={ring.ground} material={groundMat} receiveShadow={false} />
      <mesh geometry={ring.water} material={water} renderOrder={2} />
      {KINDS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
          }}
          args={[geoms[k], crown, CAP]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
