import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { GRID_W } from '../engine';
import { store } from '../game/store';
import { h01 } from './geo';
import {
  FRONT_END,
  beginPresentation,
  endPresentation,
  frontOf,
  presentation,
  rebuildWorld,
} from './presentation';
import { groundY } from './world';

/* ------------------------------------------------------------------ */
/* Director: advances the read-only presentation clock                  */
/* ------------------------------------------------------------------ */

const REBUILD_STEP = 0.025;

export function CollapseDirector() {
  const last = useRef(-1);
  useFrame((state) => {
    const c = store.campaign;
    const running = !!c && store.screen === 'game' && c.phase === 'COLLAPSING' && !!c.report;
    if (!running) {
      if (presentation.active) {
        endPresentation();
        store.bump();
      }
      last.current = -1;
      return;
    }
    const reduced = store.settings.reducedMotion;
    if (!presentation.active) {
      beginPresentation(c, state.clock.elapsedTime, reduced ? 0.4 : 5.5);
      last.current = -1;
    }
    const raw = (state.clock.elapsedTime - presentation.startedAt) / presentation.duration;
    const t =
      presentation.override !== null
        ? presentation.override
        : store.skipRequested
          ? 1
          : Math.min(1, Math.max(0, raw));
    presentation.t = t;
    presentation.front = frontOf(t);
    if (Math.abs(presentation.front - last.current) >= REBUILD_STEP || (t >= 1 && last.current !== 1)) {
      last.current = t >= 1 ? 1 : presentation.front;
      rebuildWorld(c);
      store.bump();
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Hazard front overlay                                                */
/* ------------------------------------------------------------------ */

const vert = /* glsl */ `
attribute float aArr;
attribute float aVal;
attribute float aDepth;
uniform float uFront;
uniform float uMode;
varying float vArr;
varying float vVal;
varying float vK;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  float k = 0.0;
  if (uMode > 0.5 && uMode < 1.5) {
    k = smoothstep(aArr, aArr + 0.2, uFront);
    p.y = mix(position.y, max(position.y, aDepth), k);
  }
  vArr = aArr;
  vVal = aVal;
  vK = k;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const frag = /* glsl */ `
uniform float uFront;
uniform float uMode;
uniform float uTime;
uniform float uAlpha;
varying float vArr;
varying float vVal;
varying float vK;
varying vec3 vWorld;
void main() {
  if (uMode < 0.5) {
    // patchy, irregular front: each quarter-cell burns slightly earlier or later
    vec2 q = floor(vWorld.xz * 4.0);
    float n = fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453);
    float d = uFront - (vArr + (n - 0.5) * 0.07);
    if (d < 0.0) discard;
    float fresh = 1.0 - smoothstep(0.0, 0.09, d);
    float glow = 1.0 - smoothstep(0.0, 0.3, d);
    float flick = 0.6 + 0.4 * sin(uTime * 14.0 + n * 40.0);
    vec3 ember = mix(vec3(0.62, 0.07, 0.01), vec3(1.0, 0.42, 0.05), flick * fresh);
    ember = mix(ember, vec3(1.0, 0.7, 0.2), fresh * fresh * flick * 0.6);
    vec3 charc = mix(vec3(0.06, 0.045, 0.035), vec3(0.28, 0.07, 0.02), glow * n);
    vec3 col = mix(charc, ember, fresh);
    float alpha = mix(0.32, 0.88, max(fresh, glow * 0.5)) * uAlpha;
    gl_FragColor = vec4(col, alpha);
  } else if (uMode < 1.5) {
    if (vK <= 0.003) discard;
    float r1 = sin(vWorld.x * 6.0 + vWorld.z * 4.0 - uTime * 1.8);
    float r2 = sin(vWorld.z * 8.0 - vWorld.x * 3.0 + uTime * 2.2);
    vec3 base = mix(vec3(0.33, 0.6, 0.66), vec3(0.16, 0.38, 0.5), clamp(vVal * 1.4, 0.0, 1.0));
    vec3 col = base + 0.06 * (r1 + r2) + vec3(0.04, 0.05, 0.05) * smoothstep(0.0, 0.4, vK);
    gl_FragColor = vec4(col, 0.78 * smoothstep(0.0, 0.25, vK) * uAlpha);
  } else {
    float ring = smoothstep(0.08, 0.0, abs(uFront - vArr));
    float after = step(vArr, uFront);
    float stripe = step(0.5, fract((vWorld.x * 1.3 - vWorld.z * 0.9) * 2.2));
    vec3 col = mix(vec3(0.62, 0.45, 0.85), vec3(0.95, 0.85, 0.7), ring);
    gl_FragColor = vec4(col, (ring * 0.85 + after * vVal * 0.28 * (0.5 + 0.5 * stripe)) * uAlpha);
  }
  #include <colorspace_fragment>
}
`;

function buildFrontGeometry(): BufferGeometry | null {
  const r = presentation.report;
  if (!r) return null;
  const span = Math.max(1, r.result.span);
  const pos: number[] = [];
  const arr: number[] = [];
  const val: number[] = [];
  const dep: number[] = [];
  const S = 2;
  const flood = r.hazard === 'flood';
  // Flood water is one continuous surface: head = ground + depth at each flooded cell centre, smoothed bilinearly.
  const head = new Map<number, number>();
  if (flood) {
    for (const cell of r.result.cells) {
      head.set(
        cell.y * GRID_W + cell.x,
        groundY(cell.x + 0.5, cell.y + 0.5) + Math.max(0.03, cell.intensity / 4 / 100),
      );
    }
  }
  const headAt = (x: number, z: number): number => {
    const gx = x - 0.5;
    const gz = z - 0.5;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const tx = gx - ix;
    const tz = gz - iz;
    const g = (cx: number, cz: number) => head.get(cz * GRID_W + cx) ?? groundY(cx + 0.5, cz + 0.5);
    const a = g(ix, iz);
    const b = g(ix + 1, iz);
    const c = g(ix, iz + 1);
    const d = g(ix + 1, iz + 1);
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };
  for (const cell of r.result.cells) {
    const a = cell.arrival / span;
    const v = Math.min(1, cell.intensity / 1000);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x0 = cell.x + i / S;
        const x1 = cell.x + (i + 1) / S;
        const z0 = cell.y + j / S;
        const z1 = cell.y + (j + 1) / S;
        const lift = flood ? 0.02 : 0.07;
        const P = (x: number, z: number): [number, number, number, number] => [
          x,
          groundY(x, z) + lift,
          z,
          flood ? headAt(x, z) : 0,
        ];
        const a0 = P(x0, z0);
        const a1 = P(x1, z0);
        const a2 = P(x1, z1);
        const a3 = P(x0, z1);
        for (const q of [a0, a3, a1, a1, a3, a2]) {
          pos.push(q[0], q[1], q[2]);
          arr.push(a);
          val.push(v);
          dep.push(q[3]);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aArr', new BufferAttribute(new Float32Array(arr), 1));
  g.setAttribute('aVal', new BufferAttribute(new Float32Array(val), 1));
  g.setAttribute('aDepth', new BufferAttribute(new Float32Array(dep), 1));
  return g;
}

function useRev(): number {
  return useSyncExternalStore(store.subscribe, () => presentation.rev);
}

export function HazardFront() {
  useRev();
  const active = presentation.active && !!presentation.report;
  // Build the front geometry once per presentation (keyed by the report object), not on every progress tick.
  const built = useRef<{ report: unknown; geom: BufferGeometry | null }>({ report: null, geom: null });
  if (!active) built.current = { report: null, geom: null };
  else if (built.current.report !== presentation.report)
    built.current = { report: presentation.report, geom: buildFrontGeometry() };
  const geom = built.current.geom;
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uFront: { value: 0 }, uMode: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 } },
      }),
    [],
  );
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    mat.uniforms.uFront!.value = presentation.front;
    mat.uniforms.uMode!.value = presentation.hazard === 'fire' ? 0 : presentation.hazard === 'flood' ? 1 : 2;
    // Fade the overlay out as the final (already-scarred) world takes over.
    mat.uniforms.uAlpha!.value =
      1 - Math.min(1, Math.max(0, (presentation.t - FRONT_END) / (1 - FRONT_END))) * 0.85;
  });
  if (!geom) return null;
  return <mesh geometry={geom} material={mat} renderOrder={6} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Per-structure effects                                               */
/* ------------------------------------------------------------------ */

/** Flames licking a footprint, then dying down to a smoulder. */
export function BurnFx({ w, h, seed }: { w: number; h: number; seed: number }) {
  const group = useRef<Group>(null);
  const born = useRef<number | null>(null);
  const mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(2.4, 0.85, 0.2),
        toneMapped: false,
        transparent: true,
        opacity: 0.92,
      }),
    [],
  );
  const flames = useMemo(
    () =>
      Array.from({ length: Math.max(5, Math.round(w * h * 1.4)) }, (_, i) => ({
        x: (h01(seed, i, 1) - 0.5) * w * 0.8,
        z: (h01(seed, i, 2) - 0.5) * h * 0.8,
        s: 0.5 + h01(seed, i, 3) * 0.8,
        p: h01(seed, i, 4) * 6.28,
      })),
    [w, h, seed],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (born.current === null) born.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - born.current;
    const life = Math.max(0, 1 - age / 2.6);
    flames.forEach((f, i) => {
      const m = g.children[i];
      if (!m) return;
      const flick =
        0.7 +
        0.3 * Math.sin(state.clock.elapsedTime * 11 + f.p) * Math.sin(state.clock.elapsedTime * 7 + f.p * 2);
      m.scale.set(0.9 + 0.2 * Math.sin(state.clock.elapsedTime * 9 + f.p), f.s * flick * (0.25 + life), 0.9);
      m.position.set(f.x, 0.25 * f.s * life, f.z);
    });
  });
  return (
    <group ref={group}>
      {flames.map((_, i) => (
        <mesh key={i} material={mat}>
          <coneGeometry args={[0.18, 0.7, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** A burst of dust where a structure gives way. */
export function DustPuff({ w, h, seed }: { w: number; h: number; seed: number }) {
  const group = useRef<Group>(null);
  const born = useRef<number | null>(null);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#9a8d7a',
        roughness: 1,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    [],
  );
  const puffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: (h01(seed, i, 7) - 0.5) * w * 0.9,
        z: (h01(seed, i, 8) - 0.5) * h * 0.9,
        d: 0.4 + h01(seed, i, 9) * 0.8,
      })),
    [w, h, seed],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (born.current === null) born.current = state.clock.elapsedTime;
    const u = Math.min(1, (state.clock.elapsedTime - born.current) / 1.5);
    puffs.forEach((p, i) => {
      const m = g.children[i] as Mesh | undefined;
      if (!m) return;
      m.position.set(p.x * (1 + u), 0.2 + u * p.d * 1.2, p.z * (1 + u));
      m.scale.setScalar(0.15 + u * 0.6 * p.d + 0.1);
    });
    mat.opacity = 0.6 * (1 - u);
  });
  return (
    <group ref={group}>
      {puffs.map((_, i) => (
        <mesh key={i} material={mat}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}
