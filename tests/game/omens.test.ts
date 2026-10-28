import { describe, expect, it } from 'vitest';
import { omenStrength } from '../../src/render/Omens';

describe('the omens of a coming catastrophe', () => {
  it('appear from 30 s left, are whole by 3 s left, and leave the collapse to its cinematic', () => {
    expect(omenStrength('PREPARE', 0)).toBe(0);
    expect(omenStrength('ACTIVE', 0)).toBe(0);
    expect(omenStrength('ACTIVE', 300)).toBe(0);
    expect(omenStrength('ACTIVE', 435)).toBeCloseTo(0.5, 5);
    expect(omenStrength('ACTIVE', 570)).toBe(1);
    expect(omenStrength('ACTIVE', 599)).toBe(1);
    expect(omenStrength('COLLAPSING', 600)).toBe(0);
    expect(omenStrength('DEBRIEF', 600)).toBe(0);
  });
});
