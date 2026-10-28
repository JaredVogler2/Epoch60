import type { BufferGeometry } from 'three';
import type { BuildingKind } from '../../engine';
import { GeoBuilder, PAL, h01, mix, rgb, shade } from '../geo';
import type { RGB } from '../geo';

export interface BuildingModel {
  main: BufferGeometry;
  /** Emissive (unlit) parts: windows, fire, embers. */
  glow: BufferGeometry | null;
  /** Crops etc. that grow independently of construction. */
  crops: BufferGeometry | null;
  /** Total model height, used to sweep the construction clip plane. */
  height: number;
  w: number;
  h: number;
}

const WARM = rgb('#ffb347');
const WARM_DIM = rgb('#e08a2c');

/**
 * Roof colour by age, varied per house like a real village (thatch → fired tile → slate → copper gone green). The
 * fourth is the long chronicle's later ages (era 3 and on, the Age of Spires).
 */
const ROOFS: RGB[][] = [
  [rgb('#d6a64e'), rgb('#c8943e'), rgb('#dcb05a')],
  [rgb('#c4553c'), rgb('#d8743a'), rgb('#b84a3a')],
  [rgb('#4f7f92'), rgb('#5aa3a8'), rgb('#56677a')],
  [rgb('#5fa676'), rgb('#73b98a'), rgb('#4f9468')],
];
/** The architecture of the long chronicle's later ages: copper roofs, spires, turrets and pennants. */
const SPIRES = 3;
function roofFor(era: number, seed: number): RGB {
  const set = ROOFS[Math.min(SPIRES, Math.max(0, era))]!;
  return set[seed % set.length]!;
}

/** A slender spire with a gold finial: the Age of Spires' mark on a roof, a turret or a tower. */
function spire(g: GeoBuilder, x: number, y: number, z: number, r: number, h: number, color: RGB): void {
  g.cyl(x, y, z, r, 0, h, 8, color);
  g.cyl(x, y + h - 0.03, z, 0.026, 0.012, 0.16, 5, PAL.gold);
}

/** A small pennant on a pole (both faces, so it reads from any side). */
function pennant(g: GeoBuilder, x: number, y: number, z: number, color: RGB): void {
  g.cyl(x, y, z, 0.018, 0.014, 0.44, 5, PAL.timberDark);
  const a: [number, number, number] = [x, y + 0.44, z];
  const b: [number, number, number] = [x, y + 0.3, z];
  const c: [number, number, number] = [x + 0.26, y + 0.37, z + 0.02];
  g.triangle(a, b, c, color);
  g.triangle(b, a, c, color);
}

function door(g: GeoBuilder, x: number, z: number, w = 0.28, h = 0.4, base = 0.12): void {
  g.box(x, base, z, w + 0.08, h + 0.05, 0.04, PAL.timberDark);
  g.box(x, base, z + 0.012, w, h, 0.04, PAL.woodLight);
  g.box(x + w * 0.28, base + h * 0.45, z + 0.04, 0.03, 0.03, 0.02, PAL.gold);
}

function windowAt(
  g: GeoBuilder,
  gl: GeoBuilder,
  x: number,
  y: number,
  z: number,
  w = 0.26,
  h = 0.2,
  rot = 0,
): void {
  g.box(x, y - 0.03, z, w + 0.08, h + 0.07, 0.035, PAL.timberDark, rot);
  gl.box(x, y, z + 0.01 * Math.cos(rot), w, h, 0.03, WARM, rot);
}

function barrel(g: GeoBuilder, x: number, z: number, y = 0): void {
  g.cyl(x, y, z, 0.11, 0.1, 0.24, 8, PAL.woodLight);
  g.cyl(x, y + 0.06, z, 0.115, 0.115, 0.02, 8, PAL.timberDark, { capTop: false });
  g.cyl(x, y + 0.17, z, 0.108, 0.108, 0.02, 8, PAL.timberDark, { capTop: false });
}

function logPile(g: GeoBuilder, cx: number, cz: number, rot: number, len = 0.7, layers = 3): void {
  const wood = [PAL.woodLight, shade(PAL.woodLight, 0.85), rgb('#8f6a40')];
  for (let l = 0; l < layers; l++) {
    const n = layers - l + 1;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.17;
      const lx = off * Math.cos(rot + Math.PI / 2);
      const lz = -off * Math.sin(rot + Math.PI / 2);
      g.cylH(cx + lx, 0.08 + l * 0.14, cz + lz, len, 0.075, 6, wood[(i + l) % 3]!, rot, rgb('#d9b98a'));
    }
  }
}

function fenceLine(g: GeoBuilder, x0: number, z0: number, x1: number, z1: number, h = 0.32): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 0.32));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    g.box(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.05, h, 0.05, PAL.timber);
  }
  g.beam([x0, h * 0.8, z0], [x1, h * 0.8, z1], 0.014, PAL.woodLight);
  g.beam([x0, h * 0.45, z0], [x1, h * 0.45, z1], 0.014, PAL.woodLight);
}

/* ------------------------------------------------------------------ */
/* Cottage: three silhouettes                                          */
/* ------------------------------------------------------------------ */

