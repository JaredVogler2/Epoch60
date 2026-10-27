import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { store } from '../game/store';
import { atmo } from './atmosphere';
import { h01 } from './geo';
import { presentation } from './presentation';
import { smokeSources } from './Structures';

const PUFFS = 9;
const MAX_SOURCES = 72;
const dummy = new Object3D();
const LIGHT = new Color('#f1eee8');
const DARK = new Color('#8f8a84');
const tint = new Color();

/**
 * All chimney and hearth smoke in one instanced draw: soft round puffs that rise, lean with the shared wind, swell and
 * fade. Opacity is per puff (an instanced attribute), so nothing pops in or out. Render-only.
 */
export function SmokeField() {
  const rev = useSyncExternalStore(
    store.subscribe,
    () => `${store.campaign?.epoch ?? -1}:${store.worldRev}:${store.structRev}:${presentation.rev}`,
  );
  const sources = useMemo(() => {
    void rev;
    return smokeSources(store.campaign).slice(0, MAX_SOURCES);
  }, [rev]);
  const mesh = useRef<InstancedMesh>(null);
  const alpha = useMemo(() => {
    const a = new InstancedBufferAttribute(new Float32Array(MAX_SOURCES * PUFFS), 1);
    a.setUsage(DynamicDrawUsage);
    return a;
  }, []);
  const geo = useMemo(() => {
    const g = new SphereGeometry(1, 14, 10);
    g.setAttribute('aAlpha', alpha);
    return g;
  }, [alpha]);
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      emissive: new Color('#6b6660'),
      emissiveIntensity: 0.55,
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader =
        'attribute float aAlpha;\nvarying float vSmokeAlpha;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vSmokeAlpha = aAlpha;',
        );
      // Soft vapour: opacity falls off toward each puff's silhouette (view-space normal), so no hard sphere edges.
      sh.fragmentShader =
        'varying float vSmokeAlpha;\n' +
        sh.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n  diffuseColor.a *= vSmokeAlpha * smoothstep(0.0, 0.85, abs(normal.z));',
        );
    };
    m.customProgramCacheKey = () => 'smoke-field';
    return m;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const reduced = store.settings.reducedMotion;
    const t = state.clock.elapsedTime * (reduced ? 0.2 : 1);
    const wind = atmo.uniforms.uAtmoWind.value;
    let n = 0;
    for (const src of sources) {
      for (let k = 0; k < PUFFS; k++) {
        const rate = src.dark ? 0.16 : 0.2;
        const u = (t * rate + k / PUFFS + h01(src.seed, 3, 7)) % 1;
        const sway = Math.sin(t * 0.9 + k * 1.7 + src.seed) * 0.06 * u;
        const rise = u * (src.dark ? 1.25 : 1.55);
        dummy.position.set(
          src.x + wind.x * u * u * 1.1 + sway,
          src.y + rise,
          src.z + wind.y * u * u * 1.1 + sway * 0.6,
        );
        const s = (src.dark ? 0.09 : 0.06) + u * (src.dark ? 0.3 : 0.26);
        dummy.scale.set(s, s * 0.86, s);
        dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        tint.copy(src.dark ? DARK : LIGHT).lerp(LIGHT, src.dark ? u * 0.4 : 0);
        m.setColorAt(n, tint);
        // fade in quickly, thin out as it climbs
        const a = Math.min(1, u / 0.12) * (1 - Math.max(0, (u - 0.45) / 0.55)) * (src.dark ? 0.8 : 0.62);
        alpha.setX(n, a);
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    alpha.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, mat, MAX_SOURCES * PUFFS]} frustumCulled={false} renderOrder={4} />
  );
}
