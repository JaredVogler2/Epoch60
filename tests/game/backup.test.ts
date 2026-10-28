import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeHash,
  createCampaign,
  dispatchAction,
  replayCampaign,
  runTicks,
  serialize,
} from '../../src/engine';
import type { FeatId, Transcript } from '../../src/engine';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_CHARS,
  applyBackup,
  checkBackup,
  createBackup,
} from '../../src/game/backup';
import type { BackupPlan } from '../../src/game/backup';
import { loadBranchTag, saveBranchPoint, saveBranchTag } from '../../src/game/branches';
import { loadCodex, saveCodex } from '../../src/game/codex';
import type { CodexEntry } from '../../src/game/codex';
import { MAX_CARDS, dailyRun, loadRuns, saveRuns } from '../../src/game/modes';
import type { RunCard } from '../../src/game/modes';
import {
  loadCampaign,
  loadDailyTag,
  saveCampaign,
  saveDailyTag,
  unfinishedSave,
  writeSaveText,
} from '../../src/game/persist';
import { GameStore } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;
/** The recorded lineage just after its n-th founding (an age in progress, as a player would leave it). */
const atFounding = (t: Transcript, n: number) => {
  let seen = 0;
  const k = t.actions.findIndex((a) => a.action.type === 'found' && ++seen === n) + 1;
  return replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
};
const entry = (id: string, at: string): CodexEntry => ({
  id: id as FeatId,
  at,
  seed: 1,
  scenario: 'greenvale',
  difficulty: 'normal',
});
const card = (id: string, at: string): RunCard => ({
  id,
  at,
  seed: 1,
  scenario: 'greenvale',
  difficulty: 'normal',
  outcome: 'victory',
  title: 'The cycle is broken',
  survivors: 9,
  heritage: 1,
  techs: 2,
  epochs: 3,
  hash: 'h',
});
const day = (d: number) => `2026-10-${String(d).padStart(2, '0')}T00:00:00.000Z`;
const planOf = (text: string): BackupPlan => {
  const r = checkBackup(text);
  if (!r.ok) throw new Error(r.reason);
  return r.plan;
};
const backupText = (over: Record<string, unknown>) =>
  JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, codex: [], runs: [], ...over });

