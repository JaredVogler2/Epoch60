import { BufferAttribute, BufferGeometry, Color } from 'three';

/** Deterministic hash → [0,1). Render-only; never used by the engine. */
export function h01(a: number, b = 0, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export type RGB = [number, number, number];
const tmp = new Color();

/** sRGB hex → linear RGB triple (vertex colors are interpreted as linear). */
export function rgb(hex: number | string): RGB {
  tmp.set(hex as never);
  return [tmp.r, tmp.g, tmp.b];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

type V3 = [number, number, number];

/**
 * Accumulates flat-shaded triangles with per-face vertex colour. Every primitive can be rotated about Y and
 * translated; per-triangle brightness jitter gives the faceted, hand-painted look of a miniature.
 */
export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  /** Seed for brightness jitter. */
  seed: number;
  /** Amount of per-facet brightness jitter (0..0.2). */
  jitter = 0.07;
  private tri = 0;

  constructor(seed = 1) {
    this.seed = seed;
  }

  get triangles(): number {
    return this.tri;
  }

  private emitTri(a: V3, b: V3, c: V3, color: RGB, jitter = this.jitter): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const k = 1 + (h01(this.seed, this.tri++, 17) - 0.5) * 2 * jitter;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0] * k, color[1] * k, color[2] * k);
    }
  }

  /** Quad with vertices in counter-clockwise order when viewed from the front. */
  quad(a: V3, b: V3, c: V3, d: V3, color: RGB, jitter?: number): void {
    this.emitTri(a, b, c, color, jitter);
    this.emitTri(a, c, d, color, jitter);
  }

  triangle(a: V3, b: V3, c: V3, color: RGB, jitter?: number): void {
    this.emitTri(a, b, c, color, jitter);
  }

  private xf(p: V3, cx: number, cy: number, cz: number, rotY: number): V3 {
    if (rotY === 0) return [p[0] + cx, p[1] + cy, p[2] + cz];
    const s = Math.sin(rotY);
    const co = Math.cos(rotY);
    return [p[0] * co + p[2] * s + cx, p[1] + cy, -p[0] * s + p[2] * co + cz];
  }

  /** Axis-aligned box centred at (cx, cy+sy/2, cz) — i.e. cy is the bottom. */
  box(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    color: RGB,
    rotY = 0,
    topColor?: RGB,
  ): void {
    const x = sx / 2;
    const z = sz / 2;
    const p = (px: number, py: number, pz: number): V3 => this.xf([px, py, pz], cx, cy, cz, rotY);
    const top = topColor ?? color;
    // +y
    this.quad(p(-x, sy, -z), p(-x, sy, z), p(x, sy, z), p(x, sy, -z), top);
    // -y
    this.quad(p(-x, 0, -z), p(x, 0, -z), p(x, 0, z), p(-x, 0, z), shade(color, 0.6));
    // +z
    this.quad(p(-x, 0, z), p(x, 0, z), p(x, sy, z), p(-x, sy, z), color);
    // -z
    this.quad(p(x, 0, -z), p(-x, 0, -z), p(-x, sy, -z), p(x, sy, -z), color);
    // +x
    this.quad(p(x, 0, z), p(x, 0, -z), p(x, sy, -z), p(x, sy, z), color);
    // -x
    this.quad(p(-x, 0, -z), p(-x, 0, z), p(-x, sy, z), p(-x, sy, -z), color);
  }

  /** Tapered box: bottom size (sx0,sz0), top size (sx1,sz1). */
  frustum(
    cx: number,
    cy: number,
    cz: number,
    sx0: number,
    sz0: number,
    sx1: number,
    sz1: number,
    h: number,
    color: RGB,
    rotY = 0,
  ): void {
    const a = sx0 / 2;
    const b = sz0 / 2;
    const c = sx1 / 2;
    const d = sz1 / 2;
    const p = (px: number, py: number, pz: number): V3 => this.xf([px, py, pz], cx, cy, cz, rotY);
    this.quad(p(-c, h, -d), p(-c, h, d), p(c, h, d), p(c, h, -d), color);
    this.quad(p(-a, 0, b), p(a, 0, b), p(c, h, d), p(-c, h, d), color);
    this.quad(p(a, 0, -b), p(-a, 0, -b), p(-c, h, -d), p(c, h, -d), color);
    this.quad(p(a, 0, b), p(a, 0, -b), p(c, h, -d), p(c, h, d), color);
    this.quad(p(-a, 0, -b), p(-a, 0, b), p(-c, h, d), p(-c, h, -d), color);
  }

  /**
   * Gable roof. Ridge runs along X (ridgeAxis 'x') or Z. `w`,`d` are the eaves footprint.
   * `bump` adds irregular thatch-like lumpiness by subdividing the slopes.
   */
  gable(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    color: RGB,
    opts: {
      ridgeAxis?: 'x' | 'z';
      rotY?: number;
      bump?: number;
      rows?: number;
      ridgeColor?: RGB;
      gableColor?: RGB;
    } = {},
  ): void {
    const rotY = opts.rotY ?? 0;
    const axisX = (opts.ridgeAxis ?? 'x') === 'x';
    const bump = opts.bump ?? 0;
    const rows = opts.rows ?? 1;
    const hl = (axisX ? w : d) / 2; // half length along ridge
    const hs = (axisX ? d : w) / 2; // half span across
    const P = (l: number, s: number, y: number): V3 => {
      const px = axisX ? l : s;
      const pz = axisX ? s : l;
      return this.xf([px, y, pz], cx, cy, cz, rotY);
    };
    const nL = Math.max(1, Math.round(hl * 2 * 3));
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        const s0 = (r / rows) * hs * side;
        const s1 = ((r + 1) / rows) * hs * side;
        const y0 = h * (1 - r / rows);
        const y1 = h * (1 - (r + 1) / rows);
        // step each row slightly outward so shingle/tile rows read as overlapping courses
        const lip = rows > 1 ? 0.025 : 0;
        for (let i = 0; i < nL; i++) {
          const l0 = -hl + (i / nL) * hl * 2;
          const l1 = -hl + ((i + 1) / nL) * hl * 2;
          const jb = (l: number, s: number) =>
            bump ? (h01(this.seed, Math.round(l * 50), Math.round(s * 50)) - 0.5) * bump : 0;
          const a = P(l0, side * (Math.abs(s0) + lip), y0 + jb(l0, s0));
          const b = P(l1, side * (Math.abs(s0) + lip), y0 + jb(l1, s0));
          const c2 = P(l1, side * Math.abs(s1), y1 + jb(l1, s1));
          const d2 = P(l0, side * Math.abs(s1), y1 + jb(l0, s1));
          if (side === -1) this.quad(b, a, d2, c2, color);
          else this.quad(a, b, c2, d2, color);
        }
      }
    }
    // Ridge cap
    if (opts.ridgeColor) {
      const rc = opts.ridgeColor;
      this.quad(
        P(-hl - 0.02, -0.05, h + 0.03),
        P(hl + 0.02, -0.05, h + 0.03),
        P(hl + 0.02, 0.05, h + 0.03),
        P(-hl - 0.02, 0.05, h + 0.03),
        rc,
      );
    }
    // Gable ends
    const gc = opts.gableColor ?? shade(color, 0.7);
    for (const e of [-1, 1]) {
      const l = e * hl;
      const a = P(l, -hs, 0);
      const b = P(l, hs, 0);
      const c3 = P(l, 0, h);
      if (e === 1) this.triangle(b, a, c3, gc);
      else this.triangle(a, b, c3, gc);
    }
  }

  /** Four-sided pyramid / hip cap. */
  pyramid(cx: number, cy: number, cz: number, sx: number, sz: number, h: number, color: RGB, rotY = 0): void {
    const x = sx / 2;
    const z = sz / 2;
    const p = (px: number, py: number, pz: number): V3 => this.xf([px, py, pz], cx, cy, cz, rotY);
    const t = p(0, h, 0);
    this.triangle(p(-x, 0, z), p(x, 0, z), t, color);
    this.triangle(p(x, 0, -z), p(-x, 0, -z), t, color);
    this.triangle(p(x, 0, z), p(x, 0, -z), t, color);
    this.triangle(p(-x, 0, -z), p(-x, 0, z), t, color);
  }

  /** Cone/cylinder frustum with `seg` sides; cy is the bottom. */
  cyl(
    cx: number,
    cy: number,
    cz: number,
    rBot: number,
    rTop: number,
    h: number,
    seg: number,
    color: RGB,
    opts: { capTop?: boolean; capColor?: RGB; wobble?: number } = {},
  ): void {
    const wob = opts.wobble ?? 0;
    const ring = (r: number, y: number): V3[] => {
      const out: V3[] = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const k = 1 + (wob ? (h01(this.seed, i, Math.round(y * 99)) - 0.5) * wob : 0);
        out.push([cx + Math.cos(a) * r * k, cy + y, cz + Math.sin(a) * r * k]);
      }
      return out;
    };
    const b = ring(rBot, 0);
    const t = ring(rTop, h);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.quad(b[i]!, b[j]!, t[j]!, t[i]!, color);
    }
    if (opts.capTop !== false && rTop > 0) {
      const c: V3 = [cx, cy + h, cz];
      const cc = opts.capColor ?? color;
      for (let i = 0; i < seg; i++) this.triangle(t[(i + 1) % seg]!, t[i]!, c, cc);
    }
    if (rBot > 0) {
      const c: V3 = [cx, cy, cz];
      for (let i = 0; i < seg; i++) this.triangle(b[i]!, b[(i + 1) % seg]!, c, shade(color, 0.55));
    }
  }

  /** Lumpy low-poly sphere (icosahedron-ish) for foliage and boulders. */
  lump(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    color: RGB,
    opts: { rough?: number; detail?: number; seed?: number; topColor?: RGB } = {},
  ): void {
    const rough = opts.rough ?? 0.18;
    const detail = opts.detail ?? 1;
    const sd = (opts.seed ?? 0) + this.seed;
    // Base icosahedron
    const t = (1 + Math.sqrt(5)) / 2;
    let verts: V3[] = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map((v) => {
      const l = Math.hypot(v[0]!, v[1]!, v[2]!);
      return [v[0]! / l, v[1]! / l, v[2]! / l] as V3;
    });
    let faces: [number, number, number][] = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
    for (let d = 0; d < detail; d++) {
      const cache = new Map<string, number>();
      const mid = (a: number, b: number): number => {
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        const hit = cache.get(key);
        if (hit !== undefined) return hit;
        const va = verts[a]!;
        const vb = verts[b]!;
        const m: V3 = [(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2];
        const l = Math.hypot(m[0], m[1], m[2]);
        verts.push([m[0] / l, m[1] / l, m[2] / l]);
        cache.set(key, verts.length - 1);
        return verts.length - 1;
      };
      const nf: [number, number, number][] = [];
      for (const [a, b, c] of faces) {
        const ab = mid(a, b);
        const bc = mid(b, c);
        const ca = mid(c, a);
        nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = nf;
    }
    verts = verts.map((v, i) => {
      const k = 1 + (h01(sd, i, 5) - 0.5) * 2 * rough;
      return [v[0] * rx * k + cx, v[1] * ry * k + cy, v[2] * rz * k + cz] as V3;
    });
    for (const [a, b, c] of faces) {
      const va = verts[a]!;
      const vb = verts[b]!;
      const vc = verts[c]!;
      const up = (va[1] + vb[1] + vc[1]) / 3 - cy;
      const col = opts.topColor ? mix(color, opts.topColor, Math.max(0, Math.min(1, up / ry))) : color;
      this.triangle(va, vb, vc, col);
    }
  }

  /** Thin flat disc facing up. */
  disc(cx: number, cy: number, cz: number, r: number, seg: number, color: RGB, wobble = 0): void {
    const c: V3 = [cx, cy, cz];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const k0 = 1 + (wobble ? (h01(this.seed, i, 3) - 0.5) * wobble : 0);
      const k1 = 1 + (wobble ? (h01(this.seed, (i + 1) % seg, 3) - 0.5) * wobble : 0);
      this.triangle(
        [cx + Math.cos(a1) * r * k1, cy, cz + Math.sin(a1) * r * k1],
        [cx + Math.cos(a0) * r * k0, cy, cz + Math.sin(a0) * r * k0],
        c,
        color,
      );
    }
  }

  /** Beam between two points with a square cross-section. */
  beam(a: V3, b: V3, thick: number, color: RGB): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    // pick a perpendicular
    const steep = Math.abs(dy / len) > 0.95;
    const ux = steep ? 1 : 0;
    const uy = steep ? 0 : 1;
    const uz = 0;
    // cross products
    let px = dy * uz - dz * uy;
    let py = dz * ux - dx * uz;
    let pz = dx * uy - dy * ux;
    const pl = Math.hypot(px, py, pz) || 1;
    px = (px / pl) * thick;
    py = (py / pl) * thick;
    pz = (pz / pl) * thick;
    let qx = (dy * pz - dz * py) / len;
    let qy = (dz * px - dx * pz) / len;
    let qz = (dx * py - dy * px) / len;
    const ql = Math.hypot(qx, qy, qz) || 1;
    qx = (qx / ql) * thick;
    qy = (qy / ql) * thick;
    qz = (qz / ql) * thick;
    const c = (s1: number, s2: number, end: V3): V3 => [
      end[0] + px * s1 + qx * s2,
      end[1] + py * s1 + qy * s2,
      end[2] + pz * s1 + qz * s2,
    ];
    const A = [c(-1, -1, a), c(1, -1, a), c(1, 1, a), c(-1, 1, a)];
    const B = [c(-1, -1, b), c(1, -1, b), c(1, 1, b), c(-1, 1, b)];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(A[i]!, A[j]!, B[j]!, B[i]!, color);
    }
    this.quad(B[0]!, B[1]!, B[2]!, B[3]!, color);
    this.quad(A[3]!, A[2]!, A[1]!, A[0]!, color);
  }

  /** Append another builder's triangles (already in the same space). */
  merge(o: GeoBuilder): void {
    this.pos.push(...o.pos);
    this.nor.push(...o.nor);
    this.col.push(...o.col);
    this.tri += o.tri;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Shared palette so every model reads as one handcrafted world. */
export const PAL = {
  thatch: rgb('#d2a94a'),
  thatchDark: rgb('#9c7a31'),
  straw: rgb('#e0c26a'),
  plaster: rgb('#e6d3ad'),
  plasterWarm: rgb('#dcbf8f'),
  timber: rgb('#6b4a2e'),
  timberDark: rgb('#4a3220'),
  woodLight: rgb('#a77b4d'),
  stone: rgb('#a39a8a'),
  stoneLight: rgb('#c4baa6'),
  stoneDark: rgb('#7c7568'),
  sandstone: rgb('#d8bf94'),
  slate: rgb('#4b6a73'),
  teal: rgb('#3f8f8a'),
  terracotta: rgb('#c4673e'),
  clay: rgb('#b9714a'),
  earth: rgb('#7a5a3a'),
  earthDark: rgb('#5a4129'),
  soil: rgb('#6a4a2f'),
  furrow: rgb('#4f3622'),
  leaf: rgb('#4f8f3a'),
  leafDark: rgb('#2f6a33'),
  leafLight: rgb('#86b84a'),
  crop: rgb('#8cc04a'),
  cropGold: rgb('#d9b84a'),
  bark: rgb('#5d4331'),
  char: rgb('#2a2522'),
  ash: rgb('#5b5550'),
  gold: rgb('#e6b84a'),
  fire: rgb('#ff9a2e'),
  red: rgb('#b8453a'),
  white: rgb('#f4efe2'),
  moss: rgb('#5f7f3a'),
};
