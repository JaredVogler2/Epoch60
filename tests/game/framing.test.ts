import { describe, expect, it } from 'vitest';
import { focusRow } from '../../src/render/CameraRig';

describe('where the camera looks on a phone held upright', () => {
  it('keeps the focus centred on wide screens', () => {
    expect(focusRow('game', 1366, 768, { hudBottom: 140, dockTop: 620 })).toBe(0.5);
    expect(focusRow('title', 844, 390, { cardTop: 20 })).toBe(0.5);
  });

  it('lifts the valley above the title sheet', () => {
    expect(focusRow('title', 390, 844, { cardTop: 300 })).toBeCloseTo(150 / 844, 6);
    // Never pressed against the top edge, nor below the middle.
    expect(focusRow('title', 390, 844, { cardTop: 100 })).toBe(0.16);
    expect(focusRow('title', 390, 844, {})).toBe(0.5);
  });

  it('centres the focus between the top bar and the dock in game', () => {
    expect(focusRow('game', 390, 844, { hudBottom: 170, dockTop: 583 })).toBeCloseTo(376.5 / 844, 6);
    expect(focusRow('game', 320, 568, { hudBottom: 160, dockTop: 300 })).toBeCloseTo(230 / 568, 6);
    // Too little left uncovered to frame anything: stay centred.
    expect(focusRow('game', 320, 568, { hudBottom: 260, dockTop: 300 })).toBe(0.5);
    expect(focusRow('game', 390, 844, { hudBottom: 170 })).toBe(0.6);
  });
});