describe('a backup of what this browser keeps', () => {
  it('carries the saved lineage, its branch mark, the Codex and the run cards to another browser exactly', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = atFounding(load('greenvale/archivists'), 2);
    expect([c.phase, c.epoch]).toEqual(['PREPARE', 2]);
    saveCampaign(c);
    saveBranchTag(c.seed, 1);
    saveCodex([entry('archive_built', day(1)), entry('old_foundations', day(2))]);
    saveRuns([card('earlier', day(3))]);
    const text = JSON.stringify(createBackup());

    // Another browser, with nothing in it.
    vi.stubGlobal('localStorage', memoryStorage());
    const plan = planOf(text);
    expect(computeHash(plan.lineage!.campaign)).toBe(computeHash(c));
    expect(plan.lineage!.branch).toBe(1);
    expect(plan).toMatchObject({ lineageUnreadable: false, dropped: 0 });
    expect(applyBackup(plan, { codex: [], runs: [] })).toMatchObject({
      newFeats: 2,
      newRuns: 1,
      lineage: true,
    });
    expect(computeHash(loadCampaign()!)).toBe(computeHash(c));
    expect(loadBranchTag(c.seed)).toBe(1);
    expect(loadCodex().map((e) => e.id)).toEqual(['archive_built', 'old_foundations']);
    expect(loadRuns().map((r) => r.id)).toEqual(['earlier']);
  });

  it('keeps a Daily Ruins lineage’s date only when it is that day’s valley', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const today = dailyRun('2026-10-28');
    const c = createCampaign(today.seed, 'standard', today.scenario, 'normal');
    saveCampaign(c);
    saveDailyTag(c.seed, '2026-10-28');
    const b = createBackup();
    expect(b.lineage?.daily).toBe('2026-10-28');
    vi.stubGlobal('localStorage', memoryStorage());
    applyBackup(planOf(JSON.stringify(b)), { codex: [], runs: [] });
    expect(loadDailyTag(c.seed, (d) => dailyRun(d).seed)).toBe('2026-10-28');
    // A date edited into the file is not trusted: it is not that day's valley.
    const forged = planOf(JSON.stringify({ ...b, lineage: { ...b.lineage, daily: '2026-10-27' } }));
    expect(forged.lineage!.daily).toBeNull();
  });

  it('joins the feats and cards already here: nothing here is lost, and each feat keeps its first earning', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const mine = atFounding(load('greenvale/engineers'), 1);
    saveCampaign(mine);
    const here = {
      codex: [entry('archive_built', day(5)), entry('fire_contained', day(6))],
      runs: [card('a', day(1)), card('b', day(3))],
    };
    const plan = planOf(
      backupText({
        codex: [entry('archive_built', day(2)), entry('cycle_broken', day(7))],
        runs: [card('b', day(3)), card('c', day(2))],
      }),
    );
    const r = applyBackup(plan, here);
    expect(r.codex.map((e) => [e.id, e.at])).toEqual([
      ['archive_built', day(2)],
      ['fire_contained', day(6)],
      ['cycle_broken', day(7)],
    ]);
    expect(r.runs.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(r).toMatchObject({ newFeats: 1, newRuns: 1, lineage: false });
    expect(loadCodex()).toEqual(r.codex);
    expect(loadRuns()).toEqual(r.runs);
    // A backup without a lineage leaves the saved one alone.
    expect(computeHash(loadCampaign()!)).toBe(computeHash(mine));
    // Cards stay bounded: the newest are kept.
    const many = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        card(`k${from + i}`, new Date(Date.UTC(2026, 0, 1 + from + i)).toISOString()),
      );
    const big = applyBackup(planOf(backupText({ runs: many(30, 30) })), { codex: [], runs: many(0, 30) });
    expect(big.runs).toHaveLength(MAX_CARDS);
    expect(big.runs[0]!.id).toBe('k59');
    expect(big.runs.at(-1)!.id).toBe('k20');
  });

  it('replaces the saved lineage, and the branch points of the one it replaces go with it', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const old = atFounding(load('greenvale/builder'), 2);
    saveBranchPoint(old);
    saveBranchTag(old.seed, 2);
    expect(localStorage.getItem('epoch60.branches.v1')).not.toBeNull();
    const incoming = atFounding(load('greenvale/archivists'), 1);
    applyBackup(planOf(backupText({ lineage: { save: serialize(incoming) } })), { codex: [], runs: [] });
    expect(computeHash(loadCampaign()!)).toBe(computeHash(incoming));
    expect(localStorage.getItem('epoch60.branches.v1')).toBeNull();
    expect(loadBranchTag(incoming.seed)).toBeNull();
  });

  it('refuses a file that is not a backup, and leaves out what it cannot read', () => {
    const reason = (text: string) => {
      const r = checkBackup(text);
      return r.ok ? null : r.reason;
    };
    expect(reason('hello')).toBe('That file is not an EPOCH backup.');
    expect(reason('null')).toBe('That file is not an EPOCH backup.');
    expect(reason(JSON.stringify({ format: 'something-else', version: 1 }))).toBe(
      'That file is not an EPOCH backup.',
    );
    expect(reason(backupText({ version: 0 }))).toBe('That file is not an EPOCH backup.');
    expect(reason(backupText({ version: BACKUP_VERSION + 1 }))).toBe(
      'That backup comes from a newer version of EPOCH.',
    );
    expect(reason(' '.repeat(MAX_BACKUP_CHARS + 1))).toBe('That file is too large to be an EPOCH backup.');

    const c = atFounding(load('greenvale/archivists'), 1);
    const save = serialize(c);
    // An edited save fails its integrity check: the lineage is left out, the rest still comes in.
    const damaged = planOf(
      backupText({
        lineage: { save: save.replace('"pop":', '"pop":1') },
        codex: [entry('archive_built', day(1)), { id: 'no_such_feat', at: day(1) }],
        runs: [card('ok', day(1)), { id: 5 }, card('bad-date', 'yesterday')],
      }),
    );
    expect(damaged).toMatchObject({ lineage: null, lineageUnreadable: true, dropped: 3 });
    expect(damaged.codex.map((e) => e.id)).toEqual(['archive_built']);
    expect(damaged.runs.map((r) => r.id)).toEqual(['ok']);
    expect(planOf(backupText({ lineage: { save: 42 } })).lineageUnreadable).toBe(true);
    // A branch mark is trusted only within the lineage's own ages.
    expect(planOf(backupText({ lineage: { save, branch: c.epoch + 1 } })).lineage!.branch).toBeNull();
    expect(planOf(backupText({ lineage: { save, branch: 'II' } })).lineage!.branch).toBeNull();
    expect(planOf(backupText({ lineage: { save, branch: c.epoch } })).lineage!.branch).toBe(c.epoch);
    // Keys of JSON are data, never object structure.
    const proto = planOf(
      `{"format":"${BACKUP_FORMAT}","version":1,"__proto__":{"polluted":true},"codex":[]}`,
    );
    expect(proto.codex).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('the store brings a backup in: Continue resumes its lineage, and the Codex and cards show it', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const c = atFounding(load('greenvale/archivists'), 1);
    const plan = planOf(
      backupText({
        lineage: { save: serialize(c) },
        codex: [entry('archive_built', day(1))],
        runs: [card('x', day(2))],
      }),
    );
    const s = new GameStore();
    expect(s.continueGame()).toBe(false);
    const r = s.importBackup(plan);
    expect(r.lineage).toBe(true);
    expect(s.codex.map((e) => e.id)).toEqual(['archive_built']);
    expect(s.runs.map((x) => x.id)).toEqual(['x']);
    expect(s.continueGame()).toBe(true);
    expect(computeHash(s.campaign!)).toBe(computeHash(c));
  });
});

describe('a new lineage replacing the saved one', () => {
  it('asks first only when that would throw progress away: begun, and not yet ended', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(unfinishedSave()).toBeNull();
    // Just started: nothing done yet.
    const c = createCampaign(6001);
    saveCampaign(c);
    expect(unfinishedSave()).toBeNull();
    // One thing done.
    expect(dispatchAction(c, { type: 'beginEpoch' }).ok).toBe(true);
    runTicks(c, 5);
    saveCampaign(c);
    expect(unfinishedSave()?.seed).toBe(6001);
    // A later age, even before anything is done in it.
    saveCampaign(atFounding(load('greenvale/archivists'), 1));
    expect(unfinishedSave()?.epoch).toBe(1);
    // Ended lineages are on their run cards; unreadable ones cannot be resumed anyway.
    saveCampaign(replayCampaign(load('greenvale/archivists')));
    expect(unfinishedSave()).toBeNull();
    writeSaveText('{damaged');
    expect(unfinishedSave()).toBeNull();
  });
});
