import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASHEN,
  CHRONICLE_STEP_PM,
  CHRONICLE_YEARS,
  GREENVALE,
  MAX_AGES,
  MIN_FOUNDERS,
  TRADITIONS,
  canEndure,
  chronicleEnding,
  chronicleSeverityPm,
  effectiveResistance,
  chronicleOver,
  cloneCampaign,
  computeHash,
  deserialize,
  dispatchAction,
  epochSpec,
  nextEpochSpec,
  replayCampaign,
  resistanceOf,
  resolveHazard,
  serialize,
  transcriptOf,
} from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { playCampaign } from '../../src/engine/ai/bots';
import { ROUTES } from '../../src/engine/ai/routes';
import { avoidedAge } from '../../src/engine/ai/spots';

const load = (name: string) => JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;
const long = (scenario: string) => ({ scenario, endless: { rested: false } });

describe('the long chronicle: ages past the scenario’s last', () => {
  it('leaves the scenario’s own ages as authored and brings its catastrophes back in order, fiercer each time', () => {
    for (let e = 0; e < 3; e++) expect(epochSpec({ scenario: 'greenvale' }, e)).toBe(GREENVALE.epochs[e]);
    const g = long('greenvale');
    expect(epochSpec(g, 1)).toBe(GREENVALE.epochs[1]);
    // Carried on, the last authored age is followed by centuries, like any other; the authored spec is untouched.
    expect(epochSpec(g, 2).yearsAfter).toBe(CHRONICLE_YEARS);
    expect(GREENVALE.epochs[2]!.yearsAfter).toBe(0);
    const kinds = (scenario: string) =>
      Array.from({ length: MAX_AGES }, (_, e) => epochSpec(long(scenario), e).hazard.kind);
    expect(kinds('greenvale')).toEqual([
      'fire',
      'flood',
      'quake',
      'fire',
      'flood',
      'quake',
      'fire',
      'flood',
      'quake',
      'fire',
      'flood',
      'quake',
    ]);
    expect(kinds('ashen').slice(3, 6)).toEqual(['fire', 'flood', 'ash']);
    for (let e = 3; e < MAX_AGES; e++) {
      const base = GREENVALE.epochs[(e - 3) % 3]!.hazard.strength;
      expect(epochSpec(g, e).hazard.strength).toBe(
        Math.round((base * (1000 + CHRONICLE_STEP_PM * (e - 2))) / 1000),
      );
    }
    expect(epochSpec(g, 3).hazard.headline).toBe('The Second Great Fire');
    expect(epochSpec(g, 9).hazard.headline).toBe('The Fourth Great Fire');
    expect(epochSpec(g, 11).hazard.headline).toBe('The Fourth Great Quake');
    expect(epochSpec(long('ashen'), 5).hazard.headline).toBe('The Second Ashen Winter');
    expect(ASHEN.epochs[2]!.hazard.headline).toBe('The Ashen Winter');
    // Every later age has its own people, and the provisions of the age whose catastrophe returns.
    const later = Array.from({ length: MAX_AGES - 3 }, (_, k) => epochSpec(g, k + 3));
    expect(new Set(later.map((s) => s.name)).size).toBe(later.length);
    expect(later.map((s) => s.start)).toEqual(later.map((s) => GREENVALE.epochs[(s.index - 3) % 3]!.start));
    // They build in an architecture of their own, the Age of Spires (the render layer's fourth).
    expect(
      later.every((s) => s.ageName === 'Age of Spires' && s.age === 3 && s.yearsAfter === CHRONICLE_YEARS),
    ).toBe(true);
    // The next age: none after the last authored one unless carried on, and none after the twelfth.
    expect(nextEpochSpec({ scenario: 'greenvale', epoch: 2 })).toBeNull();
    expect(nextEpochSpec({ ...g, epoch: 2 })).toBe(epochSpec(g, 3));
    expect(nextEpochSpec({ ...g, epoch: MAX_AGES - 1 })).toBeNull();
  });

  it('is fiercer three ways in a later age: further, harder, and against weaker defences', () => {
    const c = replayCampaign(load('greenvale/archivists'));
    dispatchAction(c, { type: 'endure' });
    dispatchAction(c, { type: 'found', site: 0, tradition: c.lineage.interregnum!.traditions[0]!.id });
    expect([c.phase, c.epoch]).toEqual(['PREPARE', 3]);
    expect(chronicleSeverityPm(c)).toBe(1000 + CHRONICLE_STEP_PM);
    expect(chronicleSeverityPm({ ...c, epoch: MAX_AGES - 1 })).toBe(1000 + CHRONICLE_STEP_PM * 9);
    expect(chronicleSeverityPm({ ...c, epoch: 2 })).toBe(1000);
    expect(chronicleSeverityPm({ ...c, endless: undefined })).toBe(1000);
    // Every building's defences hold less against it: its resistance divided by the age's severity.
    const standing = c.structures.filter((s) => s.status === 'active');
    expect(standing.length).toBeGreaterThan(0);
    for (const s of standing) {
      expect(effectiveResistance(c, s, 'quake')).toBe(
        Math.round((resistanceOf(c, s, 'quake') * 1000) / 1100),
      );
      expect(effectiveResistance({ ...c, endless: undefined }, s, 'quake')).toBe(resistanceOf(c, s, 'quake'));
    }
    // The same quake on the same village: the same ground shakes, and every building reached comes off worse, as the
    // forecast's own words say (its resistance is the weakened one).
    const harder = resolveHazard(c, 'quake', 940);
    const plain = resolveHazard({ ...c, endless: undefined }, 'quake', 940);
    expect(harder.cells).toEqual(plain.cells);
    expect(harder.impacts.length).toBeGreaterThan(0);
    const before = (id: number) => plain.impacts.find((j) => j.id === id)!.damage;
    expect(harder.impacts.every((i) => i.damage >= before(i.id))).toBe(true);
    expect(harder.impacts.some((i) => i.damage > Math.round((before(i.id) * 1100) / 1000))).toBe(true);
    const first = harder.impacts[0]!;
    const s0 = c.structures.find((s) => s.id === first.id)!;
    expect(first.reason).toContain(`resistance ${Math.round(effectiveResistance(c, s0, 'quake') / 10)}%`);
    // The twelfth age's return can at most destroy a building: harm stays a permille.
    const fiercest = resolveHazard({ ...c, epoch: MAX_AGES - 1 }, 'fire', 400);
    expect(fiercest.impacts.some((i) => i.damage === 1000)).toBe(true);
    expect(fiercest.impacts.every((i) => i.damage <= 1000)).toBe(true);
  });

  it('points a policy’s foresight at the next return of each catastrophe it keeps clear of', () => {
    // In the scenario's own ages a policy's ages are the ones it names (none past them)...
    expect([0, 1, 2, 3].map((e) => avoidedAge({ epoch: 1 }, e, 3))).toEqual([0, 1, 2, null]);
    // ...and in the long chronicle, each catastrophe's next coming at or after this age, while there is one.
    const at = (epoch: number) =>
      [0, 1, 2].map((e) => avoidedAge({ epoch, endless: { rested: false } }, e, 3));
    expect(at(3)).toEqual([3, 4, 5]);
    expect(at(4)).toEqual([6, 4, 5]);
    expect(at(10)).toEqual([null, 10, 11]);
    expect(at(MAX_AGES - 1)).toEqual([null, null, 11]);
  });

  it('has a tradition to adopt at every founding up to the twelfth age', () => {
    // Each founding adopts one, never twice: the twelfth age's founding is the eleventh.
    expect(Object.keys(TRADITIONS).length).toBeGreaterThanOrEqual(MAX_AGES - 1);
  });

  it('carries a victory on: centuries pass, the fire returns fiercer, and the lineage replays exactly', () => {
    const c = replayCampaign(load('greenvale/archivists'));
    expect(c.phase).toBe('VICTORY');
    expect(canEndure(c)).toBe(true);
    expect(dispatchAction(c, { type: 'endure' }).ok).toBe(true);
    expect(c.endless).toEqual({ rested: false });
    expect(c.phase).toBe('INTERREGNUM');
    const inter = c.lineage.interregnum!;
    expect(inter.years).toBe(CHRONICLE_YEARS);
    expect(inter.sites.length).toBeGreaterThan(0);
    expect(inter.traditions.length).toBeGreaterThan(0);
    // Never twice, and only from a victory.
    expect(dispatchAction(c, { type: 'endure' }).ok).toBe(false);
    expect(canEndure(replayCampaign(load('greenvale/builder')))).toBe(false);
    const lost = replayCampaign(load('greenvale/builder'));
    expect(lost.phase).toBe('DEFEAT');
    expect(dispatchAction(lost, { type: 'endure' }).ok).toBe(false);

    const run = playCampaign(c, ROUTES.archivists!, { ages: 4 });
    expect(c.epoch).toBe(3);
    const r = c.lineage.reports.at(-1)!;
    expect(r.epoch).toBe(3);
    expect(r.hazard).toBe('fire');
    expect(r.hazardName).toBe('The Second Great Fire');
    // Not judged: the long chronicle's ages carry no verdict.
    expect(r.verdict).toBeNull();
    expect(run.epochs.map((e) => e.epoch)).toEqual([3]);
    expect(c.phase).toBe('VICTORY');
    const end = chronicleEnding(c)!;
    expect(end.ages).toBe(4);
    expect(end.how).toBe(c.endless!.rested ? 'rested' : 'fell');
    const t = transcriptOf(c);
    expect(t.actions.some((a) => a.action.type === 'endure')).toBe(true);
    expect(computeHash(replayCampaign(t))).toBe(t.finalHash);
    const back = deserialize(serialize(c));
    expect(computeHash(back)).toBe(computeHash(c));
  });

  it('rests only at the debrief of a later age, and ends by itself when too few survive or the last age passes', () => {
    // At the scenario's last debrief the verdict decides; there is nothing to rest yet.
    const t = load('greenvale/archivists');
    const capstone = replayCampaign({ ...t, actions: t.actions.slice(0, -1) });
    expect(capstone.phase).toBe('DEBRIEF');
    expect(dispatchAction(capstone, { type: 'rest' }).ok).toBe(false);

    const c = replayCampaign(t);
    dispatchAction(c, { type: 'endure' });
    expect(dispatchAction(c, { type: 'rest' }).ok).toBe(false); // between ages
    playCampaign(c, ROUTES.archivists!, { ages: 5, maxEpochs: 1 });
    expect(c.epoch).toBe(3);
    expect(c.phase).toBe('DEBRIEF');
    const at = (patch: (x: Campaign) => void) => {
      const x = cloneCampaign(c);
      patch(x);
      return x;
    };
    const fell = at((x) => {
      x.report!.survivors = MIN_FOUNDERS - 1;
      x.civ.pop = MIN_FOUNDERS - 1;
    });
    expect(chronicleOver(fell)).toBe(true);
    expect(chronicleEnding(fell)!.how).toBe('fell');
    expect(dispatchAction(fell, { type: 'rest' }).ok).toBe(false);
    expect(dispatchAction(fell, { type: 'continue' }).ok).toBe(true);
    expect(fell.phase).toBe('VICTORY');
    expect(fell.endless!.rested).toBe(false);

    const last = at((x) => {
      x.epoch = MAX_AGES - 1;
      x.report!.survivors = Math.max(x.report!.survivors, MIN_FOUNDERS);
    });
    expect(chronicleOver(last)).toBe(true);
    expect(chronicleEnding(last)!.how).toBe('complete');
    expect(chronicleEnding(last)!.title).toBe('The chronicle is complete');

    if (c.report!.survivors >= MIN_FOUNDERS) {
      expect(chronicleOver(c)).toBe(false);
      expect(chronicleEnding(c)).toBeNull();
      const rested = cloneCampaign(c);
      expect(dispatchAction(rested, { type: 'rest' }).ok).toBe(true);
      expect(rested.phase).toBe('VICTORY');
      expect(rested.endless).toEqual({ rested: true });
      expect(chronicleEnding(rested)).toMatchObject({ how: 'rested', ages: 4, title: 'The chronicle rests' });
      expect(dispatchAction(rested, { type: 'endure' }).ok).toBe(false);
      // Going on instead: the centuries pass again and the flood is next.
      expect(dispatchAction(c, { type: 'continue' }).ok).toBe(true);
      expect(c.phase).toBe('INTERREGNUM');
      expect(nextEpochSpec(c)!.hazard.kind).toBe('flood');
    }
  });

  it('saves a long chronicle and refuses one that is malformed, begun before the last age or past the twelfth', () => {
    const c = replayCampaign(load('greenvale/archivists'));
    dispatchAction(c, { type: 'endure' });
    playCampaign(c, ROUTES.archivists!, { ages: 5, maxEpochs: 1 });
    expect(c.epoch).toBe(3);
    expect(computeHash(deserialize(serialize(c)))).toBe(computeHash(c));
    const tampered = (patch: (x: Campaign) => void) => {
      const x = cloneCampaign(c);
      patch(x);
      return serialize(x);
    };
    expect(() => deserialize(tampered((x) => delete x.endless))).toThrow(/epoch out of range/);
    expect(() => deserialize(tampered((x) => (x.epoch = MAX_AGES)))).toThrow(/epoch out of range/);
    // A chronicle is only ever carried on from the scenario's last age.
    expect(() => deserialize(tampered((x) => (x.epoch = 1)))).toThrow(/long chronicle before the last age/);
    expect(() =>
      deserialize(tampered((x) => ((x as unknown as { endless: unknown }).endless = { rested: 'no' }))),
    ).toThrow(/malformed long chronicle/);
  });
});