function cottage(
  variant: number,
  era: number,
  seed: number,
): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  gl.jitter = 0;
  const plaster = [PAL.plaster, PAL.plasterWarm, rgb('#e9dcc0')][seed % 3]!;
  // Later ages re-roof in fired tile or slate; the first age thatches.
  const roof = roofFor(era, seed);
  const roofDark = shade(roof, era >= 1 ? 0.78 : 0.82);
  const bump = era >= 1 ? 0.0 : 0.07;
  const rows = era >= 1 ? 5 : 4;
  if (variant === 0) {
    // Longhouse with a long thatched ridge.
    g.box(0, 0, 0, 1.82, 0.12, 1.28, PAL.stoneDark);
    g.box(0, 0.12, 0, 1.7, 0.52, 1.14, plaster);
    for (const x of [-0.85, 0.85])
      for (const z of [-0.57, 0.57]) g.box(x, 0.12, z, 0.08, 0.54, 0.08, PAL.timber);
    for (const z of [-0.575, 0.575]) {
      g.box(0, 0.6, z, 1.74, 0.07, 0.08, PAL.timber);
      g.box(0, 0.12, z, 1.74, 0.05, 0.08, PAL.timber);
    }
    g.beam([-0.8, 0.14, 0.585], [-0.3, 0.6, 0.585], 0.018, PAL.timber);
    g.beam([0.8, 0.14, 0.585], [0.3, 0.6, 0.585], 0.018, PAL.timber);
    g.gable(0, 0.62, 0, 2.1, 1.55, 0.66, roof, {
      ridgeAxis: 'x',
      bump,
      rows,
      ridgeColor: roofDark,
      gableColor: era >= 1 ? plaster : PAL.thatchDark,
    });
    door(g, -0.4, 0.58);
    windowAt(g, gl, 0.45, 0.3, 0.585);
    windowAt(g, gl, 0, 0.3, -0.585, 0.26, 0.2, Math.PI);
    g.box(0.65, 0.6, -0.28, 0.22, 0.7, 0.22, PAL.stone, 0, PAL.stoneDark);
    g.box(0.65, 1.3, -0.28, 0.28, 0.06, 0.28, PAL.stoneDark);
    logPile(g, -0.55, -0.82, 0, 0.55, 2);
    barrel(g, 0.95, 0.72);
    if (era >= SPIRES) {
      spire(g, -0.98, 1.22, 0, 0.05, 0.34, roofDark);
      pennant(g, 0.65, 1.36, -0.28, PAL.red);
      return { g, gl, height: 1.8 };
    }
    return { g, gl, height: 1.3 };
  }
  if (variant === 1) {
    // Round hut with a conical thatch cap.
    g.cyl(0, 0, 0, 0.74, 0.72, 0.1, 12, PAL.stoneDark);
    g.cyl(0, 0.1, 0, 0.62, 0.6, 0.64, 12, plaster);
    for (let i = 0; i < 12; i += 2) {
      const a = (i / 12) * Math.PI * 2 + 0.3;
      g.box(Math.cos(a) * 0.63, 0.1, Math.sin(a) * 0.63, 0.07, 0.64, 0.07, PAL.timber);
    }
    // a thick eave rim, then a steep cone: a hut, not a parasol
    g.cyl(0, 0.68, 0, 0.84, 0.8, 0.1, 12, roofDark, { wobble: era >= 1 ? 0.01 : 0.05 });
    g.cyl(0, 0.78, 0, 0.8, 0.0, 0.92, 12, roof, { wobble: era >= 1 ? 0.02 : 0.07 });
    if (era >= SPIRES) {
      spire(g, 0, 1.6, 0, 0.07, 0.4, roofDark);
      pennant(g, 0.02, 1.86, 0, PAL.gold);
    } else g.cyl(0, 1.66, 0, 0.05, 0.03, 0.14, 5, PAL.timber);
    door(g, 0, 0.62, 0.26, 0.42);
    windowAt(g, gl, 0.47, 0.4, 0.38, 0.2, 0.17, 0.7);
    g.lump(-0.75, 0.1, 0.5, 0.18, 0.12, 0.16, PAL.stone, { seed: 1, rough: 0.2 });
    g.lump(0.8, 0.1, -0.2, 0.14, 0.1, 0.13, PAL.stone, { seed: 2, rough: 0.2 });
    barrel(g, -0.7, -0.35);
    return { g, gl, height: era >= SPIRES ? 2.3 : 1.8 };
  }
  // Framed cottage with a steep gable and a lean-to.
  g.box(0, 0, 0, 1.4, 0.12, 1.4, PAL.stoneDark);
  g.box(0, 0.12, 0, 1.28, 0.62, 1.28, plaster);
  for (const x of [-0.64, 0.64])
    for (const z of [-0.64, 0.64]) g.box(x, 0.12, z, 0.09, 0.64, 0.09, PAL.timberDark);
  g.box(0, 0.7, 0.645, 1.3, 0.07, 0.07, PAL.timberDark);
  g.beam([-0.6, 0.15, 0.655], [0.0, 0.72, 0.655], 0.02, PAL.timberDark);
  g.beam([0.6, 0.15, 0.655], [0.0, 0.72, 0.655], 0.02, PAL.timberDark);
  g.gable(0, 0.74, 0, 1.55, 1.62, 0.8, roof, {
    ridgeAxis: 'z',
    bump,
    rows,
    ridgeColor: roofDark,
    gableColor: era >= 1 ? plaster : PAL.thatchDark,
  });
  door(g, 0.0, 0.65, 0.3, 0.46);
  windowAt(g, gl, -0.45, 0.46, 0.645, 0.22, 0.22);
  windowAt(g, gl, 0.62, 0.46, 0.2, 0.2, 0.2, Math.PI / 2);
  // lean-to
  g.shed(-1.0, 0.1, -0.1, 0.5, 0.8, 0.5, 0.32, roofDark, 0, era >= 1 ? 0 : 0.04);
  for (const z of [-0.45, 0.25]) g.box(-1.2, 0, z, 0.05, 0.5, 0.05, PAL.timber);
  logPile(g, -1.0, -0.1, Math.PI / 2, 0.5, 2);
  g.box(0.45, 0.8, -0.35, 0.2, 0.75, 0.2, PAL.stone, 0, PAL.stoneDark);
  if (era >= SPIRES) {
    spire(g, 0, 1.48, 0.8, 0.05, 0.34, roofDark);
    pennant(g, 0.45, 1.55, -0.35, PAL.teal);
    return { g, gl, height: 2.0 };
  }
  return { g, gl, height: 1.6 };
}

/* ------------------------------------------------------------------ */
/* Farm                                                                */
/* ------------------------------------------------------------------ */

function farm(seed: number): { g: GeoBuilder; gl: GeoBuilder; crops: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const crops = new GeoBuilder(seed + 2);
  // Each farm grows its own crop, so several farms read as a patchwork: barley, wheat, or late ochre grain.
  const CROPS: [RGB, RGB][] = [
    [rgb('#8fb24e'), rgb('#b9c25a')],
    [rgb('#d9b84a'), rgb('#e6c45e')],
    [rgb('#d99a45'), rgb('#e0b25a')],
  ];
  const [cropA, cropB] = CROPS[seed % 3]!;
  g.box(0, 0, 0, 2.7, 0.05, 2.7, PAL.soil);
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const z = -1.0 + r * 0.4;
    g.box(0, 0.05, z, 2.4, 0.07, 0.2, r % 2 ? PAL.furrow : shade(PAL.soil, 1.15));
    for (let i = 0; i < 8; i++) {
      const x = -1.05 + i * 0.3 + (h01(seed, r, i) - 0.5) * 0.06;
      const col = mix(cropA, cropB, h01(seed, i, r + 9) * 0.6 + (r % 2) * 0.1);
      crops.lump(x, 0.12, z, 0.1, 0.12, 0.1, col, {
        rough: 0.08,
        detail: 1,
        seed: r * 8 + i,
        topColor: mix(col, PAL.cropGold, 0.5),
      });
    }
  }
  // fence: three sides plus a gap on the south side
  fenceLine(g, -1.42, -1.42, 1.42, -1.42);
  fenceLine(g, -1.42, -1.42, -1.42, 1.42);
  fenceLine(g, 1.42, -1.42, 1.42, 1.42);
  fenceLine(g, -1.42, 1.42, -0.35, 1.42);
  fenceLine(g, 0.35, 1.42, 1.42, 1.42);
  // scarecrow
  g.box(1.15, 0, 1.1, 0.04, 0.6, 0.04, PAL.timber);
  g.beam([0.9, 0.42, 1.1], [1.4, 0.42, 1.1], 0.015, PAL.timber);
  g.lump(1.15, 0.66, 1.1, 0.08, 0.09, 0.08, PAL.straw, { detail: 0, rough: 0.05 });
  g.cyl(1.15, 0.72, 1.1, 0.12, 0.02, 0.1, 6, rgb('#7a4a2a'));
  g.box(1.15, 0.3, 1.1, 0.22, 0.2, 0.06, PAL.red);
  // haystack and a basket
  g.cyl(-1.15, 0, 1.0, 0.24, 0.02, 0.4, 8, PAL.straw, { wobble: 0.1 });
  g.cyl(-0.7, 0, 1.15, 0.1, 0.12, 0.1, 8, PAL.woodLight);
  return { g, gl, crops, height: 0.9 };
}

