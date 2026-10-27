import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, MeshStandardMaterial } from 'three';
import { h01 } from './geo';

/** Soft chimney/hearth smoke: a few rising puffs that swell then fade by shrinking. Render-only. */
export function Smoke({
  position,
  seed,
  color = '#d9d4cc',
  rate = 1,
}: {
  position: [number, number, number];
  seed: number;
  color?: string;
  rate?: number;
}) {
  const group = useRef<Group>(null);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
    [color],
  );
  const puffs = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        off: i / 6 + h01(seed, i, 1) * 0.08,
        drift: (h01(seed, i, 2) - 0.3) * 0.6,
      })),
    [seed],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime * 0.28 * rate;
    puffs.forEach((p, i) => {
      const m = g.children[i];
      if (!m) return;
      const u = (t + p.off) % 1;
      m.position.set(p.drift * u * 0.9, u * 1.2, Math.sin(u * 5 + i) * 0.08 * u);
      const s = 0.05 + u * 0.22;
      m.scale.setScalar(u > 0.8 ? s * (1 - (u - 0.8) * 5) : s);
    });
  });
  return (
    <group ref={group} position={position}>
      {puffs.map((_, i) => (
        <mesh key={i} material={mat}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}
