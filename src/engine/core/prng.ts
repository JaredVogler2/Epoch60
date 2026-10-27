/**
 * Seeded PRNG (sfc32). State is four uint32 so it serializes into saves and replays exactly.
 * Only +, -, *, bit ops and Math.imul are used so results are identical in every JS engine.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let v = p | 0;
    for (let i = 0; i < 4; i++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

export function createRngState(seed: number, stream = 0): RngState {
  const s = {
    a: hash32(seed, stream, 1),
    b: hash32(seed, stream, 2),
    c: hash32(seed, stream, 3),
    d: hash32(seed, stream, 4),
  };
  // warm up
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}

export function nextU32(s: RngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return t >>> 0;
}

/** Uniform float in [0,1). Division by a power of two is exact, so this is platform independent. */
export function nextFloat(s: RngState): number {
  return nextU32(s) / 4294967296;
}

/** Integer in [0, n). */
export function nextInt(s: RngState, n: number): number {
  return Math.floor(nextFloat(s) * n);
}

export function nextRange(s: RngState, lo: number, hi: number): number {
  return lo + nextInt(s, hi - lo + 1);
}

export function cloneRng(s: RngState): RngState {
  return { a: s.a, b: s.b, c: s.c, d: s.d };
}
