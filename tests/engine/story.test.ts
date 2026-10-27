import { describe, expect, it } from 'vitest';
import {
  computeHash,
  deserialize,
  dispatchAction,
  resolveHazard,
  runTicks,
  serialize,
  UNIT,
} from '../../src/engine';
import type { Campaign, StoryId } from '../../src/engine';
import { openPrompts } from '../../src/engine/events/story';
import { createStructure } from '../../src/engine/economy/structures';
import { begin, fresh } from './helpers';

/** A village with a cottage standing squarely in the fire's path. */
function firePath(c: Campaign) {
  const { hearth, fireOrigin } = c.world.anchors;
  const mx = Math.round((hearth.x + fireOrigin.x) / 2);
  const my = Math.round((hearth.y + fireOrigin.y) / 2);
  return createStructure(c, 'cottage', mx, my, 0, 'active');
}

function stage(epoch: number): Campaign {
  const c = fresh();
  c.epoch = epoch;
  c.civ.res.food = 300 * UNIT;
  c.civ.res.timber = 300 * UNIT;
  c.civ.res.stone = 300 * UNIT;
  return c;
}

function promptOf(c: Campaign, story: StoryId) {
  return c.prompts.find((p) => p.story === story);
}

describe('story decisions arise from real state', () => {
  it('a wildfire warning appears only when the forecast actually threatens buildings', () => {
    // In a flood epoch the same village is not offered a fire decision.
    const wrongAge = stage(1);
    firePath(wrongAge);
    begin(wrongAge);
    runTicks(wrongAge, 300);
    expect(promptOf(wrongAge, 'dry_wind')).toBeUndefined();

    const threatened = stage(0);
    firePath(threatened);
    begin(threatened);
    runTicks(threatened, 200);
    const p = promptOf(threatened, 'dry_wind');
    expect(p).toBeDefined();
    expect(p!.options.map((o) => o.id)).toEqual(['clear_brush', 'gather_timber', 'ignore']);
    expect(p!.defaultOption).toBe('ignore');
  });

  it('never offers a dam leak without a dam, a flood warning in a fire epoch, or refugees without beds', () => {
    const c = stage(0);
    firePath(c);
    begin(c);
    runTicks(c, 450);
    for (const s of ['dam_leak', 'river_rising', 'foreshock', 'refugees'] as StoryId[])
      expect(promptOf(c, s), s).toBeUndefined();

    const flood = stage(1);
    flood.civ.techs.push('hydrology');
    begin(flood);
    runTicks(flood, 450);
    expect(promptOf(flood, 'dam_leak')).toBeUndefined();

    const crowded = stage(1);
    crowded.civ.pop = 30; // far more people than beds
    begin(crowded);
    runTicks(crowded, 450);
    expect(promptOf(crowded, 'refugees')).toBeUndefined();

    const housed = stage(1);
    createStructure(housed, 'stone_house', 8, 8, 0, 'active');
    createStructure(housed, 'stone_house', 12, 8, 0, 'active');
    begin(housed);
    runTicks(housed, 150);
    expect(promptOf(housed, 'refugees')).toBeDefined();
  });

  it('a dam leak exists only with a standing dam or levee, and leaving it weakens it', () => {
    const c = stage(1);
    const levee = createStructure(c, 'levee', 6, 6, 0, 'active');
    begin(c);
    runTicks(c, 210);
    const p = promptOf(c, 'dam_leak');
    expect(p).toBeDefined();
    runTicks(c, 160); // the deadline passes with no answer
    expect(p!.status).toBe('resolved');
    expect(p!.auto).toBe(true);
    expect(levee.status).toBe('damaged');
  });

  it('offers at most three per epoch, never in the last 15 seconds, and never in the planning phase', () => {
    const c = stage(1);
    createStructure(c, 'stone_house', 8, 8, 0, 'active');
    createStructure(c, 'stone_house', 12, 8, 0, 'active');
    createStructure(c, 'archive', 20, 4, 0, 'active');
    createStructure(c, 'levee', 6, 6, 0, 'active');
    expect(c.prompts).toHaveLength(0);
    begin(c);
    runTicks(c, 599);
    const mine = c.prompts.filter((p) => p.epoch === 1);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThanOrEqual(3);
    for (const p of mine) expect(p.openedTick).toBeLessThanOrEqual(450);
    const r = dispatchAction(stage(1), { type: 'choose', prompt: 1, option: 'ignore' });
    expect(r.ok).toBe(false);
  });
});