/* ------------------------------------------------------------------ */
/* Lumber camp                                                         */
/* ------------------------------------------------------------------ */

function lumberCamp(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  // lean-to shelter on the back
  for (const [x, z] of [
    [-0.8, -0.8],
    [0.1, -0.8],
    [-0.8, -0.2],
    [0.1, -0.2],
  ] as [number, number][])
    g.box(x, 0, z, 0.07, x < -0.5 ? 0.8 : 0.55, 0.07, PAL.timber);
  g.shed(-0.35, 0.58, -0.5, 1.15, 0.85, 0.34, 0.0, PAL.thatch, 0, 0.06);
  g.box(-0.35, 0, -0.5, 0.9, 0.04, 0.6, shade(PAL.earth, 0.9));
  g.box(-0.35, 0.28, -0.68, 0.7, 0.06, 0.3, PAL.woodLight); // workbench plank
  g.box(-0.6, 0, -0.68, 0.05, 0.28, 0.05, PAL.timber);
  g.box(-0.1, 0, -0.68, 0.05, 0.28, 0.05, PAL.timber);
  // log pile
  logPile(g, 0.5, 0.45, 0, 0.9, 4);
  // chopping stump with an axe
  g.cyl(-0.5, 0, 0.55, 0.2, 0.18, 0.28, 8, PAL.woodLight, { capColor: rgb('#dcbf8c') });
  g.beam([-0.46, 0.3, 0.55], [-0.28, 0.5, 0.45], 0.014, PAL.timber);
  g.box(-0.28, 0.46, 0.43, 0.1, 0.07, 0.03, PAL.stoneDark, 0.5);
  // sawhorse
  for (const s of [-1, 1]) {
    g.beam([0.1 + s * 0.12, 0, -0.1], [0.1, 0.26, 0.05], 0.015, PAL.timber);
    g.beam([0.1 + s * 0.12, 0, 0.2], [0.1, 0.26, 0.05], 0.015, PAL.timber);
  }
  g.cylH(0.1, 0.3, 0.05, 0.5, 0.045, 6, PAL.woodLight, Math.PI / 2, rgb('#d9b98a'));
  // chips and a couple of stumps
  for (let i = 0; i < 9; i++)
    g.box(
      -0.9 + h01(seed, i, 1) * 1.5,
      0,
      0.1 + h01(seed, i, 2) * 0.8,
      0.07,
      0.015,
      0.04,
      rgb('#d9b98a'),
      h01(seed, i, 3) * 3,
    );
  g.cyl(0.85, 0, -0.75, 0.13, 0.11, 0.15, 7, PAL.woodLight, { capColor: rgb('#dcbf8c') });
  return { g, gl, height: 0.95 };
}

/* ------------------------------------------------------------------ */
/* Quarry                                                              */
/* ------------------------------------------------------------------ */

function quarry(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const rock = [PAL.stone, PAL.stoneLight, PAL.stoneDark];
  // stepped cut face along the back
  g.box(0, 0, -0.55, 2.6, 0.5, 0.9, rock[2]!, 0, rock[1]);
  g.box(0.2, 0.5, -0.65, 1.9, 0.4, 0.6, rock[0]!, 0, rock[1]);
  g.box(0.5, 0.9, -0.72, 1.1, 0.3, 0.36, rock[2]!, 0, rock[1]);
  // cut blocks on the floor
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + (i % 3) * 0.5 + h01(seed, i, 1) * 0.15;
    const z = 0.2 + Math.floor(i / 3) * 0.45;
    g.box(
      x,
      0,
      z,
      0.32 + h01(seed, i, 2) * 0.1,
      0.2 + (i % 2) * 0.08,
      0.28,
      rock[i % 3]!,
      h01(seed, i, 4) * 0.6,
      rock[1],
    );
  }
  g.box(0.9, 0, 0.5, 0.36, 0.3, 0.36, rock[1]!, 0.3, rock[1]);
  g.box(0.9, 0.3, 0.5, 0.3, 0.24, 0.3, rock[0]!, -0.2, rock[1]);
  // wooden A-frame crane
  g.beam([1.0, 0, -0.2], [1.2, 1.1, 0.05], 0.035, PAL.timber);
  g.beam([1.4, 0, -0.2], [1.2, 1.1, 0.05], 0.035, PAL.timber);
  g.beam([1.2, 1.1, 0.05], [0.6, 0.95, 0.5], 0.028, PAL.timberDark);
  g.beam([0.6, 0.95, 0.5], [0.6, 0.55, 0.5], 0.008, PAL.woodLight);
  g.box(0.6, 0.38, 0.5, 0.22, 0.18, 0.2, rock[0]!);
  // sledge, pick and rubble
  g.box(-0.2, 0.02, 0.95, 0.8, 0.05, 0.3, PAL.woodLight);
  g.beam([-0.6, 0.02, 0.95], [-0.7, 0.12, 0.95], 0.02, PAL.timber);
  g.box(-0.2, 0.07, 0.95, 0.3, 0.16, 0.24, rock[1]!);
  g.beam([-1.2, 0, 0.9], [-1.0, 0.5, 0.7], 0.012, PAL.timber);
  g.box(-1.0, 0.48, 0.7, 0.18, 0.025, 0.03, PAL.stoneDark, 0.4);
  for (let i = 0; i < 7; i++)
    g.lump(-1.2 + h01(seed, i, 7) * 2.4, 0.04, -0.1 + h01(seed, i, 8) * 1.3, 0.09, 0.06, 0.08, rock[i % 3]!, {
      detail: 0,
      seed: i,
    });
  g.disc(0, 0.01, 0.3, 1.45, 14, shade(PAL.stoneLight, 0.95), 0.2);
  return { g, gl, height: 1.3 };
}

/* ------------------------------------------------------------------ */
/* Workshop                                                            */
/* ------------------------------------------------------------------ */

function workshop(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.box(0, 0, 0, 1.8, 0.08, 1.5, PAL.stoneDark);
  for (const x of [-0.8, 0.8]) for (const z of [-0.65, 0.65]) g.box(x, 0.08, z, 0.09, 0.78, 0.09, PAL.timber);
  g.box(0, 0.8, -0.65, 1.7, 0.08, 0.1, PAL.timberDark);
  g.box(0, 0.8, 0.65, 1.7, 0.08, 0.1, PAL.timberDark);
  g.box(0, 0.35, -0.68, 1.7, 0.7, 0.05, shade(PAL.woodLight, 0.9)); // back wall
  g.gable(0, 0.86, 0, 2.05, 1.7, 0.55, rgb('#a8814e'), {
    ridgeAxis: 'x',
    rows: 5,
    ridgeColor: PAL.timberDark,
    gableColor: PAL.timber,
  });
  // bench, anvil, barrel, tools
  g.box(-0.3, 0.08, -0.35, 1.0, 0.04, 0.4, PAL.woodLight);
  for (const x of [-0.75, 0.15])
    for (const z of [-0.5, -0.2]) g.box(x, 0.08, z, 0.05, 0.28, 0.05, PAL.timber);
  g.box(0.55, 0.08, -0.15, 0.2, 0.18, 0.2, PAL.stoneDark);
  g.frustum(0.55, 0.26, -0.15, 0.26, 0.12, 0.34, 0.14, 0.1, rgb('#4a4f55'));
  barrel(g, 0.65, 0.35, 0.08);
  for (let i = 0; i < 4; i++)
    g.box(-0.6 + i * 0.28, 0.45, -0.64, 0.04, 0.24, 0.03, i % 2 ? PAL.stoneDark : PAL.woodLight, 0.2);
  for (let i = 0; i < 4; i++) g.box(-0.7, 0.08 + i * 0.05, 0.4, 0.55, 0.045, 0.16, PAL.woodLight, 0.05 * i);
  gl.lump(0.55, 0.38, -0.15, 0.05, 0.03, 0.05, WARM_DIM, { detail: 0, rough: 0 });
  return { g, gl, height: 1.4 };
}

