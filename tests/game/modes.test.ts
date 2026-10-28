import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES_VERSION, createCampaign, dispatchAction, legacyOf, runTicks } from '../../src/engine';
import {
  MAX_CARDS,
  MAX_SEED,
  bestFor,
  cardOf,
  dailyRun,
  loadRuns,
  parseShare,
  saveRun,
  seedFromText,
  shareQuery,
  utcDate,
} from '../../src/game/modes';
import type { RunCard } from '../../src/game/modes';

function memoryStorage(failWrites = false) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error('quota');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe('seeds', () => {
  it('uses numbers as typed and hashes words to a stable, non-zero uint32', () => {
    expect(seedFromText('6001')).toBe(6001);
    expect(seedFromText('  42 ')).toBe(42);
    const a = seedFromText('river kingdom');
    expect(a).toBe(seedFromText('river kingdom'));
    expect(a).not.toBe(seedFromText('river kingdoms'));
    expect(a! >= 1 && a! <= MAX_SEED).toBe(true);
  });

  it('refuses empty, absurd, and out-of-range seeds instead of trusting them', () => {
    expect(seedFromText('')).toBeNull();
    expect(seedFromText('   ')).toBeNull();
    expect(seedFromText('x'.repeat(65))).toBeNull();
    expect(seedFromText('0')).toBeNull();
    expect(seedFromText('4294967296')).toBeNull();
    expect(seedFromText('99999999999')).toBe(seedFromText('99999999999'));
  });
});

describe('Daily Ruins', () => {
  it('is one fixed run per UTC date, pinned to Normal, and different on different dates', () => {
    const a = dailyRun('2026-10-27');
    expect(a).toEqual(dailyRun('2026-10-27'));
    expect(a.difficulty).toBe('normal');
    expect(a.daily).toBe('2026-10-27');
    const seeds = new Set(
      Array.from({ length: 30 }, (_, i) => dailyRun(`2026-11-${String(i + 1).padStart(2, '0')}`).seed),
    );
    expect(seeds.size).toBeGreaterThan(25);
    const scenarios = new Set(
      Array.from({ length: 30 }, (_, i) => dailyRun(`2026-11-${String(i + 1).padStart(2, '0')}`).scenario),
    );
    expect(scenarios.size).toBe(2);
  });

  it('uses the UTC calendar date and rejects malformed dates', () => {
    expect(utcDate(new Date('2026-10-27T23:59:59Z'))).toBe('2026-10-27');
    expect(utcDate(new Date('2026-10-28T00:00:01Z'))).toBe('2026-10-28');
    expect(dailyRun('not-a-date').daily).toBe('2000-01-01');
  });

  it('plays: the daily valley is a valid, startable campaign', () => {
    const d = dailyRun('2026-10-27');
    const c = createCampaign(d.seed, 'standard', d.scenario, d.difficulty);
    expect(dispatchAction(c, { type: 'beginEpoch' }).ok).toBe(true);
    runTicks(c, 10);
    expect(c.tick).toBe(10);
  });
});

describe('share URLs', () => {
  it('round-trips a run spec', () => {
    const spec = { seed: 123456, scenario: 'ashen', difficulty: 'hard' as const, daily: '2026-10-27' };
    expect(parseShare(shareQuery(spec))).toEqual(spec);
  });

  it('drops anything invalid and never carries code or oversized input', () => {
    expect(parseShare('?seed=abc&scenario=nope&difficulty=insane&daily=x')).toEqual({});
    expect(parseShare('?seed=0')).toEqual({});
    expect(parseShare('?seed=4294967296')).toEqual({});
    expect(parseShare('?scenario=__proto__')).toEqual({});
    expect(parseShare('?scenario=constructor')).toEqual({});
    expect(parseShare('?seed=1&scenario=<script>alert(1)</script>')).toEqual({ seed: 1 });
    expect(parseShare('?' + 'a=b&'.repeat(200))).toEqual({});
    expect(parseShare('?seed=1.5')).toEqual({});
  });

  it('ignores a link longer than 512 characters, even one that is otherwise valid', () => {
    const valid = '?seed=42&scenario=ashen&difficulty=hard';
    const padded = (length: number) => `${valid}&pad=${'x'.repeat(length - valid.length - 5)}`;
    expect(padded(512)).toHaveLength(512);
    expect(parseShare(padded(512))).toEqual({ seed: 42, scenario: 'ashen', difficulty: 'hard' });
    expect(parseShare(padded(513))).toEqual({});
  });
});

