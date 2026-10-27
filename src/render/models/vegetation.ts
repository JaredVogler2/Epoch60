import type { BufferGeometry } from 'three';
import { GeoBuilder, PAL, mix, rgb, shade } from '../geo';

/** Slender conifer: trunk + four stacked cones. ~1.9 tall. */
export function pineGeometry(): BufferGeometry {
  const g = new GeoBuilder(101);
  g.jitter = 0.09;
  g.cyl(0, 0, 0, 0.07, 0.05, 0.5, 6, PAL.bark);
  const tiers = [
    { y: 0.28, r: 0.46, h: 0.62, c: rgb('#2b6a39') },
    { y: 0.62, r: 0.38, h: 0.58, c: rgb('#33783e') },
    { y: 0.95, r: 0.29, h: 0.52, c: rgb('#3b8744') },
    { y: 1.25, r: 0.19, h: 0.5, c: rgb('#479650') },
  ];
  for (const t of tiers) g.cyl(0, t.y, 0, t.r, 0.0, t.h, 7, t.c, { wobble: 0.14 });
  return g.build();
}

/** Broadleaf with a clustered canopy. ~1.5 tall. */
export function oakGeometry(): BufferGeometry {
  const g = new GeoBuilder(202);
  g.cyl(0, 0, 0, 0.09, 0.06, 0.62, 6, PAL.bark);
  g.beam([0, 0.45, 0], [0.18, 0.78, 0.05], 0.025, PAL.bark);
  g.beam([0, 0.5, 0], [-0.16, 0.82, -0.06], 0.025, PAL.bark);
  const a = rgb('#3f8a3a');
  const b = rgb('#5ea545');
  const lumps: [number, number, number, number, number][] = [
    [0, 0.98, 0, 0.5, 0.44],
    [0.3, 0.84, 0.12, 0.34, 0.3],
    [-0.3, 0.88, -0.1, 0.36, 0.32],
    [0.05, 1.3, 0.04, 0.34, 0.3],
    [-0.08, 0.86, 0.32, 0.32, 0.28],
    [0.14, 0.9, -0.3, 0.3, 0.26],
  ];
  lumps.forEach(([x, y, z, rx, ry], i) =>
    g.lump(x, y, z, rx, ry, rx, i % 2 ? a : b, { rough: 0.16, seed: i, topColor: rgb('#8fc65a') }),
  );
  return g.build();
}

/** Slim birch with pale trunk and light canopy. ~1.5 tall. */
export function birchGeometry(): BufferGeometry {
  const g = new GeoBuilder(303);
  g.cyl(0, 0, 0, 0.045, 0.03, 0.95, 6, rgb('#e6e0d0'));
  g.cyl(0.0, 0.25, 0, 0.047, 0.047, 0.04, 6, rgb('#3b3a35'));
  g.cyl(0.0, 0.55, 0, 0.04, 0.04, 0.035, 6, rgb('#3b3a35'));
  const c1 = rgb('#9bc455');
  const c2 = rgb('#b6d25f');
  g.lump(0, 1.05, 0, 0.3, 0.38, 0.3, c1, { rough: 0.2, seed: 1, topColor: rgb('#d3e57a') });
  g.lump(0.16, 0.85, 0.08, 0.22, 0.26, 0.22, c2, { rough: 0.2, seed: 2, detail: 0 });
  g.lump(-0.15, 0.9, -0.1, 0.22, 0.26, 0.22, c2, { rough: 0.2, seed: 3, detail: 0 });
  return g.build();
}

export function bushGeometry(): BufferGeometry {
  const g = new GeoBuilder(404);
  const a = rgb('#4a8a3a');
  const b = rgb('#6aa044');
  g.lump(0, 0.16, 0, 0.26, 0.2, 0.26, a, { rough: 0.2, seed: 1, topColor: b });
  g.lump(0.2, 0.12, 0.08, 0.18, 0.15, 0.18, b, { rough: 0.2, seed: 2 });
  g.lump(-0.16, 0.12, -0.1, 0.18, 0.14, 0.18, a, { rough: 0.2, seed: 3 });
  return g.build();
}

/** Burnt snag: charred trunk with broken branch stubs. */
export function snagGeometry(): BufferGeometry {
  const g = new GeoBuilder(505);
  g.cyl(0, 0, 0, 0.09, 0.05, 1.0, 5, PAL.char);
  g.beam([0, 0.55, 0], [0.34, 0.95, 0.05], 0.03, PAL.char);
  g.beam([0, 0.7, 0], [-0.3, 1.1, -0.1], 0.025, PAL.ash);
  g.beam([0, 0.85, 0], [0.05, 1.2, 0.26], 0.022, PAL.char);
  return g.build();
}

export function boulderGeometry(): BufferGeometry {
  const g = new GeoBuilder(606);
  g.jitter = 0.1;
  g.lump(0, 0.18, 0, 0.42, 0.3, 0.36, rgb('#8d8576'), {
    rough: 0.22,
    detail: 1,
    seed: 5,
    topColor: rgb('#b2a994'),
  });
  g.lump(0.38, 0.1, 0.12, 0.22, 0.16, 0.2, rgb('#7d7567'), { rough: 0.2, seed: 6 });
  return g.build();
}

/** A tuft of three crossed blades. */
export function grassGeometry(): BufferGeometry {
  const g = new GeoBuilder(707);
  g.jitter = 0.12;
  const base = rgb('#4f8f3a');
  const tip = rgb('#9cc858');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.4;
    const dx = Math.cos(a) * 0.05;
    const dz = Math.sin(a) * 0.05;
    const lean = 0.05 + (i % 2) * 0.03;
    const h = 0.24 + (i % 3) * 0.06;
    g.triangle(
      [-dx, 0, -dz],
      [dx, 0, dz],
      [Math.cos(a + 1.2) * lean, h, Math.sin(a + 1.2) * lean],
      mix(base, tip, 0.45),
    );
    g.triangle([dx, 0, dz], [-dx, 0, -dz], [Math.cos(a + 1.2) * lean, h, Math.sin(a + 1.2) * lean], base);
  }
  return g.build();
}

export function flowerGeometry(): BufferGeometry {
  const g = new GeoBuilder(808);
  g.cyl(0, 0, 0, 0.012, 0.01, 0.16, 4, rgb('#4f8f3a'), { capTop: false });
  g.lump(0, 0.18, 0, 0.055, 0.035, 0.055, rgb('#ffffff'), { rough: 0.05, detail: 0 });
  return g.build();
}

export function reedGeometry(): BufferGeometry {
  const g = new GeoBuilder(909);
  const c = rgb('#7a9a46');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 0.07;
    const z = Math.sin(a) * 0.07;
    g.cyl(x, 0, z, 0.012, 0.006, 0.4 + (i % 3) * 0.1, 3, shade(c, 0.9 + (i % 2) * 0.2), { capTop: false });
  }
  g.cyl(0, 0.4, 0, 0.03, 0.03, 0.12, 5, rgb('#7a5a34'));
  return g.build();
}
