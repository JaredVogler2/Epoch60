import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { BufferGeometry } from 'three';
import { store } from '../game/store';
import { h01 } from './geo';
import { resolveQuality } from './quality';
import { WATER_LEVEL } from './terrain';
import {
  birchGeometry,
  boulderGeometry,
  bushGeometry,
  flowerGeometry,
  grassGeometry,
  oakGeometry,
  pineGeometry,
  snagGeometry,
} from './models/vegetation';
import { worldModel } from './world';

type Kind = 'pine' | 'oak' | 'birch' | 'bush' | 'snag' | 'boulder' | 'grass' | 'flower';

interface Inst {
  x: number;
  y: number;
  z: number;
  rot: number;
  s: number;
  tint: number;
  sy?: number;
}

const CAP: Record<Kind, number> = {
  pine: 3400,
  oak: 3400,
  birch: 2200,
  bush: 2600,
  snag: 1200,
  boulder: 700,
  grass: 9000,
  flower: 2200,
};

/** Smooth value noise in [0,1) for glades. */
function glen(x: number, y: number): number {
  const fx = x * 0.3;
  const fy = y * 0.3;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = h01(ix, iy, 71);
  const b = h01(ix + 1, iy, 71);
  const c = h01(ix, iy + 1, 71);
  const d = h01(ix + 1, iy + 1, 71);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Derive every plant and stone to draw from the persistent world fields. Pure + deterministic per world state. */
export function scatter(quality: { foliage: number; grass: number }): Record<Kind, Inst[]> {
  const c = store.campaign!;
  const w = c.world;
  const T = worldModel.terrain!;
  const out: Record<Kind, Inst[]> = {
    pine: [],
    oak: [],
    birch: [],
    bush: [],
    snag: [],
    boulder: [],
    grass: [],
    flower: [],
  };
  // Mask: cells with something built on/near them stay clear (a yard of bare ground).
  const built = new Uint8Array(w.w * w.h);
  for (const s of c.structures) {
    const rubble = s.status === 'rubble' || s.status === 'buried';
    for (let j = -1; j <= s.h; j++) {
      for (let i = -1; i <= s.w; i++) {
        const x = s.x + i;
        const y = s.y + j;
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) continue;
        const inside = i >= 0 && j >= 0 && i < s.w && j < s.h;
        const k = y * w.w + x;
        built[k] = Math.max(built[k]!, rubble ? (inside ? 1 : 0) : inside ? 2 : 1);
      }
    }
  }
  for (let cy = 0; cy < w.h; cy++) {
    for (let cx = 0; cx < w.w; cx++) {
      const k = cy * w.w + cx;
      if (w.water[k]) continue;
      const hcell = w.height[k]! / 100;
      const forest = w.forest[k]! / 1000;
      const scar = w.scar[k]! / 1000;
      const fert = w.fertility[k]! / 1000;
      const rock = w.rock[k]!;
      const clear = built[k]!;
      const seed = k * 13 + 7;
      const place = (kind: Kind, jx: number, jy: number, s: number, sy?: number) => {
        const x = cx + 0.5 + jx;
        const z = cy + 0.5 + jy;
        const y = T.heightAt(x, z);
        out[kind].push({
          x,
          y,
          z,
          rot: h01(seed, out[kind].length, 3) * Math.PI * 2,
          s,
          tint: h01(seed, out[kind].length, 4),
          sy,
        });
      };
      if (clear === 2) continue;
      // Trees.
      if (!clear && rock === 0) {
        const burnt = scar > 0.45;
        // natural clearings: low-frequency noise carves glades out of continuous forest
        const glade = glen(cx, cy);
        const open = forest < 0.92 && glade > 0.6 ? 0.25 : 1;
        const nTrees = Math.floor(forest * 2.5 * open * quality.foliage + h01(seed, 1, 1));
        for (let t = 0; t < nTrees; t++) {
          const jx = (h01(seed, t, 5) - 0.5) * 0.9;
          const jy = (h01(seed, t, 6) - 0.5) * 0.9;
          const r = h01(seed, t, 7);
          const sc = 0.72 + h01(seed, t, 8) * 0.55 + forest * 0.25;
          if (burnt) {
            if (r < 0.35) place('snag', jx, jy, sc * 0.9);
            continue;
          }
          const hi = hcell > 3.4;
          const low = hcell < 1.1;
          let kind: Kind;
          if (hi) kind = r < 0.78 ? 'pine' : r < 0.92 ? 'birch' : 'oak';
          else if (low) kind = r < 0.5 ? 'oak' : r < 0.85 ? 'birch' : 'pine';
          else kind = r < 0.38 ? 'oak' : r < 0.74 ? 'pine' : 'birch';
          place(kind, jx, jy, sc);
        }
        // Understorey bushes
        if (forest > 0.15 && h01(seed, 9, 9) < forest * 0.7 * quality.foliage)
          place(
            'bush',
            (h01(seed, 9, 1) - 0.5) * 0.8,
            (h01(seed, 9, 2) - 0.5) * 0.8,
            0.8 + h01(seed, 9, 3) * 0.6,
          );
      }
      // Boulders on stone ground and scattered on high slopes
      if (rock > 0 && !clear && h01(seed, 11, 1) < 0.8)
        place(
          'boulder',
          (h01(seed, 11, 2) - 0.5) * 0.6,
          (h01(seed, 11, 3) - 0.5) * 0.6,
          0.7 + h01(seed, 11, 4) * 0.9,
        );
      else if (!clear && hcell > 3 && h01(seed, 12, 1) < 0.06)
        place(
          'boulder',
          (h01(seed, 12, 2) - 0.5) * 0.8,
          (h01(seed, 12, 3) - 0.5) * 0.8,
          0.5 + h01(seed, 12, 4) * 0.7,
        );
      // Grass tufts and flowers on open ground
      if (!clear && rock === 0 && forest < 0.7 && hcell > WATER_LEVEL * 100 + 0.1 && scar < 0.3) {
        const n = Math.round((2 + fert * 4) * (1 - forest) * quality.grass);
        for (let t = 0; t < n; t++)
          place(
            'grass',
            (h01(seed, 20 + t, 1) - 0.5) * 0.95,
            (h01(seed, 20 + t, 2) - 0.5) * 0.95,
            0.8 + h01(seed, 20 + t, 3) * 0.7,
          );
        if (fert > 0.5 && forest < 0.2 && h01(seed, 30, 1) < 0.35 * quality.grass)
          place(
            'flower',
            (h01(seed, 30, 2) - 0.5) * 0.8,
            (h01(seed, 30, 3) - 0.5) * 0.8,
            0.9 + h01(seed, 30, 4) * 0.5,
          );
      }
      // Scorched ground: sparse charred stubble
      if (!clear && scar > 0.45 && rock === 0 && h01(seed, 40, 1) < 0.25)
        place(
          'snag',
          (h01(seed, 40, 2) - 0.5) * 0.8,
          (h01(seed, 40, 3) - 0.5) * 0.8,
          0.5 + h01(seed, 40, 4) * 0.4,
        );
    }
  }
  return out;
}

