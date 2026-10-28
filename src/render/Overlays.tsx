import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { BUILDINGS, GRID_H, GRID_W, footprint } from '../engine';
import type { BuildingKind, HazardKind, Structure } from '../engine';
import { store } from '../game/store';
import { ERODED_COLOR, REACH_COLORS, ageColor, historyLayers, lensShown } from './history';
import { buildingModel } from './models/buildings';
import type { BuildingModel } from './models/buildings';
import { groundY } from './world';
import { sampleSmooth } from './terrain';

/* ------------------------------------------------------------------ */
/* Decal shader: terrain-hugging translucent marks                     */
/* ------------------------------------------------------------------ */

const decalVert = /* glsl */ `
attribute vec2 aUv;
attribute float aVal;
attribute float aCover;
varying vec2 vUv;
varying float vVal;
varying float vCover;
varying vec3 vWorld;
void main() {
  vUv = aUv;
  vVal = aVal;
  vCover = aCover;
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
uniform float uFill;
varying vec2 vUv;
varying float vVal;
varying float vCover;
varying vec3 vWorld;
void main() {
  float stripe = step(0.5, fract((vWorld.x + vWorld.z) * 2.2 - uTime * 0.25));
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float border = 1.0 - smoothstep(0.0, 0.07, edge);
  float pulse = 0.78 + 0.22 * sin(uTime * 4.0);
  float a;
  if (uMode < 0.5) {            // hazard forecast: soft fill, fine drifting stripes, a contour where the zone ends
    float v = vVal;
    float inside = smoothstep(0.35, 0.65, vCover);
    float fill = smoothstep(0.03, 0.4, v) * inside;
    float fine = smoothstep(0.42, 0.5, abs(fract((vWorld.x - vWorld.z) * 1.4 - uTime * 0.12) - 0.5));
    // The contour follows the zone's edge (the smoothed footprint crossing one half) and keeps a constant pixel width.
    // fwidth is exactly 0 where the footprint is flat, and smoothstep is undefined when its edges meet: keep them apart.
    float contour = 1.0 - smoothstep(0.0, max(fwidth(vCover) * 1.6, 1e-4), abs(vCover - 0.5));
    a = fill * (0.05 + 0.13 * v) * (0.6 + 0.4 * fine) * uFill + contour * 0.62;
  } else if (uMode < 1.5) {     // valid placement: soft fill + crisp border
    a = 0.28 + 0.6 * border;
  } else if (uMode < 2.5) {     // invalid: hatched fill + border
    a = (0.22 + 0.3 * stripe) + 0.55 * border;
  } else if (uMode < 3.5) {     // selection ring
    a = border * (0.7 + 0.3 * pulse);
  } else if (uMode < 4.5) {     // at-risk marker
    a = (0.18 + 0.55 * border) * pulse;
  } else {                      // hover: a faint, steady outline
    a = border * 0.6;
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
      uFill: { value: 1 },
    },
  });
}

const HAZARD_COLORS: Record<HazardKind, string> = {
  fire: '#ff5a1f',
  flood: '#2f86ff',
  quake: '#a874ff',
  ash: '#c9c4b8',
};

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
  g.setAttribute('aCover', new BufferAttribute(new Float32Array(val), 1));
  return g;
}

function useRevs(): string {
  return useSyncExternalStore(store.subscribe, () => `${store.version}`);
}

/** Marks a map overlay, which the then-and-now snapshots hide (see Snapshot.tsx). */
const OVERLAY = { overlay: true };

/* ------------------------------------------------------------------ */
/* Hazard forecast on the terrain                                      */
/* ------------------------------------------------------------------ */

/** 3×3 binomial blur (weights 4/2/1), renormalised at the board edge. */
function blur3(src: Float32Array, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let wsum = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const wgt = i === 0 && j === 0 ? 4 : i === 0 || j === 0 ? 2 : 1;
          sum += src[yy * W + xx]! * wgt;
          wsum += wgt;
        }
      out[y * W + x] = sum / wsum;
    }
  return out;
}

/** Morphological closing (3×3 dilate, then erode): fills one-cell holes and gaps without growing the outline. */
function closeMask(m: Float32Array, W: number, H: number): Float32Array {
  const pass = (src: Float32Array, dilate: boolean) => {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = dilate ? 0 : 1;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const xx = x + i;
            const yy = y + j;
            // Off the board counts as inside when eroding, so the board edge never eats into a zone.
            const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? (dilate ? 0 : 1) : src[yy * W + xx]!;
            v = dilate ? Math.max(v, s) : Math.min(v, s);
          }
        out[y * W + x] = v;
      }
    return out;
  };
  return pass(pass(m, true), false);
}

/**
 * The forecast as a smooth field draped on the terrain: per-cell intensities and the zone's footprint are blurred and
 * sampled (Catmull-Rom) on a finer grid, so the danger zone has a soft body and a clean contour along its edge instead
 * of cell-sized squares.
 */
function forecastGeometry(cells: { x: number; y: number; intensity: number }[]): BufferGeometry {
  const W = GRID_W;
  const H = GRID_H;
  const raw = new Float32Array(W * H);
  const mask = new Float32Array(W * H);
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  for (const c of cells) {
    raw[c.y * W + c.x] = Math.max(raw[c.y * W + c.x]!, Math.min(1, c.intensity / 1000));
    mask[c.y * W + c.x] = 1;
    x0 = Math.min(x0, c.x);
    x1 = Math.max(x1, c.x + 1);
    y0 = Math.min(y0, c.y);
    y1 = Math.max(y1, c.y + 1);
  }
  const field = blur3(raw, W, H);
  // The footprint can be patchy (a fire spreads only through forest): close one-cell gaps so the zone reads as one
  // shape, then blur twice, so its edge is a single clean contour instead of speckle wherever the mask flickers.
  const cover = blur3(blur3(closeMask(mask, W, H), W, H), W, H);
  const pos: number[] = [];
  const uv: number[] = [];
  const val: number[] = [];
  const cov: number[] = [];
  const idx: number[] = [];
  if (!cells.length) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
    return g;
  }
  const S = 3;
  const gx0 = Math.max(0, x0 - 2);
  const gy0 = Math.max(0, y0 - 2);
  const gx1 = Math.min(W, x1 + 2);
  const gy1 = Math.min(H, y1 + 2);
  const nx = (gx1 - gx0) * S;
  const nz = (gy1 - gy0) * S;
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const px = gx0 + i / S;
      const pz = gy0 + j / S;
      pos.push(px, groundY(px, pz) + 0.06, pz);
      uv.push(0.5, 0.5);
      val.push(Math.max(0, sampleSmooth(field, px, pz)));
      cov.push(sampleSmooth(cover, px, pz));
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c2 = a + nx + 1;
      const d = c2 + 1;
      if (cov[a]! < 0.03 && cov[b]! < 0.03 && cov[c2]! < 0.03 && cov[d]! < 0.03) continue;
      idx.push(a, c2, b, b, c2, d);
    }
  const g = new BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('aVal', new BufferAttribute(new Float32Array(val), 1));
  g.setAttribute('aCover', new BufferAttribute(new Float32Array(cov), 1));
  return g;
}

/** The history lens takes the map's overlay layer: the forecast and risk markers step aside while it is shown. */
const historyShown = () => lensShown(store.campaign, store.screen, store.showHistory);

export function ForecastOverlay() {
  useRevs();
  const c = store.campaign;
  const show =
    !!c &&
    store.screen === 'game' &&
    store.showForecast &&
    !historyShown() &&
    (c.phase === 'PREPARE' || c.phase === 'ACTIVE');
  const f = show ? store.getForecastCached() : null;
  const geom = useMemo(() => (f ? forecastGeometry(f.predicted.cells) : null), [f]);
  useEffect(() => () => geom?.dispose(), [geom]);
  const mat = useMemo(() => {
    const m = decalMaterial(HAZARD_COLORS[f?.kind ?? 'fire'], 0);
    // Quakes and ashfalls threaten whole hillsides: their zone is drawn mostly by its contour, not a tint.
    m.uniforms.uFill!.value = f?.kind === 'quake' ? 0.35 : f?.kind === 'ash' ? 0.6 : 1;
    return m;
  }, [f?.kind]);
  useFrame((s) => {
    mat.uniforms.uTime!.value = s.clock.elapsedTime;
    // Urgency: the overlay brightens as the clock runs down.
    const urgent = c && c.phase === 'ACTIVE' ? Math.min(1, Math.max(0, (c.tick - 350) / 250)) : 0;
    mat.uniforms.uAlpha!.value = 0.8 + 0.5 * urgent;
  });
  if (!geom || !f) return null;
  return <mesh geometry={geom} material={mat} renderOrder={3} frustumCulled={false} userData={OVERLAY} />;
}

/* ------------------------------------------------------------------ */
/* Placement ghost, plan markers, selection, risk                      */
/* ------------------------------------------------------------------ */

const ghostModels = new Map<string, BuildingModel>();
function ghostModel(kind: BuildingKind, rot: 0 | 1): BuildingModel {
  const era = store.campaign?.epoch ?? 0;
  const key = `${kind}:${rot}:${era}`;
  let m = ghostModels.get(key);
  if (!m) {
    const { w, h } = footprint(kind, rot);
    m = buildingModel(kind, w, h, 0, 77, era);
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
  useEffect(() => () => geom.dispose(), [geom]);
  const mat = useMemo(() => decalMaterial(color, mode, alpha), [color, mode, alpha]);
  useEffect(() => () => mat.dispose(), [mat]);
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
    <group userData={OVERLAY}>
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
    <group userData={OVERLAY}>
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
    <group userData={OVERLAY}>
      <Decal x={s.x - 0.1} y={s.y - 0.1} w={s.w + 0.2} h={s.h + 0.2} color="#ffd25a" mode={3} lift={0.09} />
    </group>
  );
}

/**
 * A faint, steady outline under the building the mouse is over (desktop): a quieter cousin of the selection ring.
 * Hover is render-only state, so this follows it frame by frame instead of re-rendering through the store.
 */
export function HoverRing() {
  const mesh = useRef<Mesh>(null);
  const mat = useMemo(() => decalMaterial('#fff3d6', 5), []);
  // The outline is rebuilt only when the hovered building changes.
  const ring = useMemo(() => ({ id: null as number | null, geom: null as BufferGeometry | null }), []);
  useEffect(
    () => () => {
      ring.geom?.dispose();
      mat.dispose();
    },
    [mat, ring],
  );
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const id = store.hoverId !== store.selectedId && !store.placing ? store.hoverId : null;
    if (id !== ring.id) {
      ring.id = id;
      ring.geom?.dispose();
      const s = id !== null ? store.campaign?.structures.find((st) => st.id === id) : undefined;
      ring.geom = s ? rectDecal(s.x - 0.08, s.y - 0.08, s.w + 0.16, s.h + 0.16, 0.085) : null;
      if (ring.geom) m.geometry = ring.geom;
    }
    m.visible = ring.geom !== null;
  });
  return (
    <mesh
      ref={mesh}
      material={mat}
      renderOrder={5}
      frustumCulled={false}
      visible={false}
      userData={OVERLAY}
    />
  );
}

/** Pulsing markers on buildings the coming hazard will damage or destroy. */
export function RiskMarkers() {
  useRevs();
  const c = store.campaign;
  const show =
    !!c &&
    store.screen === 'game' &&
    store.showForecast &&
    !historyShown() &&
    (c.phase === 'PREPARE' || c.phase === 'ACTIVE');
  const f = show ? store.getForecastCached() : null;
  if (!f) return null;
  const at = f.predicted.impacts.filter(
    (i) => i.after !== 'active' && !!c!.structures.find((s) => s.id === i.id),
  );
  return (
    <group userData={OVERLAY}>
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

/* ------------------------------------------------------------------ */
/* History lens: what each age left, between ages and on request       */
/* ------------------------------------------------------------------ */

/** Many terrain-hugging rectangles as one geometry (one draw call per age and state). */
function mergedRects(rects: { x: number; y: number; w: number; h: number }[], lift: number): BufferGeometry {
  const parts = rects.map((r) => rectDecal(r.x, r.y, r.w, r.h, lift));
  const pos: number[] = [];
  const uv: number[] = [];
  const val: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const base = pos.length / 3;
    pos.push(...(g.getAttribute('position').array as Float32Array));
    uv.push(...(g.getAttribute('aUv').array as Float32Array));
    val.push(...(g.getAttribute('aVal').array as Float32Array));
    for (const i of g.getIndex()!.array) idx.push(base + i);
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setIndex(idx);
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 2));
  out.setAttribute('aVal', new BufferAttribute(new Float32Array(val), 1));
  out.setAttribute('aCover', new BufferAttribute(new Float32Array(val), 1));
  return out;
}

interface LensPart {
  key: string;
  geom: BufferGeometry;
  mat: ShaderMaterial;
}

export function HistoryLens() {
  useRevs();
  const c = store.campaign;
  const show = historyShown();
  const key = show && c ? `${store.structRev}:${store.worldRev}:${c.epoch}` : '';
  const parts = useMemo((): LensPart[] => {
    if (!key || !c) return [];
    const layers = historyLayers(c);
    const out: LensPart[] = [];
    // The ground first, as soft fields with a contour: where each catastrophe reached (exactly the cells its report
    // recorded), then the worn ground.
    const fields = [
      ...layers.reach.map((r) => ({
        key: `reach-${r.epoch}`,
        cells: r.cells,
        color: REACH_COLORS[r.kind],
        fill: 0.5,
      })),
      { key: 'eroded', cells: layers.eroded, color: ERODED_COLOR, fill: 0.45 },
    ];
    for (const f of fields) {
      if (!f.cells.length) continue;
      const mat = decalMaterial(f.color, 0, 0.75);
      mat.uniforms.uFill!.value = f.fill;
      // A map layer, read over the canopy: a regrown forest would otherwise hide the very history it grew over.
      mat.depthTest = false;
      out.push({ key: f.key, geom: forecastGeometry(f.cells), mat });
    }
    // Then every building and ruin, in the colour of the age that raised it: standing outlined, ruins hatched.
    const groups = new Map<string, { x: number; y: number; w: number; h: number }[]>();
    for (const site of layers.sites) {
      const k = `${site.epoch}:${site.ruin ? 'ruin' : 'standing'}`;
      const list = groups.get(k) ?? [];
      list.push({ x: site.x - 0.05, y: site.y - 0.05, w: site.w + 0.1, h: site.h + 0.1 });
      groups.set(k, list);
    }
    for (const [k, rects] of groups) {
      const [epoch, state] = k.split(':');
      const color = ageColor(Number(epoch));
      const mat = decalMaterial(color, state === 'ruin' ? 2 : 1, state === 'ruin' ? 0.75 : 0.65);
      mat.depthTest = false;
      out.push({ key: k, geom: mergedRects(rects, 0.075), mat });
    }
    return out;
    // Rebuilt only when the structures, the world or the age change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      for (const p of parts) {
        p.geom.dispose();
        p.mat.dispose();
      }
    },
    [parts],
  );
  if (!parts.length) return null;
  return (
    <group name="history-lens" userData={OVERLAY}>
      {parts.map((p) => (
        <mesh key={p.key} geometry={p.geom} material={p.mat} renderOrder={6} frustumCulled={false} />
      ))}
    </group>
  );
}
