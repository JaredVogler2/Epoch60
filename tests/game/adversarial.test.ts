import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UNIT,
  createCampaign,
  dispatchAction,
  epochSpec,
  replayCampaign,
  runTicks,
  serialize,
} from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { BACKUP_FORMAT, applyBackup, checkBackup, importedBranch } from '../../src/game/backup';
import type { BackupPlan } from '../../src/game/backup';
import { loadBranchTag, saveBranchTag } from '../../src/game/branches';
import { bestFor, loadRuns } from '../../src/game/modes';
import { GameStore } from '../../src/game/store';
import { announcement } from '../../src/ui/Announcer';
import { tabletsUnderSite } from '../../src/ui/ruins';
import { memoryStorage } from './memory-storage';

/** Regressions for what the Phase 19 adversarial review found outside the engine (docs/ADVERSARIAL_REVIEW.md). */

afterEach(() => vi.unstubAllGlobals());

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;
const planOf = (lineage: Campaign, branch?: number): BackupPlan => {
  const r = checkBackup(
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      lineage: { save: serialize(lineage), ...(branch !== undefined ? { branch } : {}) },
      codex: [],
      runs: [],
    }),
  );
  if (!r.ok) throw new Error(r.reason);
  return r.plan;
};

describe('the screen reader hears the minute run down', () => {
  it('30 s left, each warning, 10 s left between the second and the last warning, then the last', () => {
    const c = createCampaign(6001);
    dispatchAction(c, { type: 'beginEpoch' });
    c.civ.res.food = 800 * UNIT;
    const at = (tick: number) => {
      runTicks(c, tick - c.tick);
      return announcement(c);
    };
    const w = epochSpec(c, 0).hazard.warnings;
    expect(at(300)).toBe('30 seconds left.');
    expect(at(360)).toBe(w[0]);
    expect(at(455)).toBe(w[1]);
    expect(at(500)).toBe('10 seconds left.');
    expect(at(555)).toBe(w[2]);
  });
});

describe('founding the next age', () => {
  it('says when a site would clear an Archive never dug up (its tablets lost), and only then', () => {
    const c = createCampaign(6001);
    const ruin = createStructure(c, 'archive', 10, 10, 0, 'active');
    ruin.status = 'rubble';
    expect(tabletsUnderSite(c, 10, 10)).toBe(true);
    // The hearth's 2×2 pad overlapping the ruin's corner is enough.
    expect(tabletsUnderSite(c, 9, 9)).toBe(true);
    expect(tabletsUnderSite(c, 8, 8)).toBe(false);
    expect(tabletsUnderSite(c, 10 + ruin.w, 10)).toBe(false);
    ruin.excavated = true;
    expect(tabletsUnderSite(c, 10, 10)).toBe(false);
  });
});

describe('a save that cannot be read', () => {
  it('is set aside under its own key, as the title says, so Continue never fails on it again', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    localStorage.setItem('epoch60.save.v1', '{"from":"another version"}');
    const s = new GameStore();
    expect(s.continueGame()).toBe(false);
    s.abandonSave();
    expect(localStorage.getItem('epoch60.save.v1')).toBeNull();
    expect(localStorage.getItem('epoch60.save-unreadable.v1')).toBe('{"from":"another version"}');
  });
});

describe('the interface acts only through the store', () => {
  it('no screen calls an engine function that changes the campaign (the replay viewer could be thrown off its path)', () => {
    const mutators =
      /\b(dispatchAction|unplan|runTicks|advanceFixedTick|applyChoice|foundNextEpoch|excavateRuin|surveyRuin)\(/;
    for (const name of readdirSync('src/ui')) {
      if (!/\.tsx?$/.test(name)) continue;
      const text = readFileSync(`src/ui/${name}`, 'utf8');
      expect(mutators.test(text), name).toBe(false);
    }
  });
});

describe('a lineage brought back from a backup', () => {
  it('is a branch from the age it was in once it had begun, so retrying a lost age is never ranked', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = load('greenvale/archivists');
    let seen = 0;
    const k = t.actions.findIndex((a) => a.action.type === 'found' && ++seen === 1) + 1;
    const second = replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
    expect(second.epoch).toBe(1);
    expect(importedBranch(planOf(second).lineage!)).toBe(1);
    applyBackup(planOf(second), { codex: [], runs: [] });
    expect(loadBranchTag(second.seed)).toBe(1);

    // Begun in its first age: a branch from age I.
    const first = createCampaign(77);
    dispatchAction(first, { type: 'beginEpoch' });
    expect(importedBranch(planOf(first).lineage!)).toBe(0);
    // Not begun at all: nothing to retry, a straight lineage.
    expect(importedBranch(planOf(createCampaign(78)).lineage!)).toBeNull();
    // Already a branch: it keeps its own mark.
    expect(importedBranch(planOf(second, 1).lineage!)).toBe(1);
  });

  it('plays on as that branch through the store, and its card is never ranked', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = createCampaign(6001);
    dispatchAction(c, { type: 'beginEpoch' });
    const s = new GameStore();
    s.importBackup(planOf(c));
    expect(s.continueGame()).toBe(true);
    expect(s.branch).toBe(0);
    // A card from such a lineage (branch 0 included) is kept but never ranked.
    saveBranchTag(c.seed, 0);
    const card = {
      id: 'b0',
      at: '2026-10-28T00:00:00.000Z',
      seed: 6001,
      scenario: 'greenvale',
      difficulty: 'normal',
      outcome: 'victory',
      title: 'The cycle is broken',
      survivors: 12,
      heritage: 1,
      techs: 3,
      epochs: 3,
      hash: 'h',
      branch: 0,
    };
    localStorage.setItem('epoch60.runs.v1', JSON.stringify([card]));
    expect(loadRuns().map((r) => r.branch)).toEqual([0]);
    expect(bestFor(loadRuns(), { seed: 6001, scenario: 'greenvale', difficulty: 'normal' })).toBeNull();
  });
});