const dummy = new Object3D();
const tintA = new Color();

function fill(mesh: InstancedMesh, list: Inst[], base: Color, spread: number): void {
  const n = Math.min(list.length, mesh.instanceMatrix.count);
  for (let i = 0; i < n; i++) {
    const it = list[i]!;
    dummy.position.set(it.x, it.y - 0.02, it.z);
    dummy.rotation.set(0, it.rot, 0);
    dummy.scale.set(it.s, it.sy ?? it.s, it.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tintA.copy(base).multiplyScalar(1 - spread + it.tint * spread * 2);
    mesh.setColorAt(i, tintA);
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function useRevs(): string {
  return useSyncExternalStore(
    store.subscribe,
    () => `${store.campaign?.epoch ?? -1}:${store.worldRev}:${store.structRev}`,
  );
}

const FLOWER_COLORS = ['#f4efe2', '#f0c24a', '#d96a8a', '#9a8de0'];

export function Foliage() {
  const revs = useRevs();
  const quality = useMemo(() => resolveQuality(store.settings.quality), []);
  const refs = useRef<Partial<Record<Kind, InstancedMesh | null>>>({});
  const geoms = useMemo<Record<Kind, BufferGeometry>>(
    () => ({
      pine: pineGeometry(),
      oak: oakGeometry(),
      birch: birchGeometry(),
      bush: bushGeometry(),
      snag: snagGeometry(),
      boulder: boulderGeometry(),
      grass: grassGeometry(),
      flower: flowerGeometry(),
    }),
    [],
  );
  const mat = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    [],
  );

  useEffect(() => {
    if (!store.campaign || !worldModel.terrain) return;
    const lists = scatter(quality);
    for (const kind of Object.keys(lists) as Kind[]) {
      const m = refs.current[kind];
      if (!m) continue;
      const spread = kind === 'grass' ? 0.22 : 0.14;
      fill(m, lists[kind], new Color(1, 1, 1), spread);
      if (kind === 'flower') {
        const list = lists.flower;
        for (let i = 0; i < Math.min(list.length, m.instanceMatrix.count); i++) {
          tintA.set(FLOWER_COLORS[Math.floor(list[i]!.tint * FLOWER_COLORS.length) % FLOWER_COLORS.length]!);
          m.setColorAt(i, tintA);
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  }, [revs, quality]);

  const kinds: Kind[] = ['pine', 'oak', 'birch', 'bush', 'snag', 'boulder', 'grass', 'flower'];
  return (
    <group>
      {kinds.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            refs.current[k] = m;
          }}
          args={[geoms[k], mat, CAP[k]]}
          castShadow={k !== 'grass' && k !== 'flower'}
          receiveShadow={k !== 'grass'}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
