import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chronicleEnding, computeHash, dispatchAction, replayCampaign } from '../../src/engine';
import type { Transcript } from '../../src/engine';
import { playCampaign } from '../../src/engine/ai/bots';
import { ROUTES } from '../../src/engine/ai/routes';
import { EpochClock } from '../../src/game/clock';
import { bestFor, cardOf, loadRuns, saveRun } from '../../src/game/modes';
import { GameStore } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;
const won = () => replayCampaign(load('greenvale/archivists'));

describe('the long chronicle in the game layer', () => {
  it('cards the end of a long chronicle apart from its victory, and never ranks it', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const victory = cardOf(won(), undefined, new Date(1000))!;
    const c = won();
    dispatchAction(c, { type: 'endure' });
    playCampaign(c, ROUTES.archivists!, { ages: 4 });
    const end = chronicleEnding(c)!;
    const card = cardOf(c, undefined, new Date(2000))!;
    expect(card).toMatchObject({ outcome: 'victory', endless: true, epochs: 4, title: end.title });
    expect(card.survivors).toBe(c.report!.survivors);
    expect(card.techs).toBe(c.report!.retainedTechs.length);
    expect(victory.endless).toBeUndefined();
    saveRun(victory);
    saveRun(card);
    const runs = loadRuns();
    expect(runs.map((r) => r.id)).toEqual([card.id, victory.id]);
    // More ages, more legacy: the chronicle is never compared with three-age lineages.
    expect(card.legacy).toBeGreaterThan(0);
    expect(bestFor(runs, { seed: c.seed, scenario: 'greenvale', difficulty: 'normal' })!.id).toBe(victory.id);
    expect(bestFor([card], { seed: c.seed, scenario: 'greenvale', difficulty: 'normal' })).toBeNull();
    // A stored card claiming anything else is skipped, never trusted.
    localStorage.setItem('epoch60.runs.v1', JSON.stringify([{ ...card, endless: 'yes' }]));
    expect(loadRuns()).toEqual([]);
  });

  it('carries a victory on through the store, saves it, and cards the chronicle when it is rested', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const store = new GameStore();
    store.adopt(won());
    expect(store.dispatch({ type: 'endure' }).ok).toBe(true);
    const c = store.campaign!;
    expect(c.phase).toBe('INTERREGNUM');
    // The continuing chronicle replaces the save (a finished lineage would not be saved again).
    expect(localStorage.getItem('epoch60.save.v1')).toContain('"endless":{"rested":false}');
    playCampaign(c, ROUTES.archivists!, { ages: 5, maxEpochs: 1 });
    expect(c.phase).toBe('DEBRIEF');
    const before = store.runs.length;
    if (c.report!.survivors >= 3) {
      expect(store.dispatch({ type: 'rest' }).ok).toBe(true);
      expect(store.runs.length).toBe(before + 1);
      expect(store.runs[0]).toMatchObject({ endless: true, epochs: 4, title: 'The chronicle rests' });
    }
  });

  it('is watched again through its victory and on to its end, ending exactly where it did', () => {
    const c = won();
    dispatchAction(c, { type: 'endure' });
    playCampaign(c, ROUTES.archivists!, { ages: 4 });
    const hash = computeHash(c);
    const store = new GameStore();
    store.adopt(c);
    expect(store.watchLineage()).toBe(true);
    store.setReplaySpeed(4);
    const clock = new EpochClock(store);
    const phases = new Set<string>();
    for (let i = 0; i < 200_000 && store.replay!.matched === null; i++) {
      clock.step(100);
      if (store.campaign!.epoch === 2) phases.add(store.campaign!.phase);
    }
    expect(store.replay!.matched).toBe(true);
    expect(computeHash(store.campaign!)).toBe(hash);
    // It paused on the victory before carrying the chronicle on.
    expect(phases.has('VICTORY')).toBe(true);
    expect(store.campaign!.epoch).toBe(3);
  });
});