/* ------------------------------------------------------------------ */
/* Archive                                                             */
/* ------------------------------------------------------------------ */

function archive(era: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.jitter = 0.05;
  const sand = PAL.sandstone;
  g.box(0, 0, 0, 2.8, 0.1, 2.7, PAL.stoneLight);
  g.box(0, 0.1, 0, 2.5, 0.1, 2.4, PAL.stone);
  g.masonry(0, 0.2, -0.1, 1.9, 1.0, 1.7, sand, 0, { course: 0.14, block: 0.36, spread: 0.12 });
  g.box(0, 0.2, -0.1, 1.98, 0.08, 1.78, PAL.stoneDark);
  g.box(0, 1.1, -0.1, 1.98, 0.08, 1.78, PAL.gold);
  // hip roof in deep teal tile with gold finial
  g.gable(0, 1.18, -0.1, 2.25, 2.0, 0.62, PAL.teal, {
    ridgeAxis: 'x',
    rows: 5,
    ridgeColor: PAL.gold,
    gableColor: sand,
  });
  g.cyl(0, 1.78, -0.1, 0.05, 0.02, 0.2, 6, PAL.gold);
  // portico: columns, lintel and pediment
  const cz = 0.95;
  for (const x of [-0.75, -0.25, 0.25, 0.75]) {
    g.cyl(x, 0.2, cz, 0.07, 0.065, 0.78, 8, PAL.white);
    g.box(x, 0.2, cz, 0.16, 0.05, 0.16, PAL.stoneLight);
    g.box(x, 0.97, cz, 0.17, 0.05, 0.17, PAL.stoneLight);
  }
  g.box(0, 1.02, cz, 1.9, 0.14, 0.3, PAL.stoneLight);
  g.triangle([-0.95, 1.16, cz + 0.15], [0.95, 1.16, cz + 0.15], [0, 1.52, cz + 0.15], PAL.stoneLight);
  g.triangle([0.95, 1.16, cz - 0.15], [-0.95, 1.16, cz - 0.15], [0, 1.52, cz - 0.15], PAL.stoneLight);
  g.quad(
    [-0.95, 1.16, cz + 0.15],
    [-0.95, 1.16, cz - 0.15],
    [0, 1.52, cz - 0.15],
    [0, 1.52, cz + 0.15],
    shade(PAL.stoneLight, 0.85),
  );
  g.quad(
    [0.95, 1.16, cz - 0.15],
    [0.95, 1.16, cz + 0.15],
    [0, 1.52, cz + 0.15],
    [0, 1.52, cz - 0.15],
    shade(PAL.stoneLight, 0.85),
  );
  // door and slit windows
  g.box(0, 0.2, 0.77, 0.42, 0.62, 0.05, PAL.timberDark);
  gl.box(0, 0.24, 0.8, 0.3, 0.5, 0.03, WARM_DIM);
  for (const x of [-0.7, 0.7]) gl.box(x, 0.5, 0.77, 0.14, 0.38, 0.03, WARM);
  // banners and tablet stacks
  g.beam([-1.2, 0, 1.1], [-1.2, 1.0, 1.1], 0.02, PAL.timber);
  g.box(-1.2, 0.62, 1.12, 0.22, 0.36, 0.02, PAL.red);
  for (let i = 0; i < 4; i++)
    g.box(
      1.1 + (i % 2) * 0.05,
      0.2 + i * 0.06,
      1.05,
      0.34,
      0.05,
      0.22,
      i % 2 ? PAL.clay : PAL.terracotta,
      i * 0.15,
    );
  if (era >= SPIRES) {
    // a bell tower behind the hall: dressed stone, lit belfry openings and a copper spire
    const tx = 0.62;
    const tz = -0.62;
    g.masonry(tx, 0.2, tz, 0.56, 1.95, 0.56, sand, 0, { course: 0.14, block: 0.3, spread: 0.1 });
    g.box(tx, 2.15, tz, 0.64, 0.07, 0.64, PAL.gold);
    gl.box(tx, 1.72, tz + 0.29, 0.16, 0.26, 0.03, WARM);
    gl.box(tx + 0.29, 1.72, tz, 0.16, 0.26, 0.03, WARM, Math.PI / 2);
    spire(g, tx, 2.22, tz, 0.42, 0.95, roofFor(era, seed));
    return { g, gl, height: 3.3 };
  }
  return { g, gl, height: 1.9 };
}

/* ------------------------------------------------------------------ */
/* Seed vault                                                          */
/* ------------------------------------------------------------------ */

function seedVault(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.lump(0, -0.1, -0.1, 0.95, 0.85, 0.85, rgb('#6c8f45'), {
    rough: 0.06,
    detail: 1,
    seed: 3,
    topColor: rgb('#8cc05a'),
  });
  // stone doorway on the south side
  g.box(-0.34, 0, 0.62, 0.16, 0.62, 0.2, PAL.stone, 0, PAL.stoneLight);
  g.box(0.34, 0, 0.62, 0.16, 0.62, 0.2, PAL.stone, 0, PAL.stoneLight);
  g.box(0, 0.62, 0.62, 0.9, 0.14, 0.24, PAL.stoneLight);
  g.box(0, 0, 0.58, 0.52, 0.6, 0.1, PAL.timberDark);
  g.box(0, 0.3, 0.64, 0.06, 0.06, 0.03, PAL.gold);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + (i / 6) * 0.7);
    g.lump(Math.cos(a) * 0.95, 0.07, 0.3 + Math.sin(a) * 0.62, 0.13, 0.1, 0.12, PAL.stone, {
      detail: 0,
      seed: i,
      rough: 0.2,
    });
  }
  // jars and sprouts
  for (const [x, z] of [
    [-0.85, 0.7],
    [0.82, 0.78],
  ] as [number, number][]) {
    g.cyl(x, 0, z, 0.1, 0.12, 0.2, 8, PAL.clay);
    g.cyl(x, 0.2, z, 0.06, 0.07, 0.07, 8, PAL.terracotta);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.cyl(Math.cos(a) * 0.3, 0.72, -0.1 + Math.sin(a) * 0.25, 0.025, 0.0, 0.14, 4, PAL.leafLight);
  }
  g.box(0.95, 0, 0.0, 0.04, 0.42, 0.04, PAL.timber);
  g.box(0.95, 0.28, 0.02, 0.3, 0.16, 0.03, PAL.woodLight);
  return { g, gl, height: 0.85 };
}

/* ------------------------------------------------------------------ */
/* Firebreak: a scraped, dug strip with banks and flags                */
/* ------------------------------------------------------------------ */