describe('run cards', () => {
  const finished = (): ReturnType<typeof createCampaign> => {
    const c = createCampaign(6001);
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 600);
    return c;
  };

  it('are made only from finished campaigns', () => {
    expect(cardOf(createCampaign(6001), undefined, new Date())).toBeNull();
    const c = finished();
    expect(c.phase).toBe('COLLAPSING');
    expect(cardOf(c, undefined, new Date())).toBeNull();
    dispatchAction(c, { type: 'continue' });
    dispatchAction(c, { type: 'continue' });
    expect(c.phase).toBe('DEFEAT');
    const card = cardOf(c, '2026-10-27', new Date('2026-10-27T10:00:00Z'))!;
    expect(card).toMatchObject({ seed: 6001, scenario: 'greenvale', outcome: 'defeat', daily: '2026-10-27' });
    expect(card.hash).toHaveLength(14);
    // It carries the lineage's legacy and the rules that scored it.
    expect(card.legacy).toBe(legacyOf(c)!.total);
    expect(card.rules).toBe(RULES_VERSION);
  });

  it('persist newest first, bounded, and survive corrupt or disabled storage', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const mk = (i: number): RunCard => ({
      id: `r${i}`,
      seed: i + 1,
      scenario: 'greenvale',
      difficulty: 'normal',
      at: new Date(1_700_000_000_000 + i).toISOString(),
      outcome: i % 2 ? 'victory' : 'defeat',
      title: 't',
      survivors: i,
      heritage: 0,
      techs: 0,
      epochs: 3,
      hash: 'h',
    });
    for (let i = 0; i < MAX_CARDS + 10; i++) saveRun(mk(i));
    const all = loadRuns();
    expect(all).toHaveLength(MAX_CARDS);
    expect(all[0]!.id).toBe(`r${MAX_CARDS + 9}`);

    localStorage.setItem('epoch60.runs.v1', '{not json');
    expect(loadRuns()).toEqual([]);
    localStorage.setItem('epoch60.runs.v1', JSON.stringify([{ id: 1 }, 'x', null, mk(1)]));
    expect(loadRuns()).toHaveLength(1);

    vi.stubGlobal('localStorage', memoryStorage(true));
    expect(() => saveRun(mk(5))).not.toThrow();
  });

  it('pick the best local result: a victory beats a defeat, then the greater legacy, then more survivors', () => {
    const base = { seed: 7, scenario: 'greenvale', difficulty: 'normal' as const };
    const mk = (id: string, outcome: 'victory' | 'defeat', survivors: number, legacy = 0): RunCard => ({
      ...base,
      id,
      at: '2026-10-27T00:00:00.000Z',
      outcome,
      title: '',
      survivors,
      heritage: 0,
      techs: 0,
      epochs: 3,
      hash: '',
      legacy,
      rules: RULES_VERSION,
    });
    const runs = [mk('a', 'defeat', 12), mk('b', 'victory', 8), mk('c', 'victory', 10)];
    expect(bestFor(runs, base)!.id).toBe('c');
    expect(bestFor(runs, { ...base, seed: 8 })).toBeNull();
    // Between two victories the one that left more wins, even with fewer people.
    expect(bestFor([mk('d', 'victory', 12, 2400), mk('e', 'victory', 9, 2900)], base)!.id).toBe('e');
  });

  it('compare only runs scored under the same rules', () => {
    const base = { seed: 7, scenario: 'greenvale', difficulty: 'normal' as const };
    const mk = (id: string, rules: string | undefined): RunCard => ({
      ...base,
      id,
      at: '2026-10-27T00:00:00.000Z',
      outcome: 'victory',
      title: '',
      survivors: 10,
      heritage: 0,
      techs: 0,
      epochs: 3,
      hash: '',
      ...(rules ? { rules, legacy: 1000 } : {}),
    });
    // A card from before legacies were kept, or from other rules, is shown in the list but never ranked.
    expect(bestFor([mk('old', undefined), mk('other', '0.3.0')], base)).toBeNull();
    expect(bestFor([mk('old', undefined), mk('now', RULES_VERSION)], base)!.id).toBe('now');
  });
});
