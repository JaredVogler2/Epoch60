import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeHash, createCampaign, replayCampaign, transcriptOf } from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { noopPolicy, playCampaign, randomPolicy, type Policy } from '../../src/engine/ai/bots';
import { ROUTES } from '../../src/engine/ai/routes';

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

function farthestApart(points: { x: number; y: number }[]): number {
  let d = 0;
  for (const a of points) for (const b of points) d = Math.max(d, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
  return d;
}

describe('executed Greenvale traces (seed 6001)', () => {
  const expected = {
    engineers: 'VICTORY',
    archivists: 'VICTORY',
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

  for (const name of ['engineers', 'archivists', 'builder'] as const) {
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
    expect(by['Heritage landmarks from an earlier age still standing']!.met).toBe(false);
    expect(by['Technologies carried through the collapse']!.met).toBe(false);
  });
});

describe('the two winning routes are mechanically distinct', () => {
  const eng = replayCampaign(fixture('engineers'));
  const arc = replayCampaign(fixture('archivists'));

  it('Engineers stay on the ancestral ground; Archivists relocate across the valley', () => {
    expect(farthestApart(hearths(eng))).toBeLessThanOrEqual(3);
    expect(farthestApart(hearths(arc))).toBeGreaterThanOrEqual(20);
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

  it('Engineers without Seismic Engineering lose their landmark and a technology', () => {
    const v = loses(without(ROUTES.engineers!, ['r-seismic']));
    expect(v.conditions.some((x) => !x.met)).toBe(true);
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

  for (const name of ['engineers', 'archivists'] as const) {
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