function firebreak(w: number, h: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const along = w >= h ? 'x' : 'z';
  const L = Math.max(w, h) - 0.2;
  const T = Math.min(w, h) - 0.2;
  const bare = PAL.earthDark;
  const box = (
    a: number,
    b: number,
    c: number,
    sa: number,
    sb: number,
    sc: number,
    col: typeof bare,
    top?: typeof bare,
  ) => {
    if (along === 'x') g.box(a, b, c, sa, sb, sc, col, 0, top);
    else g.box(c, b, a, sc, sb, sa, col, 0, top);
  };
  box(0, 0, 0, L, 0.035, T, bare, shade(PAL.earth, 0.8));
  box(0, 0.035, T * 0.22, L * 0.98, 0.06, T * 0.12, shade(PAL.earth, 1.1));
  box(0, 0.035, -T * 0.22, L * 0.98, 0.06, T * 0.12, shade(PAL.earth, 1.1));
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6 - 0.5;
    box(
      t * L,
      0.05,
      (h01(seed, i, 1) - 0.5) * T * 0.5,
      0.35,
      0.05,
      0.18,
      shade(PAL.earth, 0.85 + h01(seed, i, 2) * 0.3),
    );
  }
  // marker stakes with red flags at both ends
  for (const e of [-1, 1]) {
    const px = along === 'x' ? e * (L / 2 - 0.1) : 0;
    const pz = along === 'x' ? 0 : e * (L / 2 - 0.1);
    g.box(px, 0, pz, 0.04, 0.5, 0.04, PAL.timber);
    g.box(px + 0.1, 0.34, pz, 0.2, 0.13, 0.015, PAL.red);
  }
  return { g, gl, height: 0.5 };
}

/* ------------------------------------------------------------------ */
/* Hearth                                                              */
/* ------------------------------------------------------------------ */

function hearth(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.disc(0, 0.012, 0, 0.98, 18, shade(PAL.earth, 1.15), 0.12);
  g.cyl(0, 0.01, 0, 0.62, 0.56, 0.05, 14, PAL.stoneDark);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lump(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5, 0.15, 0.1, 0.13, i % 2 ? PAL.stone : PAL.stoneLight, {
      detail: 0,
      seed: i,
      rough: 0.18,
    });
  }
  g.cylH(0, 0.12, 0, 0.5, 0.045, 6, PAL.bark, 0.5, rgb('#c9a06a'));
  g.cylH(0, 0.17, 0, 0.5, 0.045, 6, PAL.timber, -0.7, rgb('#c9a06a'));
  gl.cyl(0, 0.1, 0, 0.26, 0.0, 0.1, 7, WARM_DIM);
  // cooking tripod and pot
  g.beam([-0.28, 0, 0.3], [0, 0.78, 0.0], 0.014, PAL.timber);
  g.beam([0.28, 0, 0.3], [0, 0.78, 0.0], 0.014, PAL.timber);
  g.beam([0, 0, -0.34], [0, 0.78, 0.0], 0.014, PAL.timber);
  g.cyl(0, 0.46, 0, 0.1, 0.08, 0.1, 8, PAL.char);
  // log seats around the fire
  for (const [x, z, r] of [
    [0.85, 0.4, 0.2],
    [-0.8, 0.5, -0.4],
    [0.0, -0.9, 1.5],
    [-0.5, 0.95, 0.9],
  ] as [number, number, number][]) {
    g.cylH(x, 0.1, z, 0.46, 0.1, 6, PAL.woodLight, r, rgb('#d9b98a'));
  }
  return { g, gl, height: 0.9 };
}

/* ------------------------------------------------------------------ */
/* Granary: a round, sealed stone store with a steep roof              */
/* ------------------------------------------------------------------ */

function granary(era: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const roof =
    era >= SPIRES ? roofFor(era, seed) : era >= 2 ? PAL.slate : era >= 1 ? PAL.terracotta : PAL.thatch;
  g.cyl(0, 0, 0, 0.92, 0.9, 0.14, 12, PAL.stoneDark);
  g.cyl(0, 0.14, 0, 0.78, 0.74, 0.88, 12, PAL.stone, { wobble: 0.03 });
  for (const y of [0.34, 0.58, 0.82])
    g.cyl(0, y, 0, 0.785, 0.785, 0.025, 12, PAL.stoneDark, { capTop: false });
  g.cyl(0, 1.0, 0, 0.9, 0.0, 0.78, 12, roof, { wobble: era >= 1 ? 0.01 : 0.08 });
  if (era >= SPIRES) {
    // a lantern cupola on the cone, lit, under a copper spire
    g.cyl(0, 1.56, 0, 0.17, 0.17, 0.26, 8, PAL.stoneLight);
    gl.cyl(0, 1.62, 0, 0.175, 0.175, 0.13, 8, WARM, { capTop: false });
    spire(g, 0, 1.82, 0, 0.21, 0.42, roof);
  } else g.cyl(0, 1.74, 0, 0.05, 0.03, 0.14, 5, PAL.timber);
  door(g, 0, 0.74, 0.3, 0.46, 0.14);
  g.box(0.1, 0.78, 0.7, 0.34, 0.22, 0.06, PAL.timberDark);
  for (const [x, z] of [
    [0.95, 0.5],
    [-0.9, 0.7],
  ] as [number, number][]) {
    g.cyl(x, 0, z, 0.2, 0.18, 0.34, 8, PAL.sandstone);
    g.cyl(x, 0.34, z, 0.07, 0.0, 0.1, 6, PAL.sandstone);
  }
  barrel(g, -0.9, -0.4);
  return { g, gl, height: era >= SPIRES ? 2.4 : 1.8 };
}

/* ------------------------------------------------------------------ */
/* Stone house: ashlar walls, tiled roof                               */
/* ------------------------------------------------------------------ */

