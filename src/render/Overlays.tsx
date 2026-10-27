import { useFrame } from '@react-three/fiber';
import { useMemo, useSyncExternalStore } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { BUILDINGS, footprint } from '../engine';
import type { BuildingKind, HazardKind, Structure } from '../engine';
import { store } from '../game/store';
import { buildingModel } from './models/buildings';
import type { BuildingModel } from './models/buildings';
import { groundY } from './world';

/* ------------------------------------------------------------------ */
/* Decal shader: terrain-hugging translucent marks                     */
/* ------------------------------------------------------------------ */

const decalVert = /* glsl */ `
attribute vec2 aUv;
attribute float aVal;
varying vec2 vUv;
varying float vVal;
varying vec3 vWorld;
void main() {
  vUv = aUv;
  vVal = aVal;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const decalFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uMode;
uniform float uAlpha;
varying vec2 vUv;
varying float vVal;
varying vec3 vWorld;
void main() {
  float stripe = step(0.5, fract((vWorld.x + vWorld.z) * 2.2 - uTime * 0.25));
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float border = 1.0 - smoothstep(0.0, 0.07, edge);
  float pulse = 0.78 + 0.22 * sin(uTime * 4.0);
  float a;
  if (uMode < 0.5) {            // hazard forecast: striped, stronger where intense
    a = (0.20 + 0.30 * vVal) * (0.55 + 0.45 * stripe);
  } else if (uMode < 1.5) {     // valid placement: soft fill + crisp border
    a = 0.28 + 0.6 * border;
  } else if (uMode < 2.5) {     // invalid: hatched fill + border
    a = (0.22 + 0.3 * stripe) + 0.55 * border;
  } else if (uMode < 3.5) {     // selection ring
    a = border * (0.7 + 0.3 * pulse);
  } else {                      // at-risk marker
    a = (0.18 + 0.55 * border) * pulse;
  }
  gl_FragColor = vec4(uColor, a * uAlpha);
  #include <colorspace_fragment>
}
`;

function decalMaterial(color: string, mode: number, alpha = 1): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: decalVert,
    fragmentShader: decalFrag,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uColor: { value: new Color(color) },
      uTime: { value: 0 },
      uMode: { value: mode },
      uAlpha: { value: alpha },
    },
  });
}

const HAZARD_COLORS: Record<HazardKind, string> = { fire: '#ff5a1f', flood: '#2f86ff', quake: '#b36bff' };

/** A rectangle draped over the terrain. */
function rectDecal(x: number, y: number, w: number, h: number, lift: number): BufferGeometry {
  const nx = Math.max(2, Math.ceil(w * 3));
  const nz = Math.max(2, Math.ceil(h * 3));
  const pos: number[] = [];
  const uv: number[] = [];
  const val: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const px = x + (i / nx) * w;
      const pz = y + (j / nz) * h;
      pos.push(px, groundY(px, pz) + lift, pz);
      uv.push(i / nx, j / nz);
      val.push(1);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aVal', new BufferAttribute(new Float32Array(val), 1));
  return g;
}

function useRevs(): string {
  return useSyncExternalStore(store.subscribe, () => `${store.version}`);
}

/* ------------------------------------------------------------------ */
/* Hazard forecast on the terrain                                      */
/* ------------------------------------------------------------------ */

function forecastGeometry(cells: { x: number; y: number; intensity: number }[]): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const val: number[] = [];
  const S = 2;
  for (const c of cells) {
    const v = Math.min(1, c.intensity / 1000);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x0 = c.x + i / S;
        const x1 = c.x + (i + 1) / S;
        const z0 = c.y + j / S;
        const z1 = c.y + (j + 1) / S;
        const p = (x: number, z: number) => [x, groundY(x, z) + 0.06, z];
        const a = p(x0, z0);
        const b = p(x1, z0);
        const d = p(x1, z1);
        const e = p(x0, z1);
        for (const q of [a, e, b, b, e, d]) {
          pos.push(q[0]!, q[1]!, q[2]!);
          uv.push(0.5, 0.5);
          val.push(v);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aVal', new BufferAttribute(new Float32Array(val), 1));
  return g;
}

export function ForecastOverlay() {
  useRevs();
  const c = store.campaign;
  const show =
    !!c && store.screen === 'game' && store.showForecast && (c.phase === 'PREPARE' || c.phase === 'ACTIVE');
  const f = show ? store.getForecastCached() : null;
  const geom = useMemo(() => (f ? forecastGeometry(f.predicted.cells) : null), [f]);
  const mat = useMemo(() => decalMaterial(HAZARD_COLORS[f?.kind ?? 'fire'], 0), [f?.kind]);
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    // Urgency: the overlay brightens as the clock runs down.
    const urgent = c && c.phase === 'ACTIVE' ? Math.min(1, Math.max(0, (c.tick - 350) / 250)) : 0;
    mat.uniforms.uAlpha!.value = 0.8 + 0.5 * urgent;
  });
  if (!geom || !f) return null;
  return <mesh geometry={geom} material={mat} renderOrder={3} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Placement ghost, plan markers, selection, risk                      */
