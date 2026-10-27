import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { store } from '../game/store';
import { graphics } from './Post';
import { h01 } from './geo';

/**
 * A few small flocks wheeling over the valley: two-triangle birds whose wings beat by flattening and lifting.
 * One instanced draw. Purely ambient — hidden for reduced motion, on the low tier, and while a catastrophe plays.
 */
const FLOCKS = 3;
const PER = 6;
const dummy = new Object3D();

function birdGeometry(): BufferGeometry {
  // body at the origin pointing +x; wings spread along ±z, raised by the instance's y scale
  const p = [
    // left wing
    0.12, 0, 0, -0.08, 0, 0, 0.0, 0.06, -0.32,
    // right wing
    -0.08, 0, 0, 0.12, 0, 0, 0.0, 0.06, 0.32,
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
}

export function Birds() {
  const mesh = useRef<InstancedMesh>(null);
  const geo = useMemo(() => birdGeometry(), []);
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: '#3a352f', roughness: 1, metalness: 0, side: DoubleSide }),
    [],
  );
  const flocks = useMemo(
    () =>
      Array.from({ length: FLOCKS }, (_, f) => ({
        cx: 9 + h01(f, 1, 1) * 16,
        cz: 9 + h01(f, 2, 2) * 16,
        r: 7 + h01(f, 3, 3) * 9,
        y: 8.5 + h01(f, 4, 4) * 4,
        speed: (0.05 + h01(f, 5, 5) * 0.04) * (f % 2 ? 1 : -1),
        phase: h01(f, 6, 6) * Math.PI * 2,
      })),
    [],
  );
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const c = store.campaign;
    const hide =
      store.settings.reducedMotion ||
      graphics.shed >= 2 ||
      (c?.phase === 'COLLAPSING' && store.screen === 'game');
    m.visible = !hide;
    if (hide) return;
    const t = state.clock.elapsedTime;
    let n = 0;
    for (const fl of flocks) {
      const a = fl.phase + t * fl.speed;
      for (let b = 0; b < PER; b++) {
        // loose V behind the leader, each bird bobbing on its own rhythm
        const lag = (b % 2 ? 1 : -1) * Math.ceil(b / 2) * 0.55;
        const back = Math.ceil(b / 2) * 0.09 * Math.sign(fl.speed);
        const ab = a - back;
        const rr = fl.r + lag;
        const x = fl.cx + Math.cos(ab) * rr;
        const z = fl.cz + Math.sin(ab) * rr;
        const y = fl.y + Math.sin(t * 0.7 + b * 1.3) * 0.25;
        dummy.position.set(x, y, z);
        // face along the orbit tangent
        dummy.rotation.set(0, -ab + (fl.speed > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
        const flap = Math.sin(t * 9 + b * 1.7 + fl.phase);
        dummy.scale.set(1.2, 0.4 + 1.6 * flap, 1.2);
        dummy.updateMatrix();
        m.setMatrixAt(n++, dummy.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, FLOCKS * PER]} frustumCulled={false} />;
}
