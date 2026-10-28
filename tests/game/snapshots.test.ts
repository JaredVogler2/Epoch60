import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTicks } from '../../src/engine';
import type { Transcript } from '../../src/engine';
import { THEN_TICK, store } from '../../src/game/store';
import { memoryStorage } from './memory-storage';

afterEach(() => vi.unstubAllGlobals());

const c = () => store.campaign!;
/** Advance the live campaign as the clock does: run ticks, then tell the store. */
function tick(n: number): void {
  const ran = runTicks(c(), n);
  store.notifyTicks(ran);
}
const hearthCentre = () => {
  const h = c().structures.find((s) => s.kind === 'hearth' && s.status === 'active')!;
  return { x: h.x + h.w / 2, z: h.y + h.h / 2 };
};

describe('then-and-now pictures', () => {
  it('asks for "then" in the last seconds of the minute and "after" once the catastrophe has passed, once each', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    store.newGame(6001);
    expect(store.snapshotWanted()).toBeNull();
    store.dispatch({ type: 'beginEpoch' }, { quiet: true });
    tick(THEN_TICK - 1);
    expect(store.snapshotWanted()).toBeNull();
    tick(1);
    const then = store.snapshotWanted()!;
    expect(then).toEqual({ epoch: 0, kind: 'then', focus: hearthCentre() });
    store.recordSnapshot(then, 'data:image/jpeg;base64,then');
    expect(store.snapshotWanted()).toBeNull();
    // The catastrophe resolves at the end of the minute; the picture after it waits for the aftermath.
    tick(600);
    expect(c().phase).toBe('COLLAPSING');
    expect(store.snapshotWanted()).toBeNull();
    store.dispatch({ type: 'continue' }, { quiet: true });
    store.dispatch({ type: 'continue' }, { quiet: true });
    expect(c().phase).toBe('DEFEAT');
    const after = store.snapshotWanted()!;
    // The same viewpoint as "then", so the two pictures line up.
    expect(after).toEqual({ epoch: 0, kind: 'after', focus: then.focus });
    store.recordSnapshot(after, 'data:image/jpeg;base64,after');
    expect(store.snapshotWanted()).toBeNull();
    expect(store.snapshots[0]).toEqual({
      focus: then.focus,
      then: 'data:image/jpeg;base64,then',
      after: 'data:image/jpeg;base64,after',
    });
  });

  it('pairs the minute of a recorded age with the valley between ages', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as Transcript;
    const k = t.actions.findIndex((a) => a.action.type === 'found');
    store.newGame(t.seed, t.mode, t.scenario, t.difficulty ?? 'normal');
    let asked = 0;
    for (const entry of t.actions.slice(0, k)) {
      while (c().phase === 'ACTIVE' && c().tick < entry.tick) {
        tick(Math.min(10, entry.tick - c().tick));
        const want = store.snapshotWanted();
        if (want) {
          asked++;
          store.recordSnapshot(want, `data:${want.kind}`);
        }
      }
      expect(store.dispatch(entry.action, { quiet: true }).ok).toBe(true);
    }
    expect(asked).toBe(1);
    expect(c().phase).toBe('INTERREGNUM');
    const after = store.snapshotWanted()!;
    expect(after.kind).toBe('after');
    expect(after.epoch).toBe(0);
    expect(after.focus).toEqual(store.snapshots[0]!.focus);
  });

  it('is never asked for behind the title or without "then", and a new lineage forgets every picture', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    store.newGame(6001);
    store.dispatch({ type: 'beginEpoch' }, { quiet: true });
    tick(THEN_TICK);
    store.quitToTitle();
    expect(store.snapshotWanted()).toBeNull();
    expect(store.continueGame()).toBe(true);
    expect(store.snapshotWanted()?.kind).toBe('then');
    // Left untaken (as when a reload lands after the minute's end), "then" is missing: no "after" to pair it with.
    store.resume();
    tick(600);
    store.dispatch({ type: 'continue' }, { quiet: true });
    store.dispatch({ type: 'continue' }, { quiet: true });
    expect(c().phase).toBe('DEFEAT');
    expect(store.snapshotWanted()).toBeNull();
    store.recordSnapshot({ epoch: 0, kind: 'then', focus: { x: 1, z: 1 } }, 'data:x');
    store.newGame(6001);
    expect(store.snapshots).toEqual({});
  });
});
