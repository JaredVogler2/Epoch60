import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FEATS,
  FEAT_IDS,
  SCENARIOS,
  checkPlacement,
  computeHash,
  createCampaign,
  deserialize,
  dispatchAction,
  replayCampaign,
  resolveHazard,
  runTicks,
  serialize,
} from '../../src/engine';
import type { Campaign, Structure, Transcript } from '../../src/engine';
import { featsOnCollapse, featsOnCompleted, featsOnExcavated } from '../../src/engine/legacy/feats';

const load = (name: string): Transcript =>
  JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript;

/**
 * What every recorded run earns, in the order earned, as `feat@epoch` (fixtures/feats.md). The route fixtures come from
 * scripts/record-traces.ts, the feats/ runs from scripts/record-feats.ts. A changed list is a changed game: re-read it.
 */
const EXPECTED: Record<string, string[]> = {
  'greenvale/archivists': [
    'archive_built@0',
    'old_foundations@1',
    'every_field@1',
    'quake_unshaken@2',
    'perfect_age@2',
    'living_heritage@2',
    'cycle_broken@2',
  ],
  'greenvale/builder': ['old_foundations@1'],
  'greenvale/engineers': [
    'archive_built@0',
    'fire_contained@0',
    'old_foundations@1',
    'hearth_kept@2',
    'quake_unshaken@2',
    'cycle_broken@2',
  ],
  'greenvale/noop': [],
  'ashen/archivists': [
    'archive_built@0',
    'old_foundations@2',
    'winter_fed@2',
    'living_heritage@2',
    'cycle_broken@2',
  ],
  'ashen/builder': ['old_foundations@1'],
  'ashen/engineers': [
    'archive_built@0',
    'fire_contained@0',
    'old_foundations@1',
    'hearth_kept@2',
    'winter_fed@2',
    'cycle_broken@2',
  ],
  'ashen/steward': ['archive_built@2', 'living_heritage@2'],
  'feats/archivists-hard': [
    'archive_built@0',
    'old_foundations@1',
    'every_field@1',
    'quake_unshaken@2',
    'perfect_age@2',
    'living_heritage@2',
    'cycle_broken@2',
    'hard_won@2',
  ],
  'feats/dam': [
    'archive_built@0',
    'old_foundations@1',
    'river_works@1',
    'every_field@1',
    'reinforced_stood@1',
    'quake_unshaken@2',
    'perfect_age@2',
    'living_heritage@2',
    'cycle_broken@2',
  ],
  'feats/fallen-archive': [
    'archive_built@0',
    'grandparents_library@1',
    'old_foundations@2',
    'quake_unshaken@2',
    'perfect_age@2',
    'living_heritage@2',
    'cycle_broken@2',
  ],
  'feats/levees-and-grove': [
    'archive_built@0',
    'old_foundations@1',
    'forest_returns@1',
    'flood_held@1',
    'every_field@1',
    'reinforced_stood@1',
    'quake_unshaken@2',
    'perfect_age@2',
    'living_heritage@2',
    'cycle_broken@2',
  ],
  'feats/recipe-vault': [
    'archive_built@0',
    'three_branches@1',
    'quake_unshaken@2',
    'perfect_age@2',
    'cycle_broken@2',
    'light_footprint@2',
  ],
};

const replays = new Map<string, Campaign>();
function replay(name: string): Campaign {
  let c = replays.get(name);
  if (!c) {
    c = replayCampaign(load(name));
    replays.set(name, c);
  }
  return c;
}
const ids = (c: Campaign) => c.lineage.feats.map((f) => f.id);