/* ------------------------------------------------------------------ */

const ghostModels = new Map<string, BuildingModel>();
function ghostModel(kind: BuildingKind, rot: 0 | 1): BuildingModel {
  const key = `${kind}:${rot}`;
  let m = ghostModels.get(key);
  if (!m) {
    const { w, h } = footprint(kind, rot);
    m = buildingModel(kind, w, h, 0, 77);
    ghostModels.set(key, m);
  }
  return m;
}

function GhostBuilding({
  kind,
  rot,
  x,
  y,
  tint,
  opacity,
  lift = 0,
}: {
  kind: BuildingKind;
  rot: 0 | 1;
  x: number;
  y: number;
  tint: string;
  opacity: number;
  lift?: number;
}) {
  const model = ghostModel(kind, rot);
  const { w, h } = footprint(kind, rot);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        emissive: new Color(tint),
        emissiveIntensity: 0.4,
        roughness: 0.9,
      }),
    [opacity, tint],
  );
  const cx = x + w / 2;
  const cz = y + h / 2;
  return (
    <mesh geometry={model.main} material={mat} position={[cx, groundY(cx, cz) + lift, cz]} renderOrder={4} />
  );
}

function Decal({
  x,
  y,
  w,
  h,
  color,
  mode,
  alpha = 1,
  lift = 0.07,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  mode: number;
  alpha?: number;
  lift?: number;
}) {
  const geom = useMemo(() => rectDecal(x, y, w, h, lift), [x, y, w, h, lift]);
  const mat = useMemo(() => decalMaterial(color, mode, alpha), [color, mode, alpha]);
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
  });
  return <mesh geometry={geom} material={mat} renderOrder={5} frustumCulled={false} />;
}

export function PlacementGhost() {
  useRevs();
  const p = store.placing;
  const g = store.ghost;
  if (!p || p.x === null || p.y === null) return null;
  const { w, h } = footprint(p.kind, p.rot);
  const ok = !!g && g.ok;
  return (
    <group>
      <GhostBuilding
        kind={p.kind}
        rot={p.rot}
        x={p.x}
        y={p.y}
        tint={ok ? '#58e07a' : '#ff5a4a'}
        opacity={ok ? 0.62 : 0.5}
        lift={0.04}
      />
      <Decal x={p.x} y={p.y} w={w} h={h} color={ok ? '#4be38a' : '#ff4b3a'} mode={ok ? 1 : 2} />
    </group>
  );
}

export function PlannedMarkers() {
  useRevs();
  const c = store.campaign;
  if (!c) return null;
  const items = c.queue.filter((q) => q.action.type === 'build');
  return (
    <group>
      {items.map((q) => {
        if (q.action.type !== 'build') return null;
        const { w, h } = footprint(q.action.kind, q.action.rot);
        return (
          <group key={q.seq}>
            <GhostBuilding
              kind={q.action.kind}
              rot={q.action.rot}
              x={q.action.x}
              y={q.action.y}
              tint="#6aa8ff"
              opacity={0.5}
              lift={0.02}
            />
            <Decal x={q.action.x} y={q.action.y} w={w} h={h} color="#6aa8ff" mode={1} alpha={0.8} />
          </group>
        );
      })}
    </group>
  );
}

export function SelectionRing() {
  useRevs();
  const c = store.campaign;
  const s: Structure | undefined =
    c && store.selectedId !== null ? c.structures.find((st) => st.id === store.selectedId) : undefined;
  if (!s) return null;
  return (
    <Decal x={s.x - 0.1} y={s.y - 0.1} w={s.w + 0.2} h={s.h + 0.2} color="#ffd25a" mode={3} lift={0.09} />
  );
}

/** Pulsing markers on buildings the coming hazard will damage or destroy. */
export function RiskMarkers() {
  useRevs();
  const c = store.campaign;
  const show =
    !!c && store.screen === 'game' && store.showForecast && (c.phase === 'PREPARE' || c.phase === 'ACTIVE');
  const f = show ? store.getForecastCached() : null;
  if (!f) return null;
  const at = f.predicted.impacts.filter(
    (i) => i.after !== 'active' && !!c!.structures.find((s) => s.id === i.id),
  );
  return (
    <group>
      {at.map((i) => {
        const s = c!.structures.find((st) => st.id === i.id)!;
        const d = BUILDINGS[s.kind];
        void d;
        return (
          <Decal
            key={i.id}
            x={s.x - 0.15}
            y={s.y - 0.15}
            w={s.w + 0.3}
            h={s.h + 0.3}
            color={i.after === 'rubble' ? '#ff3b2f' : '#ffb02e'}
            mode={4}
            lift={0.1}
          />
        );
      })}
    </group>
  );
}
