import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNIT, dispatchAction, repairCost, replayCampaign, runTicks } from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { createStructure } from '../../src/engine/economy/structures';
import { ruinFacts } from '../../src/ui/ruins';

/** The Archivists' recorded lineage, stopped as the second age is founded: the first age lies in ruins around it. */
function ageTwo(): Campaign {
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as Transcript;
  const k = t.actions.findIndex((a) => a.action.type === 'found');
  const c = replayCampaign({ ...t, actions: t.actions.slice(0, k + 1), totalTicks: 0 });
  expect(c.phase).toBe('PREPARE');
  expect(c.epoch).toBe(1);
  return c;
}
const ruin = (c: Campaign, id: number) => c.structures.find((s) => s.id === id)!;

describe('pressing a ruin tells its story and what it is worth now', () => {
  it('names the age and people that built it, and what it was for', () => {
    const c = ageTwo();
    const f = ruinFacts(c, ruin(c, 4));
    expect(f.built).toBe('Built in the Age of Thatch by The Founders (age I).');
    expect(f.purpose).toBe(BUILDINGS.lumber_camp.blurb);
  });

  it('says how it fell: destroyed outright, or broken by a catastrophe and finished by the centuries', () => {
    const c = ageTwo();
    expect(ruinFacts(c, ruin(c, 4)).fell).toBe(
      'Lumber Camp at (18,25) was destroyed by The Great Fire. Little but charred footings remain.',
    );
    expect(ruinFacts(c, ruin(c, 1)).fell).toBe(
      'Hearth at (17,16) was damaged by The Great Fire but stands. Hearth at (17,16) crumbled with the centuries.',
    );
  });

  it('clearing gives exactly the salvage it states', () => {
    for (const id of [4, 7]) {
      // The same opening tick with and without the order: the difference is what clearing gave.
      const cleared = ageTwo();
      const kept = ageTwo();
      const s = ruin(cleared, id);
      const f = ruinFacts(cleared, s);
      expect(dispatchAction(cleared, { type: 'demolish', id }).ok).toBe(true);
      for (const c of [cleared, kept]) {
        dispatchAction(c, { type: 'beginEpoch' });
        runTicks(c, 1);
      }
      const gained = cleared.civ.res.timber - kept.civ.res.timber;
      expect(gained).toBe(s.salvage.timber);
      expect(cleared.structures.some((x) => x.id === id)).toBe(false);
      expect(f.clear).toContain(gained < UNIT ? 'less than 1 timber' : `${Math.floor(gained / UNIT)} timber`);
    }
  });

  it('restoring charges exactly the cost it states and brings the building back to work', () => {
    const restored = ageTwo();
    const kept = ageTwo();
    const quarry = ruin(restored, 5);
    expect(quarry.excavated).toBe(true);
    const cost = repairCost(quarry);
    expect(ruinFacts(restored, quarry).restore).toBe(
      `Restoring it costs ${Math.ceil(cost.timber / UNIT)} timber; builders finish the last 65% and it works again as a Quarry.`,
    );
    expect(dispatchAction(restored, { type: 'repair', id: 5 }).ok).toBe(true);
    for (const c of [restored, kept]) {
      dispatchAction(c, { type: 'beginEpoch' });
      runTicks(c, 1);
    }
    expect(kept.civ.res.timber - restored.civ.res.timber).toBe(cost.timber);
    // Ordered at 35% done (the builders' first tick is already in): at most 65% of the work is left.
    const full = BUILDINGS.quarry.buildWork * 1000;
    expect(quarry.status).toBe('constructing');
    expect(quarry.progress).toBeGreaterThanOrEqual(full * 0.35);
    expect(quarry.progress).toBeLessThan(full);
    for (let i = 0; i < 60 && quarry.status !== 'active'; i++) runTicks(restored, 10);
    expect(quarry.status).toBe('active');
  });

  it('says plainly what cannot be restored, and why', () => {
    const c = ageTwo();
    // The Archivists' Seed Vault stands, so a second one's ruin could not be restored now: the text says so.
    const hearth = c.structures.find((s) => s.kind === 'hearth' && s.status === 'active')!;
    const second = createStructure(c, 'seed_vault', hearth.x + 3, hearth.y + 3, 0, 'rubble');
    second.originEpoch = 0;
    second.excavated = true;
    expect(ruinFacts(c, second).restore).toContain('Not now: limit 1 reached.');
    expect(dispatchAction(c, { type: 'repair', id: second.id })).toMatchObject({
      ok: false,
      code: 'limit_reached',
    });
    expect(ruinFacts(c, ruin(c, 1)).restore).toContain('An old hearth cannot be relit');
    expect(ruinFacts(c, ruin(c, 4)).restore).toBe('To restore it, excavate it first between ages.');
    expect(ruinFacts(c, ruin(c, 7)).restore).toBe(
      'Thatch rots: nothing of it can be restored, only cleared.',
    );
  });

  it('a restored landmark from an earlier age is one: the text and the victory rule agree', () => {
    const c = ageTwo();
    c.civ.res = { food: 90 * UNIT, timber: 90 * UNIT, stone: 90 * UNIT, knowledge: 0 };
    const hearth = c.structures.find((s) => s.kind === 'hearth' && s.status === 'active')!;
    // A Bridge from the first age, dug up between ages (the Seed Vault would be refused: the Archivists' own stands).
    const vault = createStructure(c, 'bridge', hearth.x + 3, hearth.y + 3, 0, 'rubble');
    vault.originEpoch = 0;
    vault.excavated = true;
    expect(ruinFacts(c, vault).restore).toContain('counts as a landmark from an earlier age');
    expect(ruinFacts(c, vault).restore).not.toContain('Not now');
    expect(ruinFacts(c, ruin(c, 5)).restore).not.toContain('landmark');
    expect(dispatchAction(c, { type: 'repair', id: vault.id }).ok).toBe(true);
    dispatchAction(c, { type: 'beginEpoch' });
    for (let i = 0; i < 60 && vault.status !== 'active'; i++) runTicks(c, 10);
    expect(vault.status).toBe('active');
    // The verdict counts heritage buildings standing whose origin is an earlier age.
    const landmarks = c.structures.filter(
      (s) => BUILDINGS[s.kind].heritage && s.status === 'active' && s.originEpoch < c.epoch,
    );
    expect(landmarks.map((s) => s.id)).toContain(vault.id);
  });
});
