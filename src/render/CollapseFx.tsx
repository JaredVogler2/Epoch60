import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointsMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import { GRID_H, GRID_W, epochSpec } from '../engine';
import type { CollapseReport } from '../engine';
import { store } from '../game/store';
import { ATMO_GLSL, atmo } from './atmosphere';
import { h01 } from './geo';
import {
  FRONT_END,
  beginPresentation,
  endPresentation,
  frontOf,
  presentation,
  rebuildWorld,
} from './presentation';
import { WATER_LEVEL, sampleSmooth } from './terrain';
import { SUN_DIR } from './water';
import { groundY } from './world';
import { flameGeometry } from './FrontFx';

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
attribute float aCover;
attribute float aHead;
uniform float uFront;
uniform float uMode;
varying float vArr;
varying float vVal;
varying float vCover;
varying float vK;
varying float vDepth;
varying vec3 vNormal;
#include <fog_pars_vertex>
${ATMO_GLSL.common}
void main() {
  vec3 p = position;
  vK = 0.0;
  vDepth = 0.0;
  if (uMode > 0.5 && uMode < 1.5) {
    // Flood: the water surface rises out of the ground as the water arrives. Outside the flooded area it is pulled
    // under the land, so the shoreline is simply wherever the smooth surface meets the valley.
    vK = smoothstep(aArr, aArr + 0.18, uFront);
    float surface = mix(min(aHead, position.y - 0.05), aHead, smoothstep(0.2, 0.55, aCover));
    p.y = mix(position.y - 0.15, surface, vK);
    vDepth = p.y - position.y;
  } else {
    p.y += 0.045;
  }
  vArr = aArr;
  vVal = aVal;
  vCover = aCover;
  vNormal = normal;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vAtmoWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const frag = /* glsl */ `
uniform float uFront;
uniform float uMode;
uniform float uAlpha;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
varying float vArr;
varying float vVal;
varying float vCover;
varying float vK;
varying float vDepth;
varying vec3 vNormal;
#include <fog_pars_fragment>
${ATMO_GLSL.common}
${ATMO_GLSL.cloud}
void main() {
  vec2 p = vAtmoWorld.xz;
  float tm = uAtmoTime * (0.3 + 0.7 * uAtmoMotion);
  float n2 = atmoNoise(p * 4.3 + 11.0);
  float n = atmoNoise(p * 1.7) * 0.65 + n2 * 0.35;
  // Soft, ragged outline of the affected area (the footprint mask is already smooth; noise breaks up its curve).
  float edge = smoothstep(0.16, 0.52, vCover + (n - 0.5) * 0.3);
  float lambert = 0.62 + 0.38 * max(dot(normalize(vNormal), uSun), 0.0);
  vec4 outc;
  if (uMode < 0.5) {
    // Fire: an irregular line of glowing embers that leaves charred ground behind it.
    float d = uFront - (vArr + (n - 0.5) * 0.07);
    if (d < 0.0 || edge <= 0.004) discard;
    float fresh = 1.0 - smoothstep(0.0, 0.08, d);
    float glow = 1.0 - smoothstep(0.0, 0.3, d);
    float flick = 0.6 + 0.4 * sin(tm * 13.0 + n2 * 30.0);
    vec3 ember = mix(vec3(0.62, 0.07, 0.01), vec3(1.0, 0.42, 0.05), flick * fresh);
    ember = mix(ember, vec3(1.0, 0.7, 0.2), fresh * fresh * flick * 0.6);
    vec3 charc = mix(vec3(0.06, 0.045, 0.035), vec3(0.28, 0.07, 0.02), glow * n2);
    vec3 col = mix(charc, ember, fresh);
    outc = vec4(col, mix(0.32, 0.88, max(fresh, glow * 0.5)) * edge * smoothstep(0.0, 0.012, d));
  } else if (uMode < 1.5) {
    // Flood: silty water churning downstream, with foam along the shore and on the advancing edge.
    float d = vDepth;
    if (d <= 0.0 || vK <= 0.003) discard;
    vec2 f1 = p * vec2(1.6, 1.2) + vec2(tm * 0.2, -tm * 0.75);
    vec2 f2 = p * vec2(3.1, 2.7) + vec2(-tm * 0.25, -tm * 1.15);
    float e = 0.06;
    float h0 = atmoNoise(f1) + 0.5 * atmoNoise(f2);
    float hx = atmoNoise(f1 + vec2(e, 0.0)) + 0.5 * atmoNoise(f2 + vec2(e, 0.0));
    float hz = atmoNoise(f1 + vec2(0.0, e)) + 0.5 * atmoNoise(f2 + vec2(0.0, e));
    vec3 nrm = normalize(vec3((h0 - hx) * 1.3, 1.0, (h0 - hz) * 1.3));
    vec3 viewDir = normalize(cameraPosition - vAtmoWorld);
    float spec = pow(max(dot(nrm, normalize(uSun + viewDir)), 0.0), 160.0);
    float fres = pow(1.0 - max(dot(nrm, viewDir), 0.0), 3.0);
    vec3 col = mix(uShallow, uDeep, smoothstep(0.03, 0.5, d)) * (0.93 + 0.1 * h0);
    col *= atmoCloud(p);
    col += vec3(1.0, 0.95, 0.82) * spec * 0.35 + fres * vec3(0.07, 0.1, 0.12);
    float broken = smoothstep(0.3, 0.75, atmoNoise(p * 5.0 + vec2(0.0, -tm * 0.9)));
    float foam = max(smoothstep(0.035, 0.0, d), vK * (1.0 - vK) * 1.8) * (0.3 + 0.7 * broken);
    col = mix(col, uFoam, clamp(foam * 0.55, 0.0, 0.5));
    outc = vec4(col, mix(0.5, 0.93, smoothstep(0.0, 0.14, d)) * smoothstep(0.0, 0.3, vK));
  } else if (uMode < 2.5) {
    // Quake: a soft shock ring travels out from the epicentre; strong shaking leaves dusty, cracked ground.
    float d = uFront - vArr;
    float ring = d >= 0.0 ? exp(-d / 0.05) : exp(d / 0.012);
    float after = step(0.0, d);
    // Fissures: a warped noise contour, kept only in short runs and only where the shaking was strong.
    vec2 wq = p * 1.6 + vec2(atmoNoise(p * 4.0), atmoNoise(p * 4.0 + 7.0)) * 0.8;
    float c = atmoNoise(wq);
    float line = 1.0 - smoothstep(0.0, max(fwidth(c) * 1.1, 1e-4), abs(c - 0.5));
    float crack = line * smoothstep(0.55, 0.7, atmoNoise(p * 0.8 + 19.0)) * smoothstep(0.5, 0.85, vVal) * after;
    float aDust = ring * (0.22 + 0.45 * vVal) + after * vVal * 0.1 * (0.6 + 0.4 * n);
    float aCrack = crack * 0.65;
    float a = aCrack + aDust * (1.0 - aCrack);
    vec3 col = (vec3(0.13, 0.1, 0.07) * aCrack + vec3(0.86, 0.78, 0.62) * lambert * aDust * (1.0 - aCrack)) /
      max(a, 1e-4);
    outc = vec4(col, a * edge);
  } else {
    // Ash: a grey blanket settles once the plume has passed, thickest near the vent.
    float k = smoothstep(vArr, vArr + 0.25, uFront + (n - 0.5) * 0.06);
    if (k * edge <= 0.003) discard;
    vec3 col = mix(vec3(0.68, 0.66, 0.62), vec3(0.45, 0.43, 0.41), clamp(vVal, 0.0, 1.0)) * (0.92 + 0.16 * n);
    outc = vec4(col * lambert * atmoCloud(p), (0.34 + 0.5 * vVal) * k * edge);
  }
  gl_FragColor = vec4(outc.rgb, outc.a * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const W = GRID_W;
const H = GRID_H;
/** Overlay vertices per cell edge; matches the terrain mesh so the drape sits exactly on the ground. */
const S = 4;

/** Mean of `src` over the masked cells of each 3×3 neighbourhood (binomial weights); NaN where there are none. */
function smoothWithin(src: Float32Array, mask: Uint8Array): Float32Array {
  const out = new Float32Array(W * H).fill(NaN);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let wsum = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || !mask[yy * W + xx]) continue;
          const k = (i === 0 ? 2 : 1) * (j === 0 ? 2 : 1);
          sum += src[yy * W + xx]! * k;
          wsum += k;
        }
      if (wsum > 0 && mask[y * W + x]) out[y * W + x] = sum / wsum;
    }
  return out;
}

/** Fills NaN cells ring by ring with the mean of their filled neighbours, so smooth sampling never reads a hole. */
function extend(f: Float32Array): void {
  for (let pass = 0; pass < W + H; pass++) {
    const prev = f.slice();
    let changed = false;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!Number.isNaN(prev[y * W + x]!)) continue;
        let sum = 0;
        let n = 0;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const xx = x + i;
            const yy = y + j;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const v = prev[yy * W + xx]!;
            if (Number.isNaN(v)) continue;
            sum += v;
            n++;
          }
        if (n) {
          f[y * W + x] = sum / n;
          changed = true;
        }
      }
    if (!changed) break;
  }
  for (let k = 0; k < f.length; k++) if (Number.isNaN(f[k]!)) f[k] = 0;
}

/**
 * The hazard's footprint as smooth fields draped on the terrain: arrival, intensity, a blurred footprint mask and (for
 * a flood) the water surface, smoothed per cell and sampled with Catmull-Rom on the terrain's own vertex grid. The
 * front therefore moves as soft curves, never as cell-sized squares. A flood also swells the river beside it.
 */
function buildFrontGeometry(
  report: CollapseReport,
  water: ArrayLike<number> | undefined,
): BufferGeometry | null {
  const cells = report.result.cells;
  if (!cells.length) return null;
  const span = Math.max(1, report.result.span);
  const flood = report.hazard === 'flood';
  const foot = new Uint8Array(W * H);
  const arr = new Float32Array(W * H).fill(NaN);
  const val = new Float32Array(W * H).fill(NaN);
  const head = new Float32Array(W * H).fill(NaN);
  for (const c of cells) {
    const i = c.y * W + c.x;
    foot[i] = 1;
    arr[i] = c.arrival / span;
    val[i] = Math.min(1, c.intensity / 1000);
    if (flood) head[i] = groundY(c.x + 0.5, c.y + 0.5) + Math.max(0.03, c.intensity / 400);
  }
  const mask = foot.slice();
  if (flood && water) {
    // The river beside the flood rises first (arrival 0): the water then spills out of its banks.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!water[i] || foot[i]) continue;
        let near = false;
        for (let j = -2; j <= 2 && !near; j++)
          for (let k = -2; k <= 2; k++) {
            const xx = x + k;
            const yy = y + j;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && foot[yy * W + xx]) {
              near = true;
              break;
            }
          }
        if (near) {
          mask[i] = 1;
          arr[i] = 0;
        }
      }
  }
  const A = smoothWithin(arr, mask);
  const V = smoothWithin(val, foot);
  const Hd = flood ? smoothWithin(head, foot) : head;
  extend(A);
  extend(V);
  if (flood) {
    extend(Hd);
    for (let i = 0; i < W * H; i++) if (mask[i] && !foot[i]) Hd[i] = Math.max(Hd[i]!, WATER_LEVEL + 0.08);
  }
  const cover = new Float32Array(W * H);
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let wsum = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const k = (i === 0 ? 2 : 1) * (j === 0 ? 2 : 1);
          sum += mask[yy * W + xx]! * k;
          wsum += k;
        }
      cover[y * W + x] = sum / wsum;
      if (mask[y * W + x]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    }
  const gx0 = Math.max(0, x0 - 2);
  const gy0 = Math.max(0, y0 - 2);
  const nx = (Math.min(W, x1 + 2) - gx0) * S;
  const nz = (Math.min(H, y1 + 2) - gy0) * S;
  const nv = (nx + 1) * (nz + 1);
  const pos = new Float32Array(nv * 3);
  const aArr = new Float32Array(nv);
  const aVal = new Float32Array(nv);
  const aCover = new Float32Array(nv);
  const aHead = new Float32Array(nv);
  for (let j = 0, k = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++, k++) {
      const px = gx0 + i / S;
      const pz = gy0 + j / S;
      pos[k * 3] = px;
      pos[k * 3 + 1] = groundY(px, pz);
      pos[k * 3 + 2] = pz;
      aArr[k] = sampleSmooth(A, px, pz);
      aVal[k] = Math.min(1, Math.max(0, sampleSmooth(V, px, pz)));
      aCover[k] = sampleSmooth(cover, px, pz);
      aHead[k] = flood ? sampleSmooth(Hd, px, pz) : 0;
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      if (aCover[a]! < 0.04 && aCover[b]! < 0.04 && aCover[c]! < 0.04 && aCover[d]! < 0.04) continue;
      idx.push(a, c, b, b, c, d);
    }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aArr', new BufferAttribute(aArr, 1));
  g.setAttribute('aVal', new BufferAttribute(aVal, 1));
  g.setAttribute('aCover', new BufferAttribute(aCover, 1));
  g.setAttribute('aHead', new BufferAttribute(aHead, 1));
  g.computeVertexNormals();
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
  if (!active) {
    built.current.geom?.dispose();
    built.current = { report: null, geom: null };
  } else if (built.current.report !== presentation.report) {
    built.current.geom?.dispose();
    built.current = {
      report: presentation.report,
      geom: buildFrontGeometry(presentation.report!, store.campaign?.world.water),
    };
  }
  const geom = built.current.geom;
  const mat = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uFront: { value: 0 },
          uMode: { value: 0 },
          uAlpha: { value: 1 },
          uSun: { value: SUN_DIR.clone() },
          uShallow: { value: new Color('#a59b74') },
          uDeep: { value: new Color('#566f66') },
          uFoam: { value: new Color('#efe9d8') },
        },
      ]),
    });
    Object.assign(m.uniforms, atmo.uniforms);
    return m;
  }, []);
  useFrame(() => {
    mat.uniforms.uFront!.value = presentation.front;
    mat.uniforms.uMode!.value =
      presentation.hazard === 'fire'
        ? 0
        : presentation.hazard === 'flood'
          ? 1
          : presentation.hazard === 'ash'
            ? 3
            : 2;
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
        vertexColors: true,
        toneMapped: false,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
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
        <mesh key={i} material={mat} geometry={flameGeometry()} />
      ))}
    </group>
  );
}

/** A burst of dust where a structure gives way (or, `light`, a puff of sawdust when one is finished). */
export function DustPuff({
  w,
  h,
  seed,
  light = false,
}: {
  w: number;
  h: number;
  seed: number;
  light?: boolean;
}) {
  const group = useRef<Group>(null);
  const born = useRef<number | null>(null);
  const peak = light ? 0.42 : 0.6;
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: light ? '#e2d6bd' : '#9a8d7a',
        roughness: 1,
        transparent: true,
        opacity: peak,
        depthWrite: false,
      }),
    [light, peak],
  );
  useEffect(() => () => mat.dispose(), [mat]);
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
    mat.opacity = peak * (1 - u);
  });
  return (
    <group ref={group}>
      {puffs.map((_, i) => (
        <mesh key={i} material={mat}>
          <sphereGeometry args={[1, 12, 9]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Falling ash: flakes drift down and west while an ashfall is imminent */
/* ------------------------------------------------------------------ */

const FLAKES = 360;

/** Grey flakes over the valley. Visible during an ash epoch's warnings and the whole collapse; calm otherwise. */
export function AshFall() {
  const geom = useMemo(() => {
    const g = new BufferGeometry();
    const p = new Float32Array(FLAKES * 3);
    for (let i = 0; i < FLAKES; i++) {
      p[i * 3] = h01(i, 1, 7) * 34 - 1;
      p[i * 3 + 1] = h01(i, 2, 7) * 14;
      p[i * 3 + 2] = h01(i, 3, 7) * 34 - 1;
    }
    g.setAttribute('position', new BufferAttribute(p, 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new PointsMaterial({
        color: '#cfcac0',
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useFrame((_, dtRaw) => {
    const c = store.campaign;
    const dt = Math.min(dtRaw, 0.1);
    let amount = 0;
    if (c && store.screen === 'game') {
      const ash = epochSpec(c, c.epoch).hazard.kind === 'ash';
      if (ash && c.phase === 'ACTIVE') amount = Math.min(1, Math.max(0, (c.tick - 350) / 200));
      else if (ash && c.phase === 'COLLAPSING') amount = 1;
      else if (presentation.active && presentation.hazard === 'ash') amount = 1;
    }
    mat.opacity += (amount * 0.85 - mat.opacity) * Math.min(1, dt * 2);
    if (mat.opacity < 0.01) return;
    const a = geom.getAttribute('position') as BufferAttribute;
    const reduced = store.settings.reducedMotion;
    for (let i = 0; i < FLAKES; i++) {
      let y = a.getY(i) - dt * (reduced ? 0.4 : 0.9 + h01(i, 4, 7) * 0.9);
      let x = a.getX(i) - dt * (reduced ? 0.1 : 0.5 + h01(i, 5, 7) * 0.4);
      if (y < 0) y += 14;
      if (x < -1) x += 34;
      a.setXYZ(i, x, y, a.getZ(i));
    }
    a.needsUpdate = true;
  });
  return <points geometry={geom} material={mat} frustumCulled={false} renderOrder={7} />;
}
