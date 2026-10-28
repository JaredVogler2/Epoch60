import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  carryOf,
  replayCampaign,
  resolveHazard,
  runTicks,
  techRetentionCapacity,
} from '../../src/engine';
import type { Campaign, TechId, Transcript } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { stepStories } from '../../src/engine/events/story';
import { U, act, begin, fresh } from './helpers';

/** Fed, so the ages are about what they test, not starvation. */
function startFed(): Campaign {
  const c = fresh();
  begin(c);
  c.civ.res.food = 800 * U;
  return c;
}

function toInterregnum(c: Campaign): void {
  act(c, { type: 'continue' });
  act(c, { type: 'continue' });
  if (c.phase !== 'INTERREGNUM') throw new Error('expected interregnum, got ' + c.phase);
}

function found(c: Campaign): void {
  const r = act(c, { type: 'found', site: 0, tradition: c.lineage.interregnum!.traditions[0]!.id });
  if (!r.ok) throw new Error('found failed: ' + JSON.stringify(r));
}

/**
 * Regressions for the defects the Phase 19 adversarial review found in the engine (docs/ADVERSARIAL_REVIEW.md). Each
 * test fails on the code it replaced.
 */

const FIVE: TechId[] = ['masonry', 'irrigation', 'forestry', 'hydrology', 'bronze_tools'];

/** What the collapse should have let a people carry: one by memory, plus every carrier at the status it ended with. */
const capFromFinal = (c: Campaign) =>
  techRetentionCapacity(
    c,
    c.structures
      .filter((s) => BUILDINGS[s.kind].retains > 0)
      .map((s) => ({ kind: s.kind, status: s.status })),
  );

describe('what an Archive carries through a collapse', () => {
  it('a damaged Archive the catastrophe barely touches still carries half, never more than untouched', () => {
    const c = fresh();
    begin(c);
    c.civ.techs.push(...FIVE);
    const f = c.world.anchors.fireOrigin;
    // In the fire's path, already damaged, and nearly fireproof: reached, but barely harmed.
    const arc = createStructure(c, 'archive', f.x - 4, f.y - 1, 0, 'active');
    arc.status = 'damaged';
    arc.bonus.fire = 980;
    const hit = resolveHazard(c).impacts.find((i) => i.id === arc.id);
    expect(hit?.after).toBe('active');
    runTicks(c, 600);
    expect(arc.status).toBe('damaged');
    expect(c.report!.retainedTechs).toHaveLength(Math.min(FIVE.length, capFromFinal(c)));
    // (Counted at full strength, the damaged Archive alone would have carried all five.)
    expect(c.report!.retainedTechs.length).toBeLessThan(FIVE.length);
  });

  it('counts each carrier as the engine does: Writing helps Archives only, damaged ones carry half', () => {
    const c = fresh();
    expect(carryOf(c, 'hearth', 'active')).toBe(1);
    expect(carryOf(c, 'archive', 'active')).toBe(3);
    c.civ.techs.push('writing');
    expect(carryOf(c, 'hearth', 'active')).toBe(1);
    expect(carryOf(c, 'archive', 'active')).toBe(5);
    expect(carryOf(c, 'archive', 'damaged')).toBe(2);
    expect(carryOf(c, 'hearth', 'damaged')).toBe(0);
    expect(carryOf(c, 'archive', 'constructing')).toBe(0);
    expect(carryOf(c, 'archive', 'rubble')).toBe(0);
  });
});

describe('tablets in a ruin', () => {
  it('a restored Archive that falls again can be dug up again, and its new tablets are found', () => {
    const c = startFed();
    c.civ.techs.push(...FIVE);
    const f = c.world.anchors.fireOrigin;
    // An Archive restored from a ruin dug up in an earlier age, standing in the fire's path.
    const arc = createStructure(c, 'archive', f.x - 4, f.y - 1, 0, 'active');
    arc.excavated = true;
    arc.surveyed = true;
    arc.bonus.fire = -900;
    runTicks(c, 600);
    expect(arc.status).toBe('rubble');
    expect(arc.storedTechs.length).toBeGreaterThan(0);
    expect([arc.excavated, arc.surveyed]).toEqual([false, false]);
    toInterregnum(c);
    expect(act(c, { type: 'excavate', id: arc.id }).ok).toBe(true);
    expect(c.lineage.interregnum!.techs).toEqual(expect.arrayContaining(arc.storedTechs));
    found(c);
  });

  it('a restoration that falls before it is finished is not dug up twice for the same tablets', () => {
    const c = startFed();
    // Run to the last tick, then start restoring the dug-up Archive: still a site when the fire comes.
    runTicks(c, 599);
    const f = c.world.anchors.fireOrigin;
    const site = createStructure(c, 'archive', f.x - 4, f.y - 1, 0, 'constructing');
    site.excavated = true;
    site.storedTechs = ['masonry'];
    site.bonus.fire = -900;
    runTicks(c, 1);
    expect(site.status).toBe('rubble');
    expect(site.excavated).toBe(true);
    toInterregnum(c);
    expect(act(c, { type: 'excavate', id: site.id })).toMatchObject({ ok: false, code: 'already_done' });
  });
});

describe('story decisions', () => {
  it('never open in the last 15 s, so every default is applied before the catastrophe', () => {
    const c = fresh();
    begin(c);
    const f = c.world.anchors.fireOrigin;
    createStructure(c, 'cottage', f.x - 4, f.y - 1, 0, 'active');
    c.prompts = [];
    c.tick = 450;
    stepStories(c);
    expect(c.prompts).toEqual([]);
    c.tick = 440;
    stepStories(c);
    expect(c.prompts).toHaveLength(1);
    expect(c.prompts[0]!.deadlineTick).toBeLessThan(600);
  });

  it('in every recorded lineage, every decision opened before the last 15 s and was settled', () => {
    for (const dir of ['greenvale', 'ashen']) {
      for (const name of readdirSync(`fixtures/${dir}`).filter((n) => n.endsWith('.json'))) {
        const t = JSON.parse(readFileSync(`fixtures/${dir}/${name}`, 'utf8')) as Transcript;
        const c = replayCampaign(t);
        for (const p of c.prompts) {
          expect(p.openedTick, `${dir}/${name}: ${p.story}`).toBeLessThan(450);
          expect(p.status, `${dir}/${name}: ${p.story}`).not.toBe('open');
        }
      }
    }
  });
});
