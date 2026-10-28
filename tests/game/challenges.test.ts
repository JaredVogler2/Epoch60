import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATS, MODIFIERS, checkModifiers, createCampaign, dispatchAction, runTicks } from '../../src/engine';
import type { ModifierId } from '../../src/engine';
import {
  CHALLENGE_IDS,
  UNLOCKED_BY,
  challengeBlocked,
  expeditionFor,
  unlockedChallenges,
} from '../../src/game/challenges';
import type { CodexEntry } from '../../src/game/codex';
import { bestFor, cardOf, loadRuns, parseShare, shareQuery } from '../../src/game/modes';
import type { RunCard } from '../../src/game/modes';
import { GameStore } from '../../src/game/store';
import { chronicleOf } from '../../src/ui/chronicle';
import { ruinFacts } from '../../src/ui/ruins';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

afterEach(() => vi.unstubAllGlobals());

const entry = (id: CodexEntry['id']): CodexEntry => ({
  id,
  at: '2026-10-28T00:00:00.000Z',
  seed: 6001,
  scenario: 'greenvale',
  difficulty: 'normal',
});

describe('challenges open from the Codex', () => {
  it('each opens once the device has seen its feat, and only then', () => {
    expect(unlockedChallenges([]).size).toBe(0);
    expect([...unlockedChallenges([entry('archive_built')])]).toEqual(['buried_library']);
    const all = unlockedChallenges(Object.values(UNLOCKED_BY).map(entry));
    expect([...all]).toEqual(CHALLENGE_IDS);
    // Every challenge names a feat that exists.
    for (const id of CHALLENGE_IDS) expect(FEATS[UNLOCKED_BY[id]]).toBeDefined();
  });

  it('say why one cannot be added: locked, unsuited, clashing or one too many', () => {
    const open = new Set(CHALLENGE_IDS);
    expect(challengeBlocked('soft_rock', [], 'greenvale', new Set(), 3)).toBe('locked');
    expect(challengeBlocked('soft_rock', [], 'ashen', open, 3)).toBe('unsuited');
    expect(challengeBlocked('dry_summers', ['fertile_floodplain'], 'greenvale', open, 3)).toBe('clash');
    expect(challengeBlocked('fertile_floodplain', ['dry_summers'], 'greenvale', open, 3)).toBe('clash');
    expect(
      challengeBlocked(
        'buried_library',
        ['soft_rock', 'fractured_fault', 'overcrowded_refuge'],
        'greenvale',
        open,
        3,
      ),
    ).toBe('full');
    // A chosen one can always be taken off again.
    expect(challengeBlocked('soft_rock', ['soft_rock'], 'greenvale', new Set(), 3)).toBeNull();
    expect(challengeBlocked('soft_rock', [], 'greenvale', open, 3)).toBeNull();
  });
});

describe('expeditions', () => {
  it('draw one to three challenges from the open ones by the seed: the same seed, the same draw', () => {
    const all = new Set(CHALLENGE_IDS);
    expect(expeditionFor(7, 'greenvale', new Set())).toEqual([]);
    expect(expeditionFor(7, 'greenvale', all)).toEqual(expeditionFor(7, 'greenvale', all));
    const sizes = new Set<number>();
    const seen = new Set<ModifierId>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const scenario of ['greenvale', 'ashen']) {
        const drawn = expeditionFor(seed, scenario, all);
        sizes.add(drawn.length);
        drawn.forEach((m) => seen.add(m));
        // Always a set the engine accepts as written: canonical, suited, no clash, at most three.
        expect(checkModifiers(drawn, scenario)).toEqual({ ok: true, ids: drawn });
      }
    }
    expect([...sizes].sort()).toEqual([1, 2, 3]);
    expect(seen.size).toBe(CHALLENGE_IDS.length);
    // Only what is open is drawn.
    const two = new Set<ModifierId>(['blight', 'buried_library']);
    for (let seed = 1; seed <= 40; seed++)
      for (const m of expeditionFor(seed, 'greenvale', two)) expect(two.has(m)).toBe(true);
    expect(expeditionFor(3, 'ashen', new Set<ModifierId>(['soft_rock']))).toEqual([]);
  });
});

