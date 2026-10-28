import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  Object3D,
  PointsMaterial,
} from 'three';
import type { LineSegments, Points } from 'three';
import { GRID_H, GRID_W, epochSpec } from '../engine';
import type { Forecast, HazardCell, HazardKind } from '../engine';
import { store } from '../game/store';
import { h01 } from './geo';
import { puffGeometry, smokeMaterial } from './SmokeField';
import { groundY } from './world';

/**
 * What the coming catastrophe shows of itself before it strikes. From 30 s left the age's own hazard grows in the world
 * as well as in the warnings: smoke rising where the fire will start, leaning with its wind, and embers drifting over
 * the valley; rain over a valley about to flood; dust shaken off the ground around a quake's epicentre. (An ashfall
 * already shows its falling ash.) Everything comes from the engine (the age's hazard, its origin and wind, the clock),
 * nothing changes the game, and reduced motion slows it all.
 */

/** 0 until 30 s left, full at 3 s left; fades during the collapse, whose cinematic takes over. */
export function omenStrength(phase: string, tick: number): number {
  if (phase === 'ACTIVE') return Math.min(1, Math.max(0, (tick - 300) / 270));
  return 0;
}

/** What the omens are drawing this frame (debug and browser tests only; nothing in the game reads it). */
export const omensApi: { state: () => { kind: HazardKind | null; strength: number; drawn: string[] } } = {
  state: () => ({ kind: null, strength: 0, drawn: [] }),
};

const SMOKE_PUFFS = 40;
const EMBERS = 160;
const DROPS = 900;
const DUST_PUFFS = 48;

const dummy = new Object3D();
const tint = new Color();
const SMOKE_DARK = new Color('#6a615a');
const SMOKE_PALE = new Color('#c4bcb2');
const DUST = new Color('#cdb994');

