import { describe, expect, it } from 'vitest';
import { hashValue, stableStringify } from '../../src/engine/core/hash';
import { createRngState, nextFloat, nextInt, nextU32 } from '../../src/engine/core/prng';

describe('prng', () => {
  it('is reproducible for a seed and differs across seeds and streams', () => {
    const a = createRngState(1234);
    const b = createRngState(1234);
    const seqA = Array.from({ length: 20 }, () => nextU32(a));
    const seqB = Array.from({ length: 20 }, () => nextU32(b));
    expect(seqA).toEqual(seqB);
    const c = createRngState(1235);
    expect(Array.from({ length: 20 }, () => nextU32(c))).not.toEqual(seqA);
    const d = createRngState(1234, 7);
    expect(Array.from({ length: 20 }, () => nextU32(d))).not.toEqual(seqA);
  });
  it('produces floats in [0,1) and ints in range', () => {
    const s = createRngState(9);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(s);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = nextInt(s, 7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
  it('matches a frozen reference sequence (cross-platform determinism guard)', () => {
    const s = createRngState(0);
    expect(Array.from({ length: 4 }, () => nextU32(s))).toMatchSnapshot();
  });
});

describe('hash', () => {
  it('is key-order independent and sensitive to values', () => {
    expect(hashValue({ a: 1, b: [1, 2] })).toBe(hashValue({ b: [1, 2], a: 1 }));
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
    expect(stableStringify({ b: undefined, a: 1 })).toBe('{"a":1}');
  });
  it('rejects non-finite numbers so NaN can never hide in state', () => {
    expect(() => stableStringify({ a: NaN })).toThrow();
  });
});