function stoneHouse(
  variant: number,
  era: number,
  seed: number,
): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const wall = [PAL.stone, PAL.stoneLight, PAL.sandstone][variant % 3]!;
  const roof = roofFor(Math.max(1, era), seed);
  const ridge = shade(roof, 0.78);
  g.box(0, 0, 0, 1.78, 0.12, 1.66, PAL.stoneDark);
  // ashlar walls and dressed corner stones
  g.masonry(0, 0.12, 0, 1.6, 0.8, 1.48, wall, 0, { course: 0.16, block: 0.34 });
  for (const x of [-0.78, 0.78])
    for (const z of [-0.72, 0.72]) g.box(x, 0.12, z, 0.17, 0.82, 0.17, PAL.stoneLight);
  g.gable(0, 0.94, 0, 1.92, 1.74, 0.64, roof, {
    ridgeAxis: variant === 1 ? 'z' : 'x',
    rows: 5,
    ridgeColor: ridge,
    gableColor: wall,
  });
  // chimney, door with a stone lintel, shuttered windows
  g.box(variant === 1 ? -0.45 : 0.55, 0.95, variant === 1 ? 0.2 : -0.25, 0.22, 0.75, 0.22, PAL.stoneDark);
  g.box(variant === 1 ? -0.45 : 0.55, 1.7, variant === 1 ? 0.2 : -0.25, 0.28, 0.05, 0.28, PAL.stone);
  door(g, -0.3, 0.74, 0.3, 0.5);
  g.box(-0.3, 0.64, 0.75, 0.46, 0.07, 0.07, PAL.stoneLight);
  windowAt(g, gl, 0.45, 0.42, 0.745, 0.24, 0.26);
  windowAt(g, gl, 0, 0.42, -0.745, 0.24, 0.26, Math.PI);
  g.box(0.1, 0.35, 0.76, 0.06, 0.34, 0.02, era >= 1 ? PAL.teal : PAL.timberDark);
  g.box(0.8, 0.35, 0.3, 0.02, 0.34, 0.06, era >= 1 ? PAL.teal : PAL.timberDark);
  barrel(g, 0.95, 0.9);
  g.lump(-0.95, 0.1, 0.55, 0.16, 0.1, 0.14, PAL.stone, { seed: 2, rough: 0.2 });
  if (era >= SPIRES) {
    // a corner turret, away from the chimney, with a lit slit window and a copper spire
    const tx = variant === 1 ? 0.78 : -0.78;
    const tz = -0.72;
    g.cyl(tx, 0.12, tz, 0.3, 0.28, 1.52, 10, wall, { capColor: PAL.stoneLight });
    g.cyl(tx, 1.64, tz, 0.34, 0.34, 0.07, 10, PAL.stoneLight);
    gl.box(tx, 1.0, tz + 0.285, 0.07, 0.22, 0.03, WARM);
    spire(g, tx, 1.71, tz, 0.35, 0.82, roof);
    pennant(g, tx, 2.5, tz, PAL.red);
    return { g, gl, height: 2.95 };
  }
  return { g, gl, height: 1.65 };
}

/* ------------------------------------------------------------------ */
/* Levee: a turfed earth bank with a stone-faced toe                   */
/* ------------------------------------------------------------------ */

function levee(w: number, h: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const rotY = h > w ? Math.PI / 2 : 0;
  const L = Math.max(w, h) - 0.1;
  g.jitter = 0.04;
  g.frustum(0, 0, 0, L, 1.0, L - 0.55, 0.42, 0.78, rgb('#8a6a46'), rotY);
  g.box(0, 0.78, 0, L - 0.58, 0.07, 0.46, rgb('#8fa758'), rotY);
  // stone facing blocks along the toe, river side
  const n = Math.round(L / 0.5);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const off = h01(seed, i, 3) * 0.04;
    // along axis in world: x for rotY 0; local z is the span
    const lx = t * L;
    const lz = -0.5 + off;
    const wx = rotY === 0 ? lx : lz;
    const wz = rotY === 0 ? lz : -lx;
    g.box(wx, 0, wz, 0.4, 0.22, 0.12, i % 2 ? PAL.stone : PAL.stoneLight, rotY);
  }
  // stakes and a measuring post
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4 - 0.5;
    const lx = t * (L - 0.4);
    const wx = rotY === 0 ? lx : 0.52;
    const wz = rotY === 0 ? 0.52 : -lx;
    g.box(wx, 0, wz, 0.045, 0.34, 0.045, PAL.timber);
  }
  return { g, gl, height: 0.9 };
}

/* ------------------------------------------------------------------ */
/* Dam: a masonry wall across the river with a spillway                */
/* ------------------------------------------------------------------ */

function dam(w: number, h: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const rotY = h > w ? Math.PI / 2 : 0;
  const L = Math.max(w, h) - 0.2;
  g.jitter = 0.03;
  const seg = (x0: number, x1: number, y: number, hgt: number, depth: number, col: typeof PAL.stone) => {
    const mx = (x0 + x1) / 2;
    const [wx, wz] = rotY === 0 ? [mx, 0] : [0, -mx];
    g.masonry(wx, y, wz, x1 - x0, hgt, depth, col, rotY, { course: 0.2, block: 0.42, top: PAL.stoneLight });
  };
  // bank-side wall sections, full height; a lower weir in the middle
  seg(-L / 2, -0.45, -0.5, 1.7, 0.78, PAL.stone);
  seg(0.45, L / 2, -0.5, 1.7, 0.78, PAL.stone);
  seg(-0.45, 0.45, -0.5, 1.15, 0.78, PAL.stoneDark);
  // spillway sheet
  g.frustum(0, 0.6, 0.15, 0.9, 0.26, 0.9, 0.7, 0.04, rgb('#9fd8ea'), rotY);
  // walkway with posts along the crest
  g.box(0, 1.2, 0, L, 0.09, 0.9, PAL.stoneLight, rotY);
  for (let i = 0; i <= 6; i++) {
    const lx = (i / 6 - 0.5) * (L - 0.2);
    if (Math.abs(lx) < 0.5) continue;
    const wx = rotY === 0 ? lx : 0.4;
    const wz = rotY === 0 ? 0.4 : -lx;
    g.box(wx, 1.29, wz, 0.07, 0.3, 0.07, PAL.timber);
  }
  // downstream buttresses and a sluice gate house
  for (const lx of [-1.4, -0.8, 0.8, 1.4]) {
    if (Math.abs(lx) > L / 2 - 0.2) continue;
    const wx = rotY === 0 ? lx : 0.55;
    const wz = rotY === 0 ? 0.55 : -lx;
    g.frustum(wx, -0.5, wz, 0.3, 0.36, 0.22, 0.12, 1.1, PAL.stoneDark, rotY);
  }
  const gx = rotY === 0 ? 1.2 : 0;
  const gz = rotY === 0 ? 0 : -1.2;
  g.box(gx, 1.29, gz, 0.5, 0.45, 0.5, PAL.plaster);
  g.gable(gx, 1.74, gz, 0.6, 0.6, 0.28, PAL.teal, { ridgeAxis: 'x', rows: 3, rotY });
  return { g, gl, height: 2.0 };
}

/* ------------------------------------------------------------------ */
/* Bridge: stone piers, a paved deck and parapets                      */
/* ------------------------------------------------------------------ */

function bridge(w: number, h: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const rotY = h > w ? Math.PI / 2 : 0;
  const L = Math.max(w, h) - 0.1;
  g.jitter = 0.03;
  const at = (lx: number, lz: number): [number, number] => (rotY === 0 ? [lx, lz] : [lz, -lx]);
  for (const lx of [-L * 0.32, 0, L * 0.32]) {
    const [x, z] = at(lx, 0);
    g.masonry(x, -0.45, z, 0.5, 0.95, 0.7, PAL.stone, rotY, {
      course: 0.17,
      block: 0.3,
      top: PAL.stoneLight,
    });
  }
  g.box(0, 0.5, 0, L, 0.14, 0.82, PAL.sandstone, rotY, PAL.stoneLight);
  for (const lz of [-0.4, 0.4]) {
    const [x, z] = at(0, lz);
    g.masonry(x, 0.64, z, L - 0.1, 0.2, 0.09, PAL.stoneLight, rotY, { course: 0.2, block: 0.4 });
    for (let i = 0; i <= 5; i++) {
      const [px, pz] = at((i / 5 - 0.5) * (L - 0.2), lz);
      g.box(px, 0.64, pz, 0.12, 0.3, 0.12, PAL.stone, rotY);
    }
  }
  // approach ramps at each end
  for (const e of [-1, 1]) {
    const [x, z] = at(e * (L / 2 + 0.02), 0);
    g.frustum(x, 0, z, 0.5, 0.9, 0.2, 0.84, 0.5, shade(PAL.earth, 1.1), rotY + (e > 0 ? 0 : Math.PI));
  }
  return { g, gl, height: 1.0 };
}