export function Omens({ density = 1 }: { density?: number }) {
  const strength = useRef(0);
  const kindRef = useRef<HazardKind | null>(null);

  // Fire: a leaning smoke column of soft puffs, and embers.
  const smokeAlpha = useMemo(() => {
    const a = new InstancedBufferAttribute(new Float32Array(SMOKE_PUFFS), 1);
    a.setUsage(DynamicDrawUsage);
    return a;
  }, []);
  const smokeGeo = useMemo(() => puffGeometry(smokeAlpha), [smokeAlpha]);
  const smokeMat = useMemo(() => smokeMaterial('#4a423c', 0.4), []);
  const smoke = useRef<InstancedMesh>(null);
  const emberGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(EMBERS * 3), 3));
    return g;
  }, []);
  const emberMat = useMemo(
    () =>
      new PointsMaterial({
        color: '#ff8a2a',
        size: 0.11,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const embers = useRef<Points>(null);

  // Flood: slanting rain over the board.
  const rainGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(DROPS * 6), 3));
    return g;
  }, []);
  const rainMat = useMemo(
    () => new LineBasicMaterial({ color: '#c9d6e2', transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const rain = useRef<LineSegments>(null);

  // Quake: dust puffs shaken up around the epicentre.
  const dustAlpha = useMemo(() => {
    const a = new InstancedBufferAttribute(new Float32Array(DUST_PUFFS), 1);
    a.setUsage(DynamicDrawUsage);
    return a;
  }, []);
  const dustGeo = useMemo(() => puffGeometry(dustAlpha), [dustAlpha]);
  const dustMat = useMemo(() => smokeMaterial('#8a7a5e', 0.5), []);
  const dust = useRef<InstancedMesh>(null);
  // Where the quake will shake, from the forecast (recomputed only when the forecast changes).
  const shaken = useRef<{ f: Forecast | null; cells: HazardCell[] }>({ f: null, cells: [] });

  useEffect(
    () => () => {
      for (const d of [smokeGeo, smokeMat, emberGeo, emberMat, rainGeo, rainMat, dustGeo, dustMat])
        d.dispose();
    },
    [smokeGeo, smokeMat, emberGeo, emberMat, rainGeo, rainMat, dustGeo, dustMat],
  );
  useEffect(() => {
    omensApi.state = () => {
      const drawn: string[] = [];
      if (smoke.current?.visible) drawn.push('smoke');
      if (embers.current?.visible) drawn.push('embers');
      if (rain.current?.visible) drawn.push('rain');
      if (dust.current?.visible) drawn.push('dust');
      return { kind: kindRef.current, strength: strength.current, drawn };
    };
    return () => {
      omensApi.state = () => ({ kind: null, strength: 0, drawn: [] });
    };
  }, []);

  useFrame((state, dtRaw) => {
    const c = store.campaign;
    const dt = Math.min(dtRaw, 0.1);
    let target = 0;
    let kind: HazardKind | null = null;
    if (c && store.screen === 'game') {
      kind = epochSpec(c, c.epoch).hazard.kind;
      target = omenStrength(c.phase, c.tick);
    }
    // Ease in and out, but jump to the clock's value when it jumps (a reload or a fast-forward), so a still is truthful.
    const k0 = strength.current;
    strength.current = Math.abs(target - k0) > 0.2 ? target : k0 + (target - k0) * Math.min(1, dt * 2);
    if (kind !== kindRef.current) {
      kindRef.current = kind;
      strength.current = target;
    }
    const k = strength.current;
    const reduced = store.settings.reducedMotion;
    const t = state.clock.elapsedTime * (reduced ? 0.25 : 1);
    const w = c?.world.anchors;

    // ---- fire ----
    const fire = kind === 'fire' && k > 0.01 && !!w;
    if (smoke.current) smoke.current.visible = fire;
    if (embers.current) embers.current.visible = fire;
    if (fire && smoke.current && embers.current) {
      const ox = w.fireOrigin.x + 0.5;
      const oz = w.fireOrigin.y + 0.5;
      const oy = groundY(ox, oz);
      const len = Math.hypot(w.wind.dx, w.wind.dy) || 1;
      const wx = w.wind.dx / len;
      const wz = w.wind.dy / len;
      const n = Math.round(SMOKE_PUFFS * Math.min(1, 0.35 + k));
      for (let i = 0; i < n; i++) {
        const u = (t * 0.07 + i / SMOKE_PUFFS + h01(i, 1, 41) * 0.05) % 1;
        const rise = u * (3.2 + k * 4.5);
        const lean = u * u * (2.5 + k * 3.5);
        const wob = Math.sin(t * 0.6 + i * 1.9) * 0.25 * u;
        dummy.position.set(ox + wx * lean + wob, oy + 0.3 + rise, oz + wz * lean - wob * 0.5);
        const s = (0.3 + u * (0.8 + k * 0.8)) * (0.8 + h01(i, 2, 41) * 0.4);
        dummy.scale.set(s, s * 0.8, s);
        dummy.updateMatrix();
        smoke.current.setMatrixAt(i, dummy.matrix);
        smoke.current.setColorAt(i, tint.copy(SMOKE_DARK).lerp(SMOKE_PALE, u * 0.7));
        smokeAlpha.setX(i, Math.min(1, u / 0.1) * (1 - u) * (0.3 + 0.25 * k));
      }
      smoke.current.count = n;
      smoke.current.instanceMatrix.needsUpdate = true;
      if (smoke.current.instanceColor) smoke.current.instanceColor.needsUpdate = true;
      smokeAlpha.needsUpdate = true;

      // Embers: lifted from around the origin, carried downwind over the valley, flickering out.
      const a = emberGeo.getAttribute('position') as BufferAttribute;
      const shown = Math.round(EMBERS * Math.min(1, density) * k);
      for (let i = 0; i < EMBERS; i++) {
        if (i >= shown) {
          a.setXYZ(i, 0, -50, 0);
          continue;
        }
        const life = (t * (0.11 + h01(i, 3, 43) * 0.06) + h01(i, 4, 43)) % 1;
        const r = h01(i, 5, 43) * 3;
        const ang = h01(i, 6, 43) * Math.PI * 2;
        const reach = life * (6 + k * 10);
        a.setXYZ(
          i,
          ox + Math.cos(ang) * r + wx * reach + Math.sin(t * 2 + i) * 0.15,
          oy + 0.4 + life * (2.5 + h01(i, 7, 43) * 3) - life * life * 2,
          oz + Math.sin(ang) * r + wz * reach + Math.cos(t * 1.7 + i) * 0.15,
        );
      }
      a.needsUpdate = true;
      emberMat.opacity = 0.9 * Math.min(1, k * 1.5) * (0.75 + 0.25 * Math.sin(t * 9));
    }

    // ---- flood ----
    const wet = kind === 'flood' && k > 0.01;
    if (rain.current) rain.current.visible = wet;
    if (wet) {
      const a = rainGeo.getAttribute('position') as BufferAttribute;
      const shown = Math.round(DROPS * Math.min(1, density) * (0.25 + 0.75 * k));
      const fall = reduced ? 2.5 : 9;
      for (let i = 0; i < DROPS; i++) {
        if (i >= shown) {
          a.setXYZ(i * 2, 0, -50, 0);
          a.setXYZ(i * 2 + 1, 0, -50, 0);
          continue;
        }
        const x = h01(i, 1, 47) * (GRID_W + 8) - 4;
        const z = h01(i, 2, 47) * (GRID_H + 8) - 4;
        const y = 12 - ((t * fall + h01(i, 3, 47) * 12) % 12);
        a.setXYZ(i * 2, x, y, z);
        a.setXYZ(i * 2 + 1, x - 0.12, y - 0.45, z + 0.06);
      }
      a.needsUpdate = true;
      rainMat.opacity = 0.42 * k + 0.08;
    }

    // ---- quake ----
    const shaking = kind === 'quake' && k > 0.01 && !!w;
    if (dust.current) dust.current.visible = shaking;
    if (shaking && dust.current) {
      const f = store.getForecastCached();
      if (f !== shaken.current.f) {
        // Every cell the quake will shake noticeably (not only the epicentre, often far from the village).
        const cells = f && f.kind === 'quake' ? f.predicted.cells.filter((h) => h.intensity >= 200) : [];
        shaken.current = { f, cells };
      }
      const cells = shaken.current.cells;
      // Bursts: each puff belongs to a tremor that comes back every few seconds, more of them as it nears, thrown up
      // where the ground will shake (or around the epicentre when nothing is forecast) and clear of the canopy.
      const n = Math.round(DUST_PUFFS * (0.3 + 0.7 * k));
      for (let i = 0; i < n; i++) {
        const period = 3.2 + h01(i, 1, 53) * 2.5;
        const phase = t + h01(i, 2, 53) * period;
        const cycle = Math.floor(phase / period);
        const u = (phase % period) / period;
        let x: number;
        let z: number;
        if (cells.length) {
          const cell = cells[Math.floor(h01(i, cycle, 54) * cells.length)]!;
          x = cell.x + 0.2 + h01(cycle, i, 55) * 0.6;
          z = cell.y + 0.2 + h01(cycle, i, 56) * 0.6;
        } else {
          const ang = h01(i, cycle, 54) * Math.PI * 2;
          const r = 1 + h01(cycle, i, 55) * (3 + k * 5);
          x = w.quakeEpicenter.x + 0.5 + Math.cos(ang) * r;
          z = w.quakeEpicenter.y + 0.5 + Math.sin(ang) * r;
        }
        dummy.position.set(x, groundY(x, z) + 0.4 + u * 2.4, z);
        const s = 0.35 + u * 1.25;
        dummy.scale.set(s, s * 0.65, s);
        dummy.updateMatrix();
        dust.current.setMatrixAt(i, dummy.matrix);
        dust.current.setColorAt(i, DUST);
        dustAlpha.setX(i, Math.min(1, u / 0.08) * (1 - u) * 0.6 * Math.min(1, 0.4 + k));
      }
      dust.current.count = n;
      dust.current.instanceMatrix.needsUpdate = true;
      if (dust.current.instanceColor) dust.current.instanceColor.needsUpdate = true;
      dustAlpha.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={smoke}
        args={[smokeGeo, smokeMat, SMOKE_PUFFS]}
        frustumCulled={false}
        renderOrder={5}
        visible={false}
      />
      <points
        ref={embers}
        geometry={emberGeo}
        material={emberMat}
        frustumCulled={false}
        renderOrder={6}
        visible={false}
      />
      <lineSegments
        ref={rain}
        geometry={rainGeo}
        material={rainMat}
        frustumCulled={false}
        renderOrder={6}
        visible={false}
      />
      <instancedMesh
        ref={dust}
        args={[dustGeo, dustMat, DUST_PUFFS]}
        frustumCulled={false}
        renderOrder={5}
        visible={false}
      />
    </group>
  );
}
