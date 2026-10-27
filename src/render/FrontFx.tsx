import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import {
  BufferAttribute,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LatheGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
  Vector2,
} from 'three';
import { store } from '../game/store';
import { h01 } from './geo';
import { presentation } from './presentation';
import { groundY } from './world';

/**
 * The visible body of a catastrophe, driven only by the already-resolved report: a wall of flame and dark smoke
 * columns where the fire front is burning right now (with a warm light travelling with it), or a rolling ring of dust
 * along a quake's shockwave. Purely presentational; skipping or reduced motion simply shows less of it.
 */

const MAX_FLAMES = 260;
const MAX_PUFFS = 320;
const BURN = 0.12;
const SMOKE = 0.4;
const dummy = new Object3D();
const tint = new Color();

let flameShared: LatheGeometry | null = null;
/** Teardrop flame with a hot core and red tips (shared by the front and burning buildings). */
export function flameGeometry(): LatheGeometry {
  if (flameShared) return flameShared;
  const pts = [
    new Vector2(0.001, 0),
    new Vector2(0.17, 0.07),
    new Vector2(0.21, 0.22),
    new Vector2(0.16, 0.42),
    new Vector2(0.08, 0.62),
    new Vector2(0.001, 0.82),
  ];
  const g = new LatheGeometry(pts, 7);
  const P = g.getAttribute('position');
  const col = new Float32Array(P.count * 3);
  const core = new Color('#fff1a8');
  const mid = new Color('#ffab3d');
  const tip = new Color('#e0491f');
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / 0.82;
    const c = y < 0.35 ? core.clone().lerp(mid, y / 0.35) : mid.clone().lerp(tip, (y - 0.35) / 0.65);
    col[i * 3] = c.r * 2.2;
    col[i * 3 + 1] = c.g * 1.6;
    col[i * 3 + 2] = c.b * 1.2;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  flameShared = g;
  return g;
}

interface FxCell {
  x: number;
  y: number;
  z: number;
  a: number;
  v: number;
  seed: number;
}