/* ------------------------------------------------------------------ */
/* Retaining wall: buttressed stonework                                */
/* ------------------------------------------------------------------ */

function retainingWall(
  w: number,
  h: number,
  seed: number,
): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  const rotY = h > w ? Math.PI / 2 : 0;
  const L = Math.max(w, h) - 0.12;
  g.jitter = 0.04;
  // battered face: a wide footing course, then the wall, then a coping
  g.masonry(0, 0, 0, L, 0.3, 0.52, PAL.stoneDark, rotY, { course: 0.15, block: 0.34 });
  g.masonry(0, 0.3, 0, L - 0.06, 0.42, 0.4, PAL.stone, rotY, { course: 0.14, block: 0.3 });
  g.box(0, 0.72, 0, L - 0.04, 0.08, 0.46, PAL.stoneLight, rotY);
  const n = Math.max(2, Math.round(L / 0.95));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const lx = t * (L - 0.2);
    const wx = rotY === 0 ? lx : 0.34;
    const wz = rotY === 0 ? 0.34 : -lx;
    g.frustum(wx, 0, wz, 0.3, 0.38, 0.22, 0.12, 0.62, PAL.stoneDark, rotY);
  }
  return { g, gl, height: 0.82 };
}

/* ------------------------------------------------------------------ */
/* Forge: a brick smithy with a glowing furnace and a tall stack        */
/* ------------------------------------------------------------------ */

function forge(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  gl.jitter = 0;
  const brick = rgb('#a2503e');
  g.box(0, 0, 0, 2.7, 0.1, 1.8, PAL.stoneDark);
  g.masonry(-0.25, 0.1, -0.1, 1.9, 0.82, 1.35, PAL.stone, 0, { course: 0.16, block: 0.3 });
  g.box(-0.25, 0.1, 0.58, 1.95, 0.05, 0.1, PAL.timberDark);
  // open front: furnace mouth glowing between two stone piers
  g.box(-0.9, 0.1, 0.62, 0.22, 0.82, 0.16, PAL.stoneDark);
  g.box(0.1, 0.1, 0.62, 0.22, 0.82, 0.16, PAL.stoneDark);
  g.box(-0.4, 0.78, 0.62, 0.9, 0.14, 0.16, PAL.stoneDark);
  gl.box(-0.4, 0.14, 0.58, 0.7, 0.58, 0.04, rgb('#ff7a24'));
  gl.box(-0.4, 0.14, 0.55, 0.5, 0.34, 0.04, rgb('#ffc24a'));
  // brick stack
  g.masonry(0.5, 0.92, -0.35, 0.4, 1.0, 0.4, brick, 0, { course: 0.08, block: 0.16, gap: 0.014 });
  g.box(0.5, 1.92, -0.35, 0.44, 0.06, 0.44, PAL.stoneDark);
  g.gable(-0.25, 0.92, -0.1, 2.1, 1.55, 0.5, PAL.slate, {
    ridgeAxis: 'x',
    rows: 4,
    ridgeColor: shade(PAL.slate, 0.7),
    gableColor: PAL.stone,
  });
  // anvil, quench trough, charcoal and bellows
  g.box(1.1, 0.1, 0.3, 0.3, 0.18, 0.16, PAL.char);
  g.box(1.1, 0.04, 0.3, 0.2, 0.08, 0.2, PAL.timber);
  g.box(1.05, 0.1, -0.35, 0.5, 0.2, 0.28, PAL.timberDark);
  g.box(1.05, 0.28, -0.35, 0.44, 0.02, 0.22, rgb('#4a7a8a'));
  g.lump(-1.15, 0.12, -0.55, 0.3, 0.17, 0.25, PAL.char, { seed: 3, rough: 0.28 });
  logPile(g, 0.7, 0.75, 0.2, 0.5, 2);
  return { g, gl, height: 2.0 };
}

/* ------------------------------------------------------------------ */
/* Grove: staked saplings in rows                                      */
/* ------------------------------------------------------------------ */

function grove(seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.disc(0, 0.01, 0, 1.35, 16, shade(PAL.earth, 1.25), 0.1);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.8 + (h01(seed, i, j) - 0.5) * 0.22;
      const z = (j - 1) * 0.8 + (h01(seed, j, i + 4) - 0.5) * 0.22;
      const s = 0.8 + h01(seed, i + 7, j) * 0.5;
      const kind = (i + j) % 2;
      g.cyl(x, 0.02, z, 0.045, 0.035, 0.34 * s, 5, PAL.bark);
      if (kind === 0) {
        g.cyl(x, 0.24 * s, z, 0.27 * s, 0.0, 0.62 * s, 7, PAL.leafDark);
        g.cyl(x, 0.5 * s, z, 0.2 * s, 0.0, 0.5 * s, 7, PAL.leaf);
      } else {
        g.lump(x, 0.36 * s, z, 0.27 * s, 0.24 * s, 0.27 * s, PAL.leaf, {
          seed: i + j,
          topColor: PAL.leafLight,
        });
      }
      g.box(x + 0.16, 0, z + 0.1, 0.03, 0.26, 0.03, PAL.woodLight);
    }
  }
  // rope-and-stake fence, with a marker board
  fenceLine(g, -1.35, 1.35, 1.35, 1.35, 0.25);
  g.box(1.35, 0, 1.2, 0.04, 0.5, 0.04, PAL.timber);
  g.box(1.35, 0.32, 1.22, 0.3, 0.16, 0.03, PAL.woodLight);
  return { g, gl, height: 1.2 };
}

/* ------------------------------------------------------------------ */
/* Generic stand-ins for buildings whose gameplay arrives later        */
/* ------------------------------------------------------------------ */

function generic(w: number, h: number, seed: number): { g: GeoBuilder; gl: GeoBuilder; height: number } {
  const g = new GeoBuilder(seed);
  const gl = new GeoBuilder(seed + 1);
  g.box(0, 0, 0, w * 0.85, 0.5, h * 0.85, PAL.stone);
  g.gable(0, 0.5, 0, w * 0.95, h * 0.95, 0.4, PAL.slate, { ridgeAxis: w >= h ? 'x' : 'z' });
  return { g, gl, height: 0.95 };
}

/* ------------------------------------------------------------------ */
/* Public builders                                                     */
/* ------------------------------------------------------------------ */

