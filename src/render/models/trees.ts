import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Vector2,
  Vector3,
} from 'three';
import { h01, rgb } from '../geo';
import type { RGB } from '../geo';

/**
 * Painterly trees. Crowns are smooth-shaded with "crown normals" (pointing out of each lobe, nudged up) so they read
 * as soft rounded masses like a hand-painted miniature, not as faceted low-poly. Crowns are painted in grey values
 * (darker beneath, sunlit on top) and receive their hue per instance (`aFoliage` = 1 lets the instance colour through;
 * trunks carry `aFoliage` = 0 and keep their own bark colour). Height is in local units; the base sits at y = 0.
 */

class TreeBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  fol: number[] = [];

  /** Append a non-indexed geometry's triangles with per-vertex normal/colour from callbacks. */
  add(
    g: BufferGeometry,
    xf: (p: Vector3) => void,
    normal: (p: Vector3, geomNormal: Vector3) => Vector3,
    color: (p: Vector3, n: Vector3) => RGB,
    foliage: number,
  ): void {
    const src = g.index ? g.toNonIndexed() : g;
    const P = src.getAttribute('position');
    const N = src.getAttribute('normal');
    const p = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < P.count; i++) {
      p.set(P.getX(i), P.getY(i), P.getZ(i));
      n.set(N.getX(i), N.getY(i), N.getZ(i));
      xf(p);
      const nn = normal(p, n);
      const c = color(p, nn);
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(nn.x, nn.y, nn.z);
      this.col.push(c[0], c[1], c[2]);
      this.fol.push(foliage);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('aFoliage', new BufferAttribute(new Float32Array(this.fol), 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Smooth, deterministic 3-D wobble for lumpy crowns (sum of sines; continuous so shared vertices agree). */
function wobble(p: Vector3, seed: number): number {
  const a = h01(seed, 1, 1) * 6.28;
  const b = h01(seed, 2, 2) * 6.28;
  return (
    Math.sin(p.x * 3.1 + a) * Math.sin(p.z * 2.7 + b) * 0.55 +
    Math.sin(p.y * 4.3 + b) * Math.cos(p.x * 2.2 - a) * 0.3 +
    Math.sin((p.x + p.z) * 5.3 + a * 2) * 0.15
  );
}

const BARK = rgb('#5b4331');
const BARK_DARK = rgb('#3f2f22');
const BIRCH_BARK = rgb('#e8e2d2');

function grey(v: number): RGB {
  return [v, v, v];
}

/** Crown paint: shadowed underside, lit top, a soft value drift; returns a grey value to be tinted per instance. */
function crownValue(y: number, n: Vector3, y0: number, y1: number, drift: number): RGB {
  const t = Math.min(1, Math.max(0, (y - y0) / Math.max(0.001, y1 - y0)));
  const up = (n.y + 1) * 0.5;
  // deep occlusion at the base of the crown, rising to a sunlit cap
  const ao = 0.42 + 0.58 * Math.pow(t, 0.8);
  const v = ao * (0.72 + 0.36 * up) * (0.92 + 0.16 * drift);
  return grey(Math.min(1.2, v));
}

function trunk(b: TreeBuilder, h: number, r0: number, r1: number, color: RGB, seg = 6): void {
  const g = new CylinderGeometry(r1, r0, h, seg, 2, true);
  b.add(
    g,
    (p) => p.set(p.x, p.y + h / 2, p.z),
    (_p, n) => n.normalize(),
    (p) => {
      const k = 0.75 + 0.35 * (p.y / h);
      return [color[0] * k, color[1] * k, color[2] * k];
    },
    0,
  );
}

interface Lobe {
  c: [number, number, number];
  r: [number, number, number];
}

/** A crown made of lumpy, smooth-shaded lobes sharing one value gradient. */
function crown(b: TreeBuilder, lobes: Lobe[], seed: number, detail = 1, lump = 0.12): void {
  const ys = lobes.flatMap((l) => [l.c[1] - l.r[1], l.c[1] + l.r[1]]);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const centre = new Vector3(
    lobes.reduce((s, l) => s + l.c[0], 0) / lobes.length,
    (y0 + y1) / 2,
    lobes.reduce((s, l) => s + l.c[2], 0) / lobes.length,
  );
  lobes.forEach((l, i) => {
    const lc = new Vector3(...l.c);
    const g = new IcosahedronGeometry(1, detail);
    b.add(
      g,
      (p) => {
        const w = 1 + lump * wobble(p, seed * 7 + i);
        p.set(p.x * l.r[0] * w + l.c[0], p.y * l.r[1] * w + l.c[1], p.z * l.r[2] * w + l.c[2]);
      },
      (p) => {
        const nl = p.clone().sub(lc).normalize();
        const nc = p.clone().sub(centre).normalize();
        return nl
          .multiplyScalar(0.62)
          .add(nc.multiplyScalar(0.38))
          .add(new Vector3(0, 0.18, 0))
          .normalize();
      },
      (p, n) => crownValue(p.y, n, y0, y1, wobble(p, seed + 99) * 0.5 + 0.5),
      1,
    );
  });
}

/** Round broadleaf (oak/beech): short trunk, three to four soft lobes. ~2.1 tall. */
export function broadleafGeometry(): BufferGeometry {
  const b = new TreeBuilder();
  trunk(b, 0.9, 0.11, 0.07, BARK);
  crown(
    b,
    [
      { c: [0, 1.38, 0], r: [0.62, 0.55, 0.62] },
      { c: [0.38, 1.12, 0.12], r: [0.42, 0.38, 0.42] },
      { c: [-0.34, 1.16, -0.16], r: [0.44, 0.4, 0.44] },
      { c: [0.04, 1.8, 0.05], r: [0.38, 0.34, 0.38] },
    ],
    11,
  );
  return b.build();
}

/** Tall Italian cypress / poplar: a narrow flame-shaped crown. ~2.6 tall. */
export function cypressGeometry(): BufferGeometry {
  const b = new TreeBuilder();
  trunk(b, 0.45, 0.07, 0.05, BARK_DARK);
  const pts: Vector2[] = [];
  const H = 2.2;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // poplar silhouette: full in the lower third, rounded (not pointed) at the crown
    const e = (t - 0.42) / 0.58;
    const r =
      0.42 *
      Math.sqrt(Math.max(0, 1 - e * e)) *
      (t < 0.42 ? 0.86 + 0.14 * Math.sin((t / 0.42) * Math.PI * 0.5) : 1);
    pts.push(new Vector2(Math.max(0.001, r), 0.3 + t * H));
  }
  const g = new LatheGeometry(pts, 10);
  const y0 = 0.3;
  const y1 = 0.3 + H;
  b.add(
    g,
    (p) => {
      const w = 1 + 0.1 * wobble(p, 23);
      p.set(p.x * w, p.y, p.z * w);
    },
    (p, n) => {
      const out = new Vector3(p.x, 0, p.z).normalize();
      return n
        .normalize()
        .multiplyScalar(0.4)
        .add(out.multiplyScalar(0.6))
        .add(new Vector3(0, 0.25, 0))
        .normalize();
    },
    (p, n) => crownValue(p.y, n, y0, y1, wobble(p, 31) * 0.5 + 0.5),
    1,
  );
  return b.build();
}

/** Conifer: three soft stacked tiers. ~2.3 tall. */
export function coniferGeometry(): BufferGeometry {
  const b = new TreeBuilder();
  trunk(b, 0.55, 0.08, 0.05, BARK_DARK);
  const tiers = [
    { y: 0.35, r: 0.62, h: 0.95 },
    { y: 0.85, r: 0.48, h: 0.85 },
    { y: 1.3, r: 0.32, h: 0.95 },
  ];
  const y0 = 0.35;
  const y1 = 2.25;
  tiers.forEach((t, i) => {
    const pts = [
      new Vector2(0.001, t.y - 0.02),
      new Vector2(t.r * 0.92, t.y + 0.02),
      new Vector2(t.r, t.y + 0.1),
      new Vector2(t.r * 0.5, t.y + t.h * 0.55),
      new Vector2(0.001, t.y + t.h),
    ];
    const g = new LatheGeometry(pts, 9);
    b.add(
      g,
      (p) => {
        const w = 1 + 0.08 * wobble(p, 40 + i);
        p.set(p.x * w, p.y, p.z * w);
      },
      (p, n) => {
        const out = new Vector3(p.x, 0, p.z).normalize();
        return n
          .normalize()
          .multiplyScalar(0.5)
          .add(out.multiplyScalar(0.5))
          .add(new Vector3(0, 0.35, 0))
          .normalize();
      },
      (p, n) => crownValue(p.y, n, y0, y1, wobble(p, 50 + i) * 0.5 + 0.5),
      1,
    );
  });
  return b.build();
}

/** Birch: slim pale trunk with dark marks and a light, airy crown. ~2.0 tall. */
export function birchTreeGeometry(): BufferGeometry {
  const b = new TreeBuilder();
  const g = new CylinderGeometry(0.035, 0.055, 1.3, 6, 6, true);
  b.add(
    g,
    (p) => p.set(p.x, p.y + 0.65, p.z),
    (_p, n) => n.normalize(),
    (p) => (Math.sin(p.y * 23 + 1.3) > 0.82 ? rgb('#3b3a35') : BIRCH_BARK),
    0,
  );
  crown(
    b,
    [
      { c: [0, 1.5, 0], r: [0.38, 0.46, 0.38] },
      { c: [0.2, 1.22, 0.1], r: [0.28, 0.3, 0.28] },
      { c: [-0.18, 1.28, -0.12], r: [0.27, 0.3, 0.27] },
    ],
    61,
    1,
    0.14,
  );
  return b.build();
}

/** Understorey shrub: two low soft mounds. */
export function shrubGeometry(): BufferGeometry {
  const b = new TreeBuilder();
  crown(
    b,
    [
      { c: [0, 0.2, 0], r: [0.34, 0.26, 0.34] },
      { c: [0.24, 0.15, 0.1], r: [0.22, 0.18, 0.22] },
    ],
    71,
    1,
    0.15,
  );
  return b.build();
}

/** Chunky boulder: a few flat facets (stone breaks, it does not melt), warm grey with moss on the upper faces. */
export function stoneGeometry(): BufferGeometry {
  const rock = rgb('#9a8f7e');
  const moss = rgb('#7d8a52');
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const parts: Lobe[] = [
    { c: [0, 0.18, 0], r: [0.46, 0.3, 0.4] },
    { c: [0.38, 0.1, 0.16], r: [0.24, 0.16, 0.22] },
  ];
  const a = new Vector3();
  const b2 = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  parts.forEach((l, i) => {
    const g = new IcosahedronGeometry(1, 0);
    const P = g.getAttribute('position');
    const pts: Vector3[] = [];
    for (let k = 0; k < P.count; k++) {
      const p = new Vector3(P.getX(k), P.getY(k), P.getZ(k));
      const w = 1 + 0.22 * wobble(p, 80 + i);
      pts.push(
        new Vector3(
          p.x * l.r[0] * w + l.c[0],
          Math.max(-0.04, p.y * l.r[1] * w + l.c[1]),
          p.z * l.r[2] * w + l.c[2],
        ),
      );
    }
    for (let k = 0; k < pts.length; k += 3) {
      a.copy(pts[k]!);
      b2.copy(pts[k + 1]!);
      c.copy(pts[k + 2]!);
      n.copy(b2).sub(a).cross(c.clone().sub(a)).normalize();
      const top = Math.max(0, n.y - 0.5) / 0.5;
      const v = (0.82 + 0.22 * ((n.y + 1) / 2)) * (0.94 + 0.12 * h01(i, k, 9));
      const cc = [0, 1, 2].map((j) => (rock[j]! + (moss[j]! - rock[j]!) * top * 0.75) * v);
      for (const q of [a, b2, c]) {
        pos.push(q.x, q.y, q.z);
        nor.push(n.x, n.y, n.z);
        col.push(cc[0]!, cc[1]!, cc[2]!);
      }
    }
    g.dispose();
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

/** Per-instance crown hues (sRGB hex). Autumn accents are drawn separately so their share is controlled. */
export const CROWN_HUES = {
  broadleaf: ['#587d37', '#628a3b', '#4f7233', '#6c9141'],
  cypress: ['#4f7039', '#577a40', '#4a6838'],
  conifer: ['#3d5f34', '#456839', '#36552f'],
  birch: ['#93ad55', '#9fb65c', '#a8bb60'],
  shrub: ['#567f37', '#62893d', '#4c7332'],
  autumn: ['#d9862b', '#e3a83a', '#c4612d', '#b8913a'],
};