describe('choices change the end state', () => {
  it('clearing brush costs timber and shrinks the predicted burn', () => {
    const c = stage(0);
    firePath(c);
    begin(c);
    runTicks(c, 200);
    const p = promptOf(c, 'dry_wind')!;
    const timber = c.civ.res.timber;
    const burnBefore = resolveHazard(c).area;
    expect(dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'clear_brush' }).ok).toBe(true);
    runTicks(c, 1);
    expect(p.status).toBe('resolved');
    expect(p.chosen).toBe('clear_brush');
    expect(p.auto).toBe(false);
    expect(c.civ.res.timber).toBeLessThan(timber);
    expect(resolveHazard(c).area).toBeLessThanOrEqual(burnBefore);
    expect(p.outcome).toMatch(/cells/);
  });

  it('sandbagging raises flood resistance of homes near the hearth', () => {
    const c = stage(1);
    const house = createStructure(
      c,
      'cottage',
      c.world.anchors.hearth.x + 3,
      c.world.anchors.hearth.y,
      0,
      'active',
    );
    begin(c);
    runTicks(c, 260);
    const p = promptOf(c, 'river_rising')!;
    expect(p).toBeDefined();
    dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'sandbag' });
    runTicks(c, 1);
    expect(house.bonus.flood).toBeGreaterThan(0);
  });

  it('bracing the worst building in a foreshock reinforces it against the quake', () => {
    const c = stage(2);
    const e = c.world.anchors.quakeEpicenter;
    const archive = createStructure(c, 'archive', e.x + 1, e.y + 1, 0, 'active');
    begin(c);
    runTicks(c, 260);
    const p = promptOf(c, 'foreshock')!;
    expect(p).toBeDefined();
    const before = resolveHazard(c).impacts.find((i) => i.id === archive.id)!.damage;
    dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'brace_worst' });
    runTicks(c, 1);
    expect(archive.bonus.quake).toBeGreaterThan(0);
    expect(resolveHazard(c).impacts.find((i) => i.id === archive.id)!.damage).toBeLessThan(before);
  });

  it('welcoming refugees costs food and adds people and knowledge', () => {
    const c = stage(1);
    createStructure(c, 'stone_house', 8, 8, 0, 'active');
    createStructure(c, 'stone_house', 12, 8, 0, 'active');
    begin(c);
    runTicks(c, 120);
    const p = promptOf(c, 'refugees')!;
    const pop = c.civ.pop;
    const know = c.civ.res.knowledge;
    dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'welcome' });
    runTicks(c, 1);
    expect(c.civ.pop).toBe(pop + 3);
    expect(c.civ.res.knowledge).toBeGreaterThan(know);
  });
});

describe('fairness', () => {
  it('the default is always free: letting the deadline pass spends nothing', () => {
    const c = stage(0);
    firePath(c);
    createStructure(c, 'archive', 3, 3, 0, 'active');
    begin(c);
    runTicks(c, 400);
    // Every decision offered so far has a free default.
    expect(c.prompts.length).toBeGreaterThan(0);
    for (const q of c.prompts) {
      const free = q.options.find((o) => o.id === q.defaultOption)!;
      expect(free.cost ?? {}).toEqual({});
    }
    const p = promptOf(c, 'dry_wind')!;
    const cost = p.options.find((o) => o.id === p.defaultOption)!.cost;
    expect(cost ?? {}).toEqual({});
  });

  it('refuses an unaffordable option and a stale prompt, and leaves the decision open', () => {
    const c = stage(0);
    firePath(c);
    begin(c);
    runTicks(c, 200);
    const p = promptOf(c, 'dry_wind')!;
    c.civ.res.timber = 0;
    const poor = dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'clear_brush' });
    expect(poor.ok).toBe(false);
    if (!poor.ok) expect(poor.code).toBe('not_enough');
    const stale = dispatchAction(c, { type: 'choose', prompt: 999, option: 'ignore' });
    expect(stale.ok).toBe(false);
    const bogus = dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'summon_rain' });
    expect(bogus.ok).toBe(false);
    expect(p.status).toBe('open');
  });

  it('an answered decision cannot be answered twice', () => {
    const c = stage(0);
    firePath(c);
    begin(c);
    runTicks(c, 200);
    const p = promptOf(c, 'dry_wind')!;
    dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'gather_timber' });
    runTicks(c, 1);
    const again = dispatchAction(c, { type: 'choose', prompt: p.seq, option: 'gather_timber' });
    expect(again.ok).toBe(false);
  });

  it('survives save and load with an open decision, and the deadline still applies', () => {
    const c = stage(0);
    firePath(c);
    begin(c);
    runTicks(c, 200);
    expect(openPrompts(c)).toHaveLength(1);
    const loaded = deserialize(serialize(c));
    loaded.paused = false;
    expect(openPrompts(loaded)).toHaveLength(1);
    runTicks(loaded, 160);
    runTicks(c, 160);
    expect(openPrompts(loaded)).toHaveLength(0);
    expect(computeHash(loaded)).toBe(computeHash(c));
  });
});