export function buildingModel(
  kind: BuildingKind,
  w: number,
  h: number,
  variant: number,
  seed: number,
  /** Architectural age (the epoch the building was raised in): 0 thatch, 1 tile, 2 slate, 3+ copper and spires. */
  era = 0,
): BuildingModel {
  let r: { g: GeoBuilder; gl: GeoBuilder; crops?: GeoBuilder; height: number };
  switch (kind) {
    case 'cottage':
      r = cottage(variant % 3, era, seed);
      break;
    case 'farm':
      r = farm(seed);
      break;
    case 'lumber_camp':
      r = lumberCamp(seed);
      break;
    case 'quarry':
      r = quarry(seed);
      break;
    case 'workshop':
      r = workshop(seed);
      break;
    case 'archive':
      r = archive(era, seed);
      break;
    case 'seed_vault':
      r = seedVault(seed);
      break;
    case 'firebreak':
      r = firebreak(w, h, seed);
      break;
    case 'hearth':
      r = hearth(seed);
      break;
    case 'granary':
      r = granary(era, seed);
      break;
    case 'stone_house':
      r = stoneHouse(variant % 3, era, seed);
      break;
    case 'levee':
      r = levee(w, h, seed);
      break;
    case 'dam':
      r = dam(w, h, seed);
      break;
    case 'bridge':
      r = bridge(w, h, seed);
      break;
    case 'retaining_wall':
      r = retainingWall(w, h, seed);
      break;
    case 'forge':
      r = forge(seed);
      break;
    case 'grove':
      r = grove(seed);
      break;
    default:
      r = generic(w, h, seed);
  }
  return {
    main: r.g.build(),
    glow: r.gl.triangles > 0 ? r.gl.build() : null,
    crops: r.crops && r.crops.triangles > 0 ? r.crops.build() : null,
    height: r.height,
    w,
    h,
  };
}

/** Timber scaffolding with material piles, shown while a building is under construction. */
export function scaffoldGeometry(
  w: number,
  h: number,
  height: number,
  seed: number,
  stone: boolean,
): BufferGeometry {
  const g = new GeoBuilder(seed);
  const hw = w / 2 - 0.12;
  const hh = h / 2 - 0.12;
  const H = Math.max(0.5, height * 0.9);
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  for (const [x, z] of corners) g.beam([x, 0, z], [x, H, z], 0.025, PAL.timber);
  for (const t of [0.34, 0.68, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 4]!;
      g.beam([a[0], H * t, a[1]], [b[0], H * t, b[1]], 0.016, PAL.woodLight);
    }
  }
  g.beam([-hw, 0, hh], [hw, H * 0.68, hh], 0.012, PAL.timber);
  g.beam([hw, 0, -hh], [-hw, H * 0.68, -hh], 0.012, PAL.timber);
  // foundation outline
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    g.beam([a[0], 0.04, a[1]], [b[0], 0.04, b[1]], 0.03, PAL.stoneDark);
  }
  // delivery piles
  if (stone) {
    for (let i = 0; i < 4; i++)
      g.box(
        hw + 0.25 + (i % 2) * 0.2,
        0,
        -0.3 + Math.floor(i / 2) * 0.32,
        0.26,
        0.18,
        0.24,
        i % 2 ? PAL.stone : PAL.stoneLight,
        i * 0.4,
      );
  }
  for (let i = 0; i < 4; i++) g.box(-hw - 0.3, i * 0.05, 0.1, 0.55, 0.045, 0.16, PAL.woodLight, i * 0.07);
  return g.build();
}

/** Collapsed remains: foundation stones, broken wall stumps, fallen beams; charred after fire, mossy with age. */
export function ruinGeometry(
  kind: BuildingKind,
  w: number,
  h: number,
  seed: number,
  opts: { burnt: boolean; stone: boolean; burial: number; old: boolean; wet: boolean },
): BufferGeometry {
  const g = new GeoBuilder(seed);
  g.jitter = 0.1;
  const wall = opts.stone ? PAL.stone : opts.burnt ? PAL.char : PAL.timberDark;
  const wood = opts.burnt ? PAL.char : PAL.timber;
  const moss = PAL.moss;
  const hw = w / 2 - 0.15;
  const hh = h / 2 - 0.15;
  const sink = -0.08 * opts.burial;
  // foundation ring of stones
  const n = Math.max(8, Math.round((w + h) * 3));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const perim = 2 * (w + h);
    let d = t * perim;
    let x: number;
    let z: number;
    if (d < w) {
      x = -w / 2 + d;
      z = -h / 2;
    } else if ((d -= w) < h) {
      x = w / 2;
      z = -h / 2 + d;
    } else if ((d -= h) < w) {
      x = w / 2 - d;
      z = h / 2;
    } else {
      d -= w;
      x = -w / 2;
      z = h / 2 - d;
    }
    const s = 0.11 + h01(seed, i, 1) * 0.1;
    g.lump(
      x * 0.92,
      0.05 + sink,
      z * 0.92,
      s * 1.3,
      s,
      s * 1.1,
      opts.old && h01(seed, i, 2) < 0.4 ? moss : i % 2 ? PAL.stone : PAL.stoneDark,
      { detail: 0, seed: i, rough: 0.2 },
    );
  }
  if (opts.burial >= 3) {
    g.lump(0, -0.35, 0, w * 0.5, 0.5, h * 0.5, rgb('#6d8f45'), {
      rough: 0.1,
      seed: 4,
      topColor: rgb('#8cb552'),
    });
    return g.build();
  }
  // broken wall stumps
  const stumps = opts.stone ? 4 : 3;
  for (let i = 0; i < stumps; i++) {
    const a = (i / stumps) * Math.PI * 2 + h01(seed, i, 5);
    const x = Math.cos(a) * hw * 0.8;
    const z = Math.sin(a) * hh * 0.8;
    const sh = (0.12 + h01(seed, i, 6) * 0.32) * (opts.stone ? 1.4 : 0.9) * (1 - 0.18 * opts.burial);
    g.box(
      x,
      sink,
      z,
      0.38 + h01(seed, i, 7) * 0.3,
      Math.max(0.05, sh),
      0.12 + h01(seed, i, 8) * 0.06,
      wall,
      a,
      opts.old ? moss : undefined,
    );
  }
  // fallen beams and rafters
  const beams = opts.stone ? 2 : 6;
  for (let i = 0; i < beams; i++) {
    const x = (h01(seed, i, 11) - 0.5) * hw * 1.4;
    const z = (h01(seed, i, 12) - 0.5) * hh * 1.4;
    const a = h01(seed, i, 13) * Math.PI;
    const len = 0.45 + h01(seed, i, 14) * 0.55;
    const tilt = h01(seed, i, 15) * 0.35;
    g.beam(
      [x - Math.cos(a) * len * 0.5, 0.04 + sink, z - Math.sin(a) * len * 0.5],
      [x + Math.cos(a) * len * 0.5, 0.04 + tilt + sink, z + Math.sin(a) * len * 0.5],
      0.03 + h01(seed, i, 16) * 0.015,
      wood,
    );
  }
  // debris mound
  g.lump(
    0,
    0.02 + sink,
    0,
    hw * 0.7,
    0.14 * (1 - 0.2 * opts.burial),
    hh * 0.7,
    opts.burnt ? PAL.ash : opts.stone ? PAL.stoneDark : shade(PAL.earth, 0.8),
    { rough: 0.3, seed: 9, detail: 1 },
  );
  if (opts.old) {
    for (let i = 0; i < 4; i++)
      g.lump(
        (h01(seed, i, 21) - 0.5) * w * 0.8,
        0.12 + sink,
        (h01(seed, i, 22) - 0.5) * h * 0.8,
        0.22,
        0.12,
        0.2,
        moss,
        { detail: 0, seed: i, rough: 0.3 },
      );
  }
  if (kind === 'archive') g.box(0, 0.05 + sink, 0.2, 0.3, 0.05, 0.2, PAL.clay, 0.3);
  return g.build();
}