describe('feats', () => {
  it('defines at least sixteen feats, each with its rule and its lesson', () => {
    expect(FEAT_IDS.length).toBeGreaterThanOrEqual(16);
    for (const id of FEAT_IDS) {
      const d = FEATS[id];
      expect(d.id).toBe(id);
      expect(d.name.length).toBeGreaterThan(3);
      expect(d.how.endsWith('.') || d.how.endsWith(')')).toBe(true);
      expect(d.lesson.length).toBeGreaterThan(20);
      for (const s of d.scenarios ?? []) expect(Object.keys(SCENARIOS)).toContain(s);
    }
    expect(new Set(FEAT_IDS.map((id) => FEATS[id].name)).size).toBe(FEAT_IDS.length);
  });

  for (const [name, want] of Object.entries(EXPECTED)) {
    it(`${name} replays to exactly its recorded feats`, () => {
      const t = load(name);
      const c = replay(name);
      expect(computeHash(c)).toBe(t.finalHash);
      expect(c.lineage.feats.map((f) => `${f.id}@${f.epoch}`)).toEqual(want);
    });
  }

  it('every feat is earned by at least one recorded run (each is attainable)', () => {
    const earned = new Set(Object.keys(EXPECTED).flatMap((n) => ids(replay(n))));
    expect(FEAT_IDS.filter((id) => !earned.has(id))).toEqual([]);
  });

  it('a lineage that does nothing earns nothing', () => {
    expect(ids(replay('greenvale/noop'))).toEqual([]);
    expect(ids(createCampaign(6001))).toEqual([]);
  });

  it('a catastrophe that never reaches the village proves nothing about how it was built', () => {
    // The builder's last village stands entirely outside the quake: no damage, but no "Unshaken" or "Age Without Loss".
    const c = replay('greenvale/builder');
    const quake = c.lineage.reports[2]!;
    expect(quake.hazard).toBe('quake');
    expect(quake.result.impacts).toEqual([]);
    expect(quake.deaths + quake.structuresLost + quake.structuresDamaged).toBe(0);
    expect(ids(c)).not.toContain('quake_unshaken');
    expect(ids(c)).not.toContain('perfect_age');
  });

  it('a win that ordered a quarry is not light on the land; a win on Normal is not hard-won', () => {
    const c = replay('greenvale/archivists');
    expect(c.phase).toBe('VICTORY');
    expect(c.actionLog.some((a) => a.action.type === 'build' && a.action.kind === 'quarry')).toBe(true);
    expect(ids(c)).not.toContain('light_footprint');
    expect(ids(c)).not.toContain('hard_won');
  });

  it('a quarry plan withdrawn before the age began does not count as ordering one', () => {
    const t = load('feats/recipe-vault');
    const fresh = createCampaign(t.seed, t.mode, t.scenario, t.difficulty);
    let site: { x: number; y: number } | null = null;
    for (let y = 0; y < fresh.world.h && !site; y++)
      for (let x = 0; x < fresh.world.w && !site; x++)
        if (checkPlacement(fresh, 'quarry', x, y, 0).ok) site = { x, y };
    expect(site).not.toBeNull();
    // Plan a quarry (the first logged action, seq 1), withdraw it, then play the recorded winning lineage.
    const plan = {
      tick: 0,
      seq: 1,
      epoch: 0,
      action: { type: 'build' as const, kind: 'quarry' as const, rot: 0 as const, ...site! },
    };
    const withdraw = { tick: 0, seq: 2, epoch: 0, action: { type: 'unplan' as const, seq: 1 } };
    const c = replayCampaign({ ...t, actions: [plan, withdraw, ...t.actions] });
    expect(c.actionLog[0]!.action).toEqual(plan.action);
    expect(c.actionLog[1]!.action).toEqual(withdraw.action);
    expect(c.phase).toBe('VICTORY');
    expect(ids(c)).toContain('light_footprint');
  });

  it('a story decision that braces a building is not the player reinforcing it', () => {
    // The Engineers sandbag their houses before the flood (a story decision) and reinforce a stone house against the
    // quake that the quake never reaches: neither is "Shored Up".
    const c = replay('greenvale/engineers');
    expect(c.prompts.length + c.lineage.reports.length).toBeGreaterThan(0);
    expect(c.actionLog.some((a) => a.action.type === 'reinforce')).toBe(true);
    expect(ids(c)).not.toContain('reinforced_stood');
  });

  it('each feat is awarded once per lineage', () => {
    for (const name of Object.keys(EXPECTED)) {
      const list = ids(replay(name));
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('a save naming a feat this build does not know loads without it, never crashing on it', () => {
    const c = createCampaign(6001);
    c.lineage.feats = [
      { id: 'archive_built', epoch: 0 },
      { id: 'tamed_the_comet' as never, epoch: 0 },
    ];
    // Written by another build: its own hash is valid, but one record names a feat unknown here.
    expect(deserialize(serialize(c)).lineage.feats).toEqual([{ id: 'archive_built', epoch: 0 }]);
  });

  it('a save written before feats existed loads with none', () => {
    const c = createCampaign(6001);
    const old = structuredClone(c) as unknown as { lineage: Record<string, unknown> };
    delete old.lineage.feats;
    const loaded = deserialize(serialize(old as unknown as Campaign));
    expect(loaded.lineage.feats).toEqual([]);
  });
});

/** The edges of single rules, exercised on real recorded states through the same hooks the engine calls. */
describe('feat rules at their edges', () => {
  const fresh = () => {
    const c = structuredClone(replay('feats/levees-and-grove'));
    c.lineage.feats = [];
    return c;
  };

  it("only the player's own reinforcement counts, not the same bonus from a story decision", () => {
    const flood = replay('feats/levees-and-grove').lineage.reports[1]!;
    const award = (stripReinforce: boolean) => {
      const c = fresh();
      if (stripReinforce) c.actionLog = c.actionLog.filter((a) => a.action.type !== 'reinforce');
      featsOnCollapse(c, flood, null);
      return ids(c);
    };
    expect(award(false)).toContain('reinforced_stood');
    // The bonus stays on the building; without the order in the log it is no longer the player's doing.
    expect(award(true)).not.toContain('reinforced_stood');
  });

  it("the grandparents' library is two ages older than its finders, and must still hold tablets", () => {
    const archive = replay('feats/fallen-archive').structures.find(
      (s) => s.kind === 'archive' && s.originEpoch === 0 && s.excavated,
    )!;
    const dig = (epochNow: number, origin: number, techs: Structure['storedTechs']) => {
      const c = fresh();
      c.epoch = epochNow;
      featsOnExcavated(c, { ...archive, originEpoch: origin }, techs);
      return ids(c);
    };
    expect(dig(1, 0, ['writing'])).toContain('grandparents_library'); // built in age I, dug before age III
    expect(dig(0, 0, ['writing'])).not.toContain('grandparents_library'); // dug right after its own age
    expect(dig(1, 1, ['writing'])).not.toContain('grandparents_library');
    expect(dig(1, 0, [])).not.toContain('grandparents_library');
  });

  it('a grove counts only on ground the fire burned', () => {
    const grove = replay('feats/levees-and-grove').structures.find((s) => s.kind === 'grove')!;
    const plant = (scar: number) => {
      const c = fresh();
      for (let j = 0; j < grove.h; j++)
        for (let i = 0; i < grove.w; i++) c.world.scar[(grove.y + j) * c.world.w + grove.x + i] = 0;
      c.world.scar[grove.y * c.world.w + grove.x] = scar;
      featsOnCompleted(c, grove);
      return ids(c);
    };
    expect(plant(0)).not.toContain('forest_returns');
    expect(plant(99)).not.toContain('forest_returns');
    expect(plant(100)).toContain('forest_returns');
  });

  it('only an excavated ruin from an earlier age counts as restored', () => {
    const restored = replay('greenvale/archivists').structures.find((s) => s.excavated && s.repairs > 0)!;
    const finish = (patch: Partial<Structure>) => {
      const c = fresh();
      c.epoch = 1;
      featsOnCompleted(c, { ...restored, ...patch });
      return ids(c);
    };
    expect(finish({ originEpoch: 0 })).toContain('old_foundations');
    // A damaged building mended (never a ruin, never dug up) is a repair, not a restoration.
    expect(finish({ originEpoch: 0, excavated: false })).not.toContain('old_foundations');
  });

  it('a whole field means at least two farms standing after the flood', () => {
    const flood = replay('feats/levees-and-grove').lineage.reports[1]!;
    const keep = (n: number) => {
      const c = fresh();
      const farms = c.structures.filter(
        (s) => s.kind === 'farm' && (s.status === 'active' || s.status === 'damaged'),
      );
      expect(farms.length).toBeGreaterThanOrEqual(2);
      farms.slice(n).forEach((s) => (s.status = 'rubble'));
      featsOnCollapse(c, flood, null);
      return ids(c);
    };
    expect(keep(2)).toContain('every_field');
    expect(keep(1)).not.toContain('every_field');
  });

  it('the river is held only where the levees and dams spared a building harm the water would have done', () => {
    // The levees-and-grove run one tick before its flood: the flood as it comes, and the same flood undefended.
    const t = load('feats/levees-and-grove');
    const k = t.actions.findIndex((a) => a.epoch === 1 && a.tick >= 600);
    const c = replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
    runTicks(c, 599 - c.tick);
    expect([c.phase, c.epoch, c.tick]).toEqual(['ACTIVE', 1, 599]);
    const defended = resolveHazard(c, 'flood');
    const undefended = resolveHazard(
      { ...c, structures: c.structures.filter((s) => s.kind !== 'levee' && s.kind !== 'dam') },
      'flood',
    );
    expect(undefended.impacts.length).toBeGreaterThan(defended.impacts.length);
    const flood = replay('feats/levees-and-grove').lineage.reports[1]!;
    const award = (u: typeof undefended | null) => {
      const x = fresh();
      featsOnCollapse(x, flood, null, u);
      return ids(x);
    };
    expect(award(undefended)).toContain('flood_held');
    // A building the water still reached, but less hard than it would have with no levee or dam, was spared harm too.
    const hit = flood.result.impacts[0]!;
    expect(award({ ...flood.result, impacts: [{ ...hit, damage: hit.damage + 50 }] })).toContain(
      'flood_held',
    );
    // Defences that changed nothing, or a flood that could never have reached anyone, hold nothing back.
    expect(award(defended)).not.toContain('flood_held');
    expect(award({ ...undefended, impacts: [] })).not.toContain('flood_held');
    expect(award(null)).not.toContain('flood_held');
  });

  it('a third branch of knowledge dug up between ages counts when the next age is founded', () => {
    const t = load('greenvale/archivists');
    const k = t.actions.findIndex((a) => a.action.type === 'found');
    const c = replayCampaign({ ...t, actions: t.actions.slice(0, k), totalTicks: 0 });
    expect(c.phase).toBe('INTERREGNUM');
    c.lineage.feats = [];
    // Industry and ecology from research; resilience only on the tablets the dig recovered.
    c.lineage.everKnown = ['masonry', 'forestry'];
    c.report!.retainedTechs = [];
    c.lineage.interregnum!.techs = ['writing'];
    expect(dispatchAction(c, t.actions[k]!.action).ok).toBe(true);
    expect(c.phase).toBe('PREPARE');
    expect(c.lineage.feats).toContainEqual({ id: 'three_branches', epoch: 1 });
  });
});
