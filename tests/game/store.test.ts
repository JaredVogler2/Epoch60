import { afterEach, describe, expect, it, vi } from 'vitest';
import { REINFORCE_BONUS, createCampaign, getForecast } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { bestFor, dailyRun } from '../../src/game/modes';
import type { RunCard } from '../../src/game/modes';
import { clearSave, hasSave, loadDailyTag, saveDailyTag } from '../../src/game/persist';
import { store } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

describe('saves', () => {
  it('leaving a finished lineage for the title does not bring its ending back as Continue', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const done = createCampaign(6001);
    done.phase = 'VICTORY';
    store.adopt(done);
    clearSave();
    store.quitToTitle();
    expect(hasSave()).toBe(false);
    // An unfinished lineage is still kept.
    store.adopt(createCampaign(6002));
    store.quitToTitle();
    expect(hasSave()).toBe(true);
  });

  it('a continued Daily Ruins run is still that day’s daily', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const spec = dailyRun('2026-10-27');
    store.newGame(spec.seed, 'standard', spec.scenario, spec.difficulty, spec.daily);
    store.quitToTitle();
    store.runDaily = null;
    expect(store.continueGame()).toBe(true);
    expect(store.runDaily).toBe('2026-10-27');
  });

  it('a daily tag is trusted only for the seed that day really has', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const day = '2026-10-27';
    const { seed } = dailyRun(day);
    const seedOf = (d: string) => dailyRun(d).seed;
    saveDailyTag(seed, day);
    expect(loadDailyTag(seed, seedOf)).toBe(day);
    expect(loadDailyTag(seed + 1, seedOf)).toBeNull();
    saveDailyTag(seed + 1, day);
    expect(loadDailyTag(seed + 1, seedOf), 'an ordinary run claiming to be the daily').toBeNull();
    saveDailyTag(seed, day);
    clearSave();
    expect(loadDailyTag(seed, seedOf)).toBeNull();
  });
});

describe('forecast cache', () => {
  it('notices an ash reinforcement', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = createCampaign(6001, 'standard', 'ashen');
    c.epoch = 2;
    const worst = getForecast(c)!.predicted.cells.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    const hut = createStructure(c, 'cottage', worst.x, worst.y, 0, 'active');
    store.adopt(c);
    const damageIn = (f: ReturnType<typeof getForecast> | null) =>
      f?.predicted.impacts.find((i) => i.id === hut.id)?.damage ?? 0;
    const before = damageIn(store.getForecastCached());
    hut.bonus.ash = REINFORCE_BONUS;
    store.notifyTicks(0);
    const truth = damageIn(getForecast(c));
    expect(truth).toBeLessThan(before);
    expect(damageIn(store.getForecastCached())).toBe(truth);
  });
});

describe('run cards', () => {
  it('rank assisted runs apart from standard ones', () => {
    const card = (over: Partial<RunCard>): RunCard => ({
      id: Math.random().toString(36),
      at: '2026-10-27T00:00:00.000Z',
      seed: 7,
      scenario: 'greenvale',
      difficulty: 'normal',
      outcome: 'defeat',
      title: '',
      survivors: 2,
      heritage: 0,
      techs: 0,
      epochs: 3,
      hash: '',
      ...over,
    });
    const runs = [card({ outcome: 'victory', survivors: 12, mode: 'assisted' }), card({ survivors: 4 })];
    const spec = { seed: 7, scenario: 'greenvale', difficulty: 'normal' as const };
    expect(bestFor(runs, spec)?.outcome).toBe('defeat');
    expect(bestFor(runs, { ...spec, mode: 'assisted' })?.outcome).toBe('victory');
  });
});
