import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCampaign, deserialize, serialize } from '../../src/engine';
import { SaveError } from '../../src/engine/save/save';
import { loadRuns, parseShare } from '../../src/game/modes';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/game/persist';
import { memoryStorage } from './memory-storage';

/**
 * Stored data and links are untrusted: a card, save or setting from another version, a forger or a broken disk
 * must be dropped or defaulted — never crash the title screen or produce an unwinnable/free campaign.
 */

afterEach(() => vi.unstubAllGlobals());

const card = (over: Record<string, unknown>) => ({
  id: 'x',
  seed: 6001,
  scenario: 'greenvale',
  difficulty: 'normal',
  outcome: 'victory',
  title: 'The cycle is broken',
  survivors: 9,
  heritage: 1,
  techs: 2,
  epochs: 3,
  hash: 'h',
  at: '2026-10-28T00:00:00.000Z',
  ...over,
});

describe('run cards', () => {
  it('drops cards naming a scenario or difficulty this build does not know (they used to blank the title)', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(
      'epoch60.runs.v1',
      JSON.stringify([
        card({ id: 'ok' }),
        card({ id: 'future', scenario: 'future-scenario' }),
        card({ id: 'proto', scenario: '__proto__' }),
        card({ id: 'ctor', difficulty: 'constructor' }),
        card({ id: 'nan', survivors: null }),
        card({ id: 'inf', seed: 'Infinity' }),
      ]),
    );
    expect(loadRuns().map((r) => r.id)).toEqual(['ok']);
  });

  it('drops cards whose shown fields are malformed (a chronicle card with a number for a title broke the title)', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem(
      'epoch60.runs.v1',
      JSON.stringify([
        card({ id: 'ok' }),
        card({ id: 'title', title: 5, endless: true }),
        card({ id: 'when', at: 'yesterday' }),
        card({ id: 'ages', epochs: '3' }),
        card({ id: 'kept', heritage: null }),
        card({ id: 'known', techs: undefined }),
        card({ id: 'hash', hash: 7 }),
        card({ id: 'daily', daily: '28/10/2026' }),
      ]),
    );
    expect(loadRuns().map((r) => r.id)).toEqual(['ok']);
  });
});

describe('share links', () => {
  it('ignores inherited object keys as difficulty or scenario', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(parseShare(`?difficulty=${key}`).difficulty).toBeUndefined();
      expect(parseShare(`?scenario=${key}`).scenario).toBeUndefined();
    }
  });
});

describe('settings', () => {
  it('defaults every missing, mistyped or out-of-range field', () => {
    const s = sanitizeSettings({
      musicVolume: Infinity,
      sfxVolume: -3,
      quality: 'ultra',
      sound: 'yes',
      reducedMotion: 1,
      extra: { evil: true },
    });
    expect(s.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(s.sfxVolume).toBe(0);
    expect(s.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(s.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(s.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion);
    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ musicVolume: 0.25 }).musicVolume).toBe(0.25);
  });
});

describe('saves', () => {
  /** A forged save that passes the integrity hash (the hash is recomputed by serialize). */
  const forged = (edit: (c: ReturnType<typeof createCampaign>) => void) => {
    const c = createCampaign(6001);
    edit(c);
    return serialize(c);
  };

  it('accept an honest campaign', () => {
    expect(deserialize(forged(() => undefined)).seed).toBe(6001);
  });

  it('reject hash-valid campaigns this build cannot run', () => {
    const cases: [string, (c: ReturnType<typeof createCampaign>) => void][] = [
      ['unknown scenario', (c) => (c.scenario = 'zzz')],
      ['epoch past the last age', (c) => (c.epoch = 7)],
      ['negative epoch', (c) => (c.epoch = -1)],
      ['inherited-key difficulty', (c) => ((c as { difficulty: string }).difficulty = 'constructor')],
      ['unknown mode', (c) => ((c as { mode: string }).mode = 'god')],
      ['unknown phase', (c) => ((c as { phase: string }).phase = 'WIN_NOW')],
      ['tick out of range', (c) => (c.tick = 1e9)],
    ];
    for (const [why, edit] of cases) expect(() => deserialize(forged(edit)), why).toThrow(SaveError);
  });
});
