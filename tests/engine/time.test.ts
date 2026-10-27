import { describe, expect, it } from 'vitest';
import { advanceFixedTick, canAdvance, dispatchAction, EPOCH_TICKS, setPaused } from '../../src/engine';
import { act, begin, fresh, place, runTicks, scriptedEpoch } from './helpers';

describe('epoch clock and state machine', () => {
  it('does not tick before the epoch begins', () => {
    const c = fresh();
    expect(c.phase).toBe('PREPARE');
    expect(advanceFixedTick(c)).toBe(false);
    expect(c.tick).toBe(0);
  });

  it('runs exactly 600 ticks (not 601) and collapses once', () => {
    const c = fresh();
    begin(c);
    let n = 0;
    while (advanceFixedTick(c)) n++;
    expect(n).toBe(EPOCH_TICKS);
    expect(c.tick).toBe(EPOCH_TICKS);
    expect(c.phase).toBe('COLLAPSING');
    expect(c.report).not.toBeNull();
    // Repeated attempts to advance after the end change nothing.
    const hash = JSON.stringify(c.report);
    for (let i = 0; i < 50; i++) expect(advanceFixedTick(c)).toBe(false);
    expect(c.tick).toBe(EPOCH_TICKS);
    expect(JSON.stringify(c.report)).toBe(hash);
    expect(c.lineage.reports).toHaveLength(1);
  });

  it('double Begin cannot start a second epoch or reset the clock', () => {
    const c = fresh();
    begin(c);
    runTicks(c, 123);
    const r = dispatchAction(c, { type: 'beginEpoch' });
    expect(r.ok).toBe(false);
    expect(c.tick).toBe(123);
  });

  it('a paused game never advances, however many ticks are requested', () => {
    const c = fresh();
    begin(c);
    runTicks(c, 100);
    setPaused(c, true);
    expect(canAdvance(c)).toBe(false);
    const before = JSON.stringify(c);
    for (let i = 0; i < 5000; i++) advanceFixedTick(c);
    expect(JSON.stringify(c)).toBe(before);
    setPaused(c, false);
    expect(advanceFixedTick(c)).toBe(true);
    expect(c.tick).toBe(101);
  });

  it('rejects building after the end and while collapsing', () => {
    const c = fresh();
    begin(c);
    runTicks(c, EPOCH_TICKS);
    const r = act(c, { type: 'build', kind: 'cottage', x: 10, y: 10, rot: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('wrong_phase');
  });

  it('accepts an action stamped at the final tick and never after', () => {
    const c = fresh();
    begin(c);
    runTicks(c, EPOCH_TICKS - 1);
    expect(c.tick).toBe(EPOCH_TICKS - 1);
    // Tick 599 is still live: a repairable/cheap order is accepted into the last boundary.
    const r = act(c, { type: 'setFocus', focus: 'food' });
    expect(r.ok).toBe(true);
    advanceFixedTick(c);
    expect(c.civ.focus).toBe('food');
    expect(act(c, { type: 'setFocus', focus: 'timber' }).ok).toBe(false);
  });

  it('walks PREPARE → ACTIVE → COLLAPSING → DEBRIEF → INTERREGNUM → PREPARE', () => {
    const c = fresh();
    scriptedEpoch(c);
    expect(c.phase).toBe('COLLAPSING');
    expect(act(c, { type: 'continue' }).ok).toBe(true);
    expect(c.phase).toBe('DEBRIEF');
    expect(act(c, { type: 'continue' }).ok).toBe(true);
    expect(c.phase).toBe('INTERREGNUM');
    const inter = c.lineage.interregnum!;
    expect(inter.sites.length).toBeGreaterThan(0);
    expect(act(c, { type: 'found', site: 0, tradition: inter.traditions[0]!.id }).ok).toBe(true);
    expect(c.phase).toBe('PREPARE');
    expect(c.epoch).toBe(1);
    expect(c.tick).toBe(0);
  });

  it('the pre-epoch period cannot produce anything: resources are untouched while in PREPARE', () => {
    const c = fresh();
    const before = JSON.stringify(c.civ.res);
    place(c, 'farm');
    // Planning reserves cost but nothing is spent and no time passes.
    expect(JSON.stringify(c.civ.res)).toBe(before);
    for (let i = 0; i < 100; i++) advanceFixedTick(c);
    expect(JSON.stringify(c.civ.res)).toBe(before);
  });

  it('limits the opening plan to three slots', () => {
    const c = fresh();
    place(c, 'farm');
    place(c, 'lumber_camp');
    place(c, 'cottage');
    const r = act(c, { type: 'build', kind: 'cottage', x: 8, y: 20, rot: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(['plan_slots_full', 'overlap', 'unreachable', 'on_water', 'not_enough']).toContain(r.code);
  });
});