describe('challenges in links, run cards and rankings', () => {
  it('a share link carries them in canonical order; a bad or clashing set carries none', () => {
    const spec = {
      seed: 42,
      scenario: 'greenvale',
      difficulty: 'normal' as const,
      modifiers: ['soft_rock', 'buried_library'] as ModifierId[],
    };
    expect(shareQuery(spec)).toContain('mods=soft_rock%2Cburied_library');
    expect(parseShare(shareQuery(spec))).toEqual(spec);
    expect(parseShare('?seed=42&mods=buried_library,soft_rock').modifiers).toEqual([
      'soft_rock',
      'buried_library',
    ]);
    expect(parseShare('?seed=42&mods=soft_rock,tidal_wave').modifiers).toBeUndefined();
    expect(parseShare('?seed=42&mods=dry_summers,fertile_floodplain').modifiers).toBeUndefined();
    expect(parseShare('?seed=42&scenario=ashen&mods=soft_rock').modifiers).toBeUndefined();
    expect(parseShare('?seed=42&mods=__proto__').modifiers).toBeUndefined();
    expect(parseShare('?seed=42&mods=').modifiers).toBeUndefined();
    expect(shareQuery({ seed: 42, scenario: 'greenvale', difficulty: 'normal' })).not.toContain('mods');
  });

  it('a run card keeps them, and only runs with the same ones are compared', () => {
    const c = createCampaign(6001, 'standard', 'greenvale', 'normal', ['dry_summers']);
    dispatchAction(c, { type: 'beginEpoch' });
    runTicks(c, 600);
    dispatchAction(c, { type: 'continue' });
    dispatchAction(c, { type: 'continue' });
    const card = cardOf(c, undefined, new Date('2026-10-28T01:00:00Z'))!;
    expect(card.modifiers).toEqual(['dry_summers']);
    const plain: RunCard = { ...card, id: 'plain', modifiers: undefined, outcome: 'victory' };
    const spec = { seed: 6001, scenario: 'greenvale', difficulty: 'normal' as const };
    expect(bestFor([card, plain], spec)?.id).toBe('plain');
    expect(bestFor([card, plain], { ...spec, modifiers: ['dry_summers'] })?.id).toBe(card.id);
    expect(bestFor([card], { ...spec, modifiers: ['soft_rock'] })).toBeNull();
  });

  it('stored cards naming challenges this build cannot run are dropped', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const base = {
      id: 'x',
      seed: 1,
      scenario: 'greenvale',
      difficulty: 'normal',
      outcome: 'victory',
      survivors: 9,
      at: '2026-10-28T00:00:00.000Z',
    };
    localStorage.setItem(
      'epoch60.runs.v1',
      JSON.stringify([
        { ...base, id: 'ok', modifiers: ['soft_rock'] },
        { ...base, id: 'unknown', modifiers: ['tidal_wave'] },
        { ...base, id: 'empty', modifiers: [] },
        { ...base, id: 'order', modifiers: ['buried_library', 'soft_rock'] },
        { ...base, id: 'unsuited', scenario: 'ashen', modifiers: ['soft_rock'] },
        { ...base, id: 'none' },
      ]),
    );
    expect(loadRuns().map((r) => r.id)).toEqual(['ok', 'none']);
  });
});

describe('the store begins a lineage with its challenges', () => {
  it('as chosen, but never for the Daily Ruins, which are the same for everyone', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const s = new GameStore();
    s.newGame(77, undefined, 'greenvale', 'normal', undefined, ['buried_library', 'overcrowded_refuge']);
    expect(s.campaign!.modifiers).toEqual(['overcrowded_refuge', 'buried_library']);
    expect(s.campaign!.civ.pop).toBe(14);
    s.newGame(77, undefined, 'greenvale', 'normal', '2026-10-28', ['buried_library']);
    expect('modifiers' in s.campaign!).toBe(false);
    s.newGame(77);
    expect('modifiers' in s.campaign!).toBe(false);
  });

  it('every challenge has words for the picker and the briefing', () => {
    for (const d of Object.values(MODIFIERS)) {
      expect(d.name.length).toBeGreaterThan(3);
      expect(d.effects.every((e) => e.endsWith('.'))).toBe(true);
    }
  });
});

describe('the Buried Library tells its own story', () => {
  it('built before the founders, buried with its tablets: in the inspector and the chronicle', () => {
    const c = createCampaign(6001, 'standard', 'greenvale', 'normal', ['buried_library']);
    const lib = c.structures.find((x) => x.originEpoch < 0)!;
    expect(ruinFacts(c, lib).built).toBe('Built before the founders came, by a people no record names.');
    expect(ruinFacts(c, lib).fell).toBe('Abandoned, it crumbled with the centuries.');
    // Clearing it before it is dug up would lose the tablets, which the inspector says without saying what they are.
    expect(ruinFacts(c, lib).clear).toMatch(/ Any tablets still inside are lost with it\.$/);
    expect(ruinFacts(c, lib).clear).not.toContain('Writing');
    const bio = chronicleOf(c).find((b) => b.id === lib.id)!;
    expect(bio.story).toEqual([
      'Raised by a people who lived in the valley before the founders.',
      'Abandoned, it crumbled with the centuries.',
      'The river buried it in silt, its tablets sealed in clay.',
      'Knowledge kept here: Writing, Hydrology.',
      'It lies buried.',
    ]);
  });
});
