import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCampaign, replayCampaign } from '../../src/engine';
import type { Transcript } from '../../src/engine';
import { loadCodex, recordFeats, sanitizeCodex } from '../../src/game/codex';
import { memoryStorage } from './memory-storage';

/** The Codex copies feats the engine recorded; stored data is untrusted and nothing unplayed may ever show. */

afterEach(() => vi.unstubAllGlobals());

const won = () =>
  replayCampaign(JSON.parse(readFileSync('fixtures/greenvale/engineers.json', 'utf8')) as Transcript);
const entry = (over: Record<string, unknown>) => ({
  id: 'archive_built',
  at: '2026-10-27T12:00:00.000Z',
  seed: 6001,
  scenario: 'greenvale',
  difficulty: 'normal',
  ...over,
});

describe('codex', () => {
  it('starts empty on a new device', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadCodex()).toEqual([]);
  });

  it('copies exactly the feats a lineage earned, once, and keeps them across loads', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = won();
    const first = recordFeats([], c, null, new Date('2026-10-27T10:00:00Z'));
    expect(first.added).toEqual(c.lineage.feats.map((f) => f.id));
    expect(loadCodex()).toEqual(first.codex);
    // The same lineage again (a reload, a replay) adds nothing and keeps the first date.
    const again = recordFeats(loadCodex(), c, null, new Date('2026-10-28T10:00:00Z'));
    expect(again.added).toEqual([]);
    expect(loadCodex().every((e) => e.at === '2026-10-27T10:00:00.000Z')).toBe(true);
    for (const e of loadCodex())
      expect(e).toMatchObject({ seed: 6001, scenario: 'greenvale', difficulty: 'normal' });
  });

  it('a lineage with no feats adds nothing', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(recordFeats([], createCampaign(6001), null, new Date()).added).toEqual([]);
    expect(localStorage.getItem('epoch60.codex.v1')).toBeNull();
  });

  it('notes Assisted runs and Daily Ruins on the entries they earned', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = won();
    c.mode = 'assisted';
    const { codex } = recordFeats([], c, '2026-10-27', new Date());
    expect(codex.every((e) => e.mode === 'assisted' && e.daily === '2026-10-27')).toBe(true);
  });

  it('drops stored entries this build cannot vouch for', () => {
    expect(
      sanitizeCodex([
        entry({}),
        entry({}), // a duplicate keeps only the first
        entry({ id: 'made_up_feat' }),
        entry({ id: '__proto__' }),
        entry({ id: 'cycle_broken', scenario: 'future-scenario' }),
        entry({ id: 'cycle_broken', difficulty: 'constructor' }),
        entry({ id: 'hard_won', at: 'yesterday' }),
        entry({ id: 'flood_held', seed: 'Infinity' }),
        entry({ id: 'perfect_age', mode: 'cheat' }),
        entry({ id: 'river_works', daily: '27/10/2026' }),
        null,
        'archive_built',
      ]).map((e) => e.id),
    ).toEqual(['archive_built']);
    expect(sanitizeCodex({ archive_built: true })).toEqual([]);
  });

  it('survives unreadable storage', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem('epoch60.codex.v1', '{not json');
    expect(loadCodex()).toEqual([]);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadCodex()).toEqual([]);
    // Writing fails silently; the feats stay in the lineage and are copied again next time.
    expect(recordFeats([], won(), null, new Date()).added.length).toBeGreaterThan(0);
  });
});
