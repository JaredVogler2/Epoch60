import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  LEGACY_POINTS,
  cloneCampaign,
  dispatchAction,
  legacyOf,
  replayCampaign,
} from '../../src/engine';
import type { Campaign, Legacy, LegacyKey, Transcript } from '../../src/engine';
import { isStanding } from '../../src/engine/economy/modifiers';
import { U, begin, fresh, place, runTicks } from './helpers';

const FIXTURES = ['greenvale', 'ashen', 'feats'].flatMap((dir) =>
  readdirSync(`fixtures/${dir}`)
    .filter((f) => f.endsWith('.json'))
    .map((f) => `${dir}/${f.replace('.json', '')}`),
);
const replay = (name: string): Campaign =>
  replayCampaign(JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript);
const part = (l: Legacy, key: LegacyKey) => l.parts.find((p) => p.key === key)!.points;

describe('the legacy counts only what lasted', () => {
  it('is nothing before the first catastrophe', () => {
    expect(legacyOf(fresh())).toBeNull();
  });

  it('reads every part from the state each recorded lineage ends in', () => {
    const P = LEGACY_POINTS;
    expect(FIXTURES).toHaveLength(13);
    for (const name of FIXTURES) {
      const c = replay(name);
      const l = legacyOf(c)!;
      const last = c.lineage.reports.at(-1)!;
      const standing = c.structures.filter(isStanding);
      const landmarks = standing.filter((s) => BUILDINGS[s.kind].heritage && s.originEpoch < last.epoch);
      expect(part(l, 'people'), name).toBe(last.survivors * P.person);
      expect(part(l, 'knowledge'), name).toBe(last.retainedTechs.length * P.tech);
      expect(part(l, 'works'), name).toBe(standing.length * P.work + landmarks.length * P.landmark);
      expect(part(l, 'feats'), name).toBe(c.lineage.feats.length * P.feat);
      expect(l.total, name).toBe(l.parts.reduce((sum, p) => sum + p.points, 0));
      // At the end of the last age the landmarks counted are exactly the verdict's.
      if (last.verdict?.conditions.length === 3)
        expect(landmarks.length, name).toBe(last.verdict.conditions[1]!.have);
    }
  });

  it('the recorded victories leave more than the recorded defeats', () => {
    const total = (name: string) => legacyOf(replay(name))!.total;
    const EXPECTED: Record<string, number> = {
      'greenvale/archivists': 3030,
      'greenvale/engineers': 2420,
      'greenvale/builder': 1840,
      'greenvale/noop': 230,
      'ashen/archivists': 2530,
      'ashen/engineers': 2650,
      'ashen/builder': 840,
      'ashen/steward': 590,
    };
    for (const [name, want] of Object.entries(EXPECTED)) expect(total(name), name).toBe(want);
  });

  it("building and clearing the same works again and again adds nothing, to the legacy or to the age's score", () => {
    const plain = fresh();
    plain.civ.res.timber = 200 * U;
    begin(plain);
    const farmed = cloneCampaign(plain);
    let completed = 0;
    for (let i = 0; i < 6; i++) {
      place(farmed, 'firebreak');
      let done: Campaign['structures'][number] | undefined;
      for (let t = 0; t < 300 && !done; t++) {
        runTicks(farmed, 1);
        done = farmed.structures.find((s) => s.kind === 'firebreak' && s.status === 'active');
      }
      expect(done, `firebreak ${i + 1} finished`).toBeDefined();
      completed++;
      expect(dispatchAction(farmed, { type: 'demolish', id: done!.id }).ok).toBe(true);
      runTicks(farmed, 1);
    }
    expect(farmed.civ.stats.built).toBe(plain.civ.stats.built + completed);
    for (const c of [plain, farmed]) runTicks(c, 600 - c.tick);
    expect(plain.report).not.toBeNull();
    expect(farmed.report).not.toBeNull();
    // Six works finished and cleared: the age's livelihood is no higher, and neither is the legacy.
    expect(farmed.report!.score.livelihood).toBeLessThanOrEqual(plain.report!.score.livelihood);
    expect(legacyOf(farmed)!.total).toBeLessThanOrEqual(legacyOf(plain)!.total);
  });
});