export function FrontFx() {
  useSyncExternalStore(store.subscribe, () => presentation.rev);
  const report = presentation.active ? presentation.report : null;
  const kind = presentation.hazard;
  const cells = useMemo<FxCell[]>(() => {
    if (!report || (report.hazard !== 'fire' && report.hazard !== 'quake')) return [];
    const span = Math.max(1, report.result.span);
    return report.result.cells.map((c, i) => ({
      x: c.x + 0.5,
      z: c.y + 0.5,
      y: groundY(c.x + 0.5, c.y + 0.5),
      a: c.arrival / span,
      v: Math.min(1, c.intensity / 1000),
      seed: i,
    }));
  }, [report]);
  const flames = useRef<InstancedMesh>(null);
  const puffs = useRef<InstancedMesh>(null);
  const light = useRef<PointLight>(null);
  const flameGeo = useMemo(() => flameGeometry(), []);
  const flameMat = useMemo(
    () =>
      new MeshBasicMaterial({
        vertexColors: true,
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );
  const alpha = useMemo(() => {
    const a = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS), 1);
    a.setUsage(DynamicDrawUsage);
    return a;
  }, []);
  const puffGeo = useMemo(() => {
    const g = new SphereGeometry(1, 12, 9);
    g.setAttribute('aAlpha', alpha);
    return g;
  }, [alpha]);
  const puffMat = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      transparent: true,
      depthWrite: false,
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader =
        'attribute float aAlpha;\nvarying float vFxAlpha;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFxAlpha = aAlpha;');
      sh.fragmentShader =
        'varying float vFxAlpha;\n' +
        sh.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n  diffuseColor.a *= vFxAlpha * smoothstep(0.0, 0.85, abs(normal.z));',
        );
    };
    m.customProgramCacheKey = () => 'front-fx-puff';
    return m;
  }, []);

  useFrame((state) => {
    const f = flames.current;
    const p = puffs.current;
    const l = light.current;
    if (!f || !p || !l) return;
    const on = cells.length > 0 && presentation.active;
    f.visible = on && kind === 'fire';
    p.visible = on;
    l.visible = on && kind === 'fire';
    if (!on) return;
    const t = state.clock.elapsedTime;
    const front = presentation.front;
    const reduced = store.settings.reducedMotion;
    let nf = 0;
    let np = 0;
    let lx = 0;
    let lz = 0;
    let lw = 0;
    for (const c of cells) {
      const age = front - c.a;
      if (age < 0) continue;
      if (kind === 'fire') {
        if (age < BURN && nf < MAX_FLAMES) {
          const life = 1 - age / BURN;
          const flick = 0.75 + 0.25 * Math.sin(t * 12 + c.seed) * Math.sin(t * 7.7 + c.seed * 1.3);
          const jx = (h01(c.seed, 1, 3) - 0.5) * 0.6;
          const jz = (h01(c.seed, 2, 3) - 0.5) * 0.6;
          dummy.position.set(c.x + jx, c.y, c.z + jz);
          dummy.rotation.set(0, h01(c.seed, 3, 3) * 6.28, 0);
          const s = (0.7 + c.v * 0.9) * (0.35 + 0.65 * life);
          dummy.scale.set(s, s * flick * (1.1 + 0.5 * h01(c.seed, 4, 3)), s);
          dummy.updateMatrix();
          f.setMatrixAt(nf++, dummy.matrix);
          lx += c.x * life;
          lz += c.z * life;
          lw += life;
        }
        if (age < SMOKE && np < MAX_PUFFS && !reduced) {
          const u = age / SMOKE;
          const rise = u * 3.2;
          const drift = u * u * 1.2;
          dummy.position.set(c.x + drift, c.y + 0.4 + rise, c.z + drift * 0.5);
          const s = 0.25 + u * 0.9 * (0.6 + c.v * 0.6);
          dummy.scale.set(s, s * 0.85, s);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          p.setMatrixAt(np, dummy.matrix);
          tint.setRGB(0.18, 0.15, 0.13).lerp(tint.clone().setRGB(0.45, 0.42, 0.4), u);
          p.setColorAt(np, tint);
          alpha.setX(np, Math.min(1, u / 0.1) * (1 - u) * 0.75);
          np++;
        }
      } else if (age < 0.3 && np < MAX_PUFFS) {
        // quake: dust kicked up as the shockwave passes, settling quickly
        const u = age / 0.3;
        dummy.position.set(
          c.x + (h01(c.seed, 5, 3) - 0.5) * 0.5,
          c.y + 0.15 + u * 0.7,
          c.z + (h01(c.seed, 6, 3) - 0.5) * 0.5,
        );
        const s = (0.25 + u * 0.55) * (0.6 + c.v * 0.7);
        dummy.scale.set(s * 1.3, s * 0.7, s * 1.3);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        p.setMatrixAt(np, dummy.matrix);
        p.setColorAt(np, tint.set('#b8a587'));
        alpha.setX(np, Math.min(1, u / 0.15) * (1 - u) * 0.7);
        np++;
      }
    }
    f.count = nf;
    f.instanceMatrix.needsUpdate = true;
    p.count = np;
    p.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    alpha.needsUpdate = true;
    if (lw > 0) {
      l.position.set(lx / lw, groundY(lx / lw, lz / lw) + 2.2, lz / lw);
      l.intensity = 10 * Math.min(1, lw / 6) * (0.85 + 0.15 * Math.sin(t * 9));
    } else l.intensity = 0;
  });

  return (
    <group>
      <instancedMesh
        ref={flames}
        args={[flameGeo, flameMat, MAX_FLAMES]}
        frustumCulled={false}
        renderOrder={7}
      />
      <instancedMesh ref={puffs} args={[puffGeo, puffMat, MAX_PUFFS]} frustumCulled={false} renderOrder={8} />
      <pointLight ref={light} color="#ff8a3a" intensity={0} distance={11} decay={1.6} />
    </group>
  );
}
