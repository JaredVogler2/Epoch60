import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  computeHash,
  createCampaign,
  LANDMARK_LABEL,
  replayCampaign,
  transcriptOf,
} from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { noopPolicy, playCampaign, randomPolicy, type Policy } from '../../src/engine/ai/bots';
import { minimalRecipe, ROUTES } from '../../src/engine/ai/routes';
import { isStanding } from '../../src/engine/economy/modifiers';

const SEED = 6001;
const TIMEOUT = 120_000;

function fixture(name: string, dir = 'greenvale'): Transcript {
  return JSON.parse(readFileSync(`fixtures/${dir}/${name}.json`, 'utf8')) as Transcript;
}

function play(p: Policy, seed = SEED, scenario = 'greenvale'): Campaign {
  const c = createCampaign(seed, 'standard', scenario);
  playCampaign(c, p);
  return c;
}

function without(p: Policy, ids: string[]): Policy {
  return {
    ...p,
    name: `${p.name}-without-${ids.join('+')}`,
    wants: (c) => p.wants(c).filter((w) => !ids.includes(w.id)),
  };
}

const hearths = (c: Campaign) =>
  c.structures.filter((s) => s.kind === 'hearth').map((s) => ({ x: s.x, y: s.y, epoch: s.originEpoch }));

const everBuilt = (c: Campaign) => new Set(c.structures.map((s) => s.kind));

/** The landmarks the verdict counted: heritage buildings from an earlier age still standing at the end. */
const landmarks = (c: Campaign) =>
  c.structures
    .filter((s) => BUILDINGS[s.kind].heritage && isStanding(s) && s.originEpoch < c.epoch)
    .map((s) => s.kind);

