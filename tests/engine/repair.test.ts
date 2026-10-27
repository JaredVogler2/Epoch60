import { describe, expect, it } from 'vitest';
import { BUILDINGS, MAX_QUEUE, UNIT, dispatchAction, repairCost, runTicks } from '../../src/engine';
import type { Campaign } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { begin, fresh } from './helpers';

function rich(c: Campaign): void {
  c.civ.res = { food: 900 * UNIT, timber: 900 * UNIT, stone: 900 * UNIT, knowledge: 900 * UNIT };
}

const codeOf = (r: ReturnType<typeof dispatchAction>) => (r.ok ? 'ok' : r.code);

describe('repair and restoration', () => {
  it('restoring a ruin counts against the kind limit, like building a new one', () => {
    const c = fresh();
    rich(c);
    const limit = BUILDINGS.archive.limit!;
    for (let i = 0; i < limit; i++) createStructure(c, 'archive', 3 + i * 3, 3, 0, 'active');
    const ruin = createStructure(c, 'archive', 3, 7, 0, 'rubble');
    ruin.excavated = true;
    begin(c);
    expect(codeOf(dispatchAction(c, { type: 'repair', id: ruin.id }))).toBe('limit_reached');
    // Below the limit the same ruin can be restored.
    c.structures.find((s) => s.kind === 'archive' && s.status === 'active')!.status = 'rubble';
    expect(codeOf(dispatchAction(c, { type: 'repair', id: ruin.id }))).toBe('ok');
  });

  it('a restoration queued twice is paid for once', () => {
    const c = fresh();
    rich(c);
    const ruin = createStructure(c, 'archive', 3, 7, 0, 'rubble');
    ruin.excavated = true;
    begin(c);
    expect(codeOf(dispatchAction(c, { type: 'repair', id: ruin.id }))).toBe('ok');
    expect(codeOf(dispatchAction(c, { type: 'repair', id: ruin.id }))).toBe('ok');
    const stone = c.civ.res.stone;
    const once = repairCost(ruin).stone;
    expect(once).toBeGreaterThan(0);
    runTicks(c, 1);
    expect(stone - c.civ.res.stone).toBe(once);
    expect(ruin.status).toBe('constructing');
  });

  it('a damaged hearth is mended at once instead of waiting for builders it can never have', () => {
    const c = fresh();
    rich(c);
    const hearth = c.structures.find((s) => s.kind === 'hearth')!;
    hearth.status = 'damaged';
    begin(c);
    expect(codeOf(dispatchAction(c, { type: 'repair', id: hearth.id }))).toBe('ok');
    runTicks(c, 2);
    expect(hearth.status).toBe('active');
  });

  it('an old hearth ruin can be excavated but not relit', () => {
    const c = fresh();
    rich(c);
    const old = createStructure(c, 'hearth', 3, 3, 0, 'rubble');
    old.excavated = true;
    begin(c);
    expect(codeOf(dispatchAction(c, { type: 'repair', id: old.id }))).toBe('bad_target');
  });
});

describe('order queue', () => {
  it('bounds labour-focus changes like every other order', () => {
    const c = fresh();
    begin(c);
    const results = Array.from({ length: MAX_QUEUE + 5 }, (_, i) =>
      codeOf(dispatchAction(c, { type: 'setFocus', focus: i % 2 ? 'food' : 'timber' })),
    );
    expect(c.queue.length).toBe(MAX_QUEUE);
    expect(results.slice(0, MAX_QUEUE).every((r) => r === 'ok')).toBe(true);
    expect(results.slice(MAX_QUEUE).every((r) => r === 'queue_full')).toBe(true);
  });
});