function farthestApart(points: { x: number; y: number }[]): number {
  let d = 0;
  for (const a of points) for (const b of points) d = Math.max(d, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
  return d;
}

describe('executed Greenvale traces (seed 6001)', () => {
  const expected = {
    engineers: 'VICTORY',
    archivists: 'VICTORY',
    ecologists: 'VICTORY',
    builder: 'DEFEAT',
    noop: 'DEFEAT',
  } as const;

  for (const [name, phase] of Object.entries(expected)) {
    it(`${name}: the recorded transcript replays to ${phase} with the recorded hash`, () => {
      const t = fixture(name);
      expect(t.seed).toBe(SEED);
      const c = replayCampaign(t);
      expect(c.phase).toBe(phase);
      expect(computeHash(c)).toBe(t.finalHash);
    });
  }

  for (const name of ['engineers', 'archivists', 'ecologists', 'builder'] as const) {
    it(
      `${name}: the policy still produces exactly the recorded transcript`,
      () => {
        const t = fixture(name);
        const live = transcriptOf(play(ROUTES[name]!));
        expect(live.finalHash).toBe(t.finalHash);
        expect(live.actions).toEqual(t.actions);
      },
      TIMEOUT,
    );
  }

  it('no action at all is a quick, credible loss: the fire leaves too few to begin again', () => {
    const c = replayCampaign(fixture('noop'));
    expect(c.lineage.reports).toHaveLength(1);
    expect(c.report?.verdict?.outcome).toBe('defeat');
    expect(c.report!.survivors).toBeLessThan(3);
  });

  it('a thriving village that never researches or plans a landmark still loses', () => {
    const c = replayCampaign(fixture('builder'));
    const v = c.report!.verdict!;
    const by = Object.fromEntries(v.conditions.map((x) => [x.label, x]));
    expect(by['Surviving people']!.met).toBe(true);
    expect(by[LANDMARK_LABEL]!.met).toBe(false);
    expect(by['Technologies carried through the collapse']!.met).toBe(false);
  });
});

describe('the two winning routes are mechanically distinct', () => {
  const eng = replayCampaign(fixture('engineers'));
  const arc = replayCampaign(fixture('archivists'));

  it('Engineers move above the flood once and keep that hearth; Archivists relocate across the valley every age', () => {
    expect(hearths(eng)).toHaveLength(2);
    expect(farthestApart(hearths(arc))).toBeGreaterThanOrEqual(20);
    // What each one carries to the end as its landmark: a hearth kept since the second age, or a seed vault.
    expect(landmarks(eng)).toEqual(['hearth']);
    expect(eng.structures.find((s) => s.kind === 'hearth' && isStanding(s))!.originEpoch).toBe(1);
    expect(landmarks(arc)).toEqual(['seed_vault']);
  });

  it('Engineers win with stonework and bracing; Archivists win with vaults, archives and research', () => {
    expect(everBuilt(eng).has('retaining_wall')).toBe(true);
    expect(everBuilt(eng).has('stone_house')).toBe(true);
    expect(everBuilt(eng).has('seed_vault')).toBe(false);
    expect(everBuilt(arc).has('seed_vault')).toBe(true);
    expect(everBuilt(arc).has('retaining_wall')).toBe(false);
    expect(arc.structures.filter((s) => s.kind === 'archive')).toHaveLength(2);
    expect(eng.structures.filter((s) => s.kind === 'archive')).toHaveLength(1);
  });

  it('they learn different things: only the Engineers can name Seismic Engineering as the lever', () => {
    const lastTechs = (c: Campaign) => c.lineage.reports.at(-1)!.retainedTechs;
    expect(lastTechs(eng)).toContain('seismic_engineering');
    expect(lastTechs(arc)).toContain('hydrology');
    expect(lastTechs(eng)).not.toContain('hydrology');
  });

  it('their temperaments show in how they answer story decisions', () => {
    const answers = (c: Campaign) =>
      c.actionLog.flatMap((a) => (a.action.type === 'choose' ? [a.action.option] : []));
    const e = answers(eng);
    const a = answers(arc);
    expect(e).toContain('clear_brush');
    expect(e).toContain('sandbag');
    expect(a).toContain('gather_timber');
    expect(a).toContain('harvest_early');
    expect(e).not.toContain('harvest_early');
    expect(a).not.toContain('sandbag');
  });

  it('both reach every victory condition through the engine rather than a special case', () => {
    for (const c of [eng, arc]) {
      const v = c.report!.verdict!;
      expect(v.outcome).toBe('victory');
      expect(v.conditions.every((x) => x.met)).toBe(true);
    }
  });
});

describe('each route depends on its own mechanism (ablations)', () => {
  const loses = (p: Policy) => {
    const c = play(p);
    expect(c.phase).toBe('DEFEAT');
    return c.report!.verdict!;
  };

  it('Engineers without Seismic Engineering lose a technology to the quake', () => {
    const v = loses(without(ROUTES.engineers!, ['r-seismic']));
    expect(v.conditions.find((x) => x.label.startsWith('Technologies'))!.met).toBe(false);
  });

  it('Engineers who stay on the valley floor lose their hearth to the flood, and with it their landmark', () => {
    const v = loses({ ...ROUTES.engineers!, site: () => 0 });
    expect(v.conditions.find((x) => x.label === LANDMARK_LABEL)!.met).toBe(false);
  });

  it('Engineers without an Archive carry nothing across the collapses', () => {
    const v = loses(without(ROUTES.engineers!, ['archive']));
    expect(v.conditions.find((x) => x.label.startsWith('Technologies'))!.met).toBe(false);
  });

  it('Archivists without any research arrive with no knowledge', () => {
    const v = loses(without(ROUTES.archivists!, ['r-writing', 'r-masonry', 'r-hydro', 'r-seismic']));
    expect(v.conditions.find((x) => x.label.startsWith('Technologies'))!.met).toBe(false);
  });

  it('Archivists without an Archive have nowhere to keep it', () => {
    const v = loses(without(ROUTES.archivists!, ['archive']));
    expect(v.conditions.find((x) => x.label.startsWith('Technologies'))!.met).toBe(false);
  });

  it('Archivists without the Seed Vault keep their knowledge but no landmark', () => {
    const v = loses(without(ROUTES.archivists!, ['vault']));
    expect(v.conditions.find((x) => x.label.startsWith('Technologies'))!.met).toBe(true);
    expect(v.conditions.find((x) => x.label === LANDMARK_LABEL)!.met).toBe(false);
  });
});

/**
 * K-003: under rules 0.3.0 one Archive sited away from the later hazards won Greenvale/Normal on 40 of 40 seeds,
 * because it was both the landmark and the knowledge store. An Archive is no longer a landmark, so winning takes two
 * separate preparations: knowledge kept in an Archive, and a landmark kept through the collapses.
 */
describe('one well-sited Archive is not enough (K-003)', () => {
  it(
    'the Archive alone keeps the knowledge but leaves no landmark: defeat on every seed tried',
    () => {
      for (const seed of [SEED, 1, 2, 3]) {
        const c = play(minimalRecipe('none'), seed);
        expect(c.phase, `seed ${seed}`).toBe('DEFEAT');
        const by = Object.fromEntries(c.report!.verdict!.conditions.map((x) => [x.label, x.met]));
        expect(by['Technologies carried through the collapse'], `seed ${seed}`).toBe(true);
        expect(by[LANDMARK_LABEL], `seed ${seed}`).toBe(false);
      }
    },
    TIMEOUT,
  );

  it(
    'a second preparation is what wins: a Seed Vault out of harm, or a hearth founded above the flood and kept',
    () => {
      const withVault = play(minimalRecipe('vault'));
      expect(withVault.phase).toBe('VICTORY');
      expect(landmarks(withVault)).toEqual(['seed_vault']);
      const held = play(minimalRecipe('hold'));
      expect(held.phase).toBe('VICTORY');
      expect(landmarks(held)).toEqual(['hearth']);
    },
    TIMEOUT,
  );
});

describe('random play does not win', () => {
  it('twelve different random policies on the canonical seed: none reaches victory', () => {
    let wins = 0;
    for (let i = 1; i <= 12; i++) if (play(randomPolicy(i)).phase === 'VICTORY') wins++;
    expect(wins).toBe(0);
  });

  it('the do-nothing baseline never survives the first fire', () => {
    expect(play(noopPolicy).phase).toBe('DEFEAT');
  });
});

describe('executed traces: The Ashen Winter (second scenario, fourth disaster)', () => {
  const expected = {
    engineers: 'VICTORY',
    archivists: 'VICTORY',
    ecologists: 'VICTORY',
    builder: 'DEFEAT',
    steward: 'DEFEAT',
  } as const;
  for (const [name, phase] of Object.entries(expected)) {
    it(`${name}: the recorded transcript replays to ${phase} with the recorded hash`, () => {
      const t = fixture(name, 'ashen');
      expect(t.scenario).toBe('ashen');
      const c = replayCampaign(t);
      expect(c.phase).toBe(phase);
      expect(computeHash(c)).toBe(t.finalHash);
    });
  }

  for (const name of ['engineers', 'archivists', 'ecologists'] as const) {
    it(
      `${name}: the policy still produces exactly the recorded ashen transcript`,
      () => {
        const t = fixture(name, 'ashen');
        const live = transcriptOf(play(ROUTES[name]!, SEED, 'ashen'));
        expect(live.finalHash).toBe(t.finalHash);
      },
      TIMEOUT,
    );
  }

  it('the winter is decided by the larder: Engineers without a Granary starve and lose', () => {
    const c = play(without(ROUTES.engineers!, ['granary']), SEED, 'ashen');
    expect(c.phase).toBe('DEFEAT');
    const people = c.report!.verdict!.conditions.find((x) => x.label === 'Surviving people')!;
    expect(people.met).toBe(false);
    expect(c.report!.causes.join(' ')).toMatch(/starved|put by/);
  });

  it('a steward who ignores roofs and larders is buried by the ash', () => {
    const c = replayCampaign(fixture('steward', 'ashen'));
    expect(c.report!.hazard).toBe('ash');
    expect(c.report!.survivors).toBeLessThan(8);
  });
});

/**
 * Route C, the Ecologists: a farming people who learn the ecology branch. In The Ashen Winter their fields are their
 * defence — no Granary, only the harvest they have put by — and the same plan with one field an age starves. On
 * Greenvale their fields decide nothing the verdict counts (K-027); that is pinned here too, so it cannot be forgotten.
 */
describe('a third route: the Ecologists live off their fields', () => {
  const eco = replayCampaign(fixture('ecologists', 'ashen'));
  const eng = replayCampaign(fixture('engineers', 'ashen'));
  const oneField = (p: Policy): Policy => ({
    ...p,
    name: `${p.name}-one-field`,
    wants: (c) => p.wants(c).map((w) => (w.id === 'farm' ? { ...w, count: 1 } : w)),
  });

  it('they come through the ash winter on what their fields put by, without a Granary', () => {
    expect(eco.phase).toBe('VICTORY');
    expect(eco.report!.hazard).toBe('ash');
    expect(eco.lineage.feats.map((f) => f.id)).toContain('winter_fed');
    expect(everBuilt(eco).has('granary')).toBe(false);
    expect(everBuilt(eng).has('granary')).toBe(true);
  });

  it('they raise none of the engineering works and carry the whole ecology branch to the end', () => {
    for (const k of ['granary', 'levee', 'dam', 'retaining_wall', 'firebreak', 'stone_house'] as const)
      expect(everBuilt(eco).has(k), k).toBe(false);
    const techs = eco.lineage.reports.at(-1)!.retainedTechs;
    expect(techs).toEqual(expect.arrayContaining(['irrigation', 'forestry', 'crop_rotation']));
    expect(eng.lineage.reports.at(-1)!.retainedTechs).not.toContain('crop_rotation');
    expect(landmarks(eco)).toEqual(['seed_vault']);
    const farms = (c: Campaign) => c.structures.filter((s) => s.kind === 'farm').length;
    expect(farms(eco)).toBeGreaterThan(farms(eng));
  });

  it(
    'with one field an age the same plan starves in the winter and loses',
    () => {
      const c = play(oneField(ROUTES.ecologists!), SEED, 'ashen');
      expect(c.phase).toBe('DEFEAT');
      expect(c.report!.verdict!.conditions.find((x) => x.label === 'Surviving people')!.met).toBe(false);
      expect(c.report!.causes.join(' ')).toMatch(/starved in the ash winter/);
    },
    TIMEOUT,
  );

  it(
    'K-027: on Greenvale the fields decide nothing the verdict counts — one field an age wins as well',
    () => {
      expect(replayCampaign(fixture('ecologists')).phase).toBe('VICTORY');
      expect(play(oneField(ROUTES.ecologists!)).phase).toBe('VICTORY');
    },
    TIMEOUT,
  );
});
