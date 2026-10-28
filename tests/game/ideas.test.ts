import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEAT_IDS, replayCampaign } from '../../src/engine';
import type { Transcript } from '../../src/engine';
import type { CodexEntry } from '../../src/game/codex';
import { nextIdeas } from '../../src/ui/Codex';

const run = (name: string) =>
  replayCampaign(JSON.parse(readFileSync(`fixtures/${name}.json`, 'utf8')) as Transcript);
const everything: CodexEntry[] = FEAT_IDS.map((id) => ({
  id,
  at: '2026-10-27T00:00:00.000Z',
  seed: 1,
  scenario: 'greenvale',
  difficulty: 'normal',
}));

/** The ending names at least two concrete things to try next, taken from what this lineage actually lacked. */
describe('ideas for the next lineage', () => {
  it('a defeat on the conditions names exactly what was missing first', () => {
    // The builder ends with people to spare but no landmark and no knowledge.
    const ideas = nextIdeas(run('greenvale/builder'), []).map((i) => i.head);
    expect(ideas[0]).toBe('Keep a landmark from an earlier age');
    expect(ideas[1]).toBe('Carry more knowledge (0 of 3)');
    expect(ideas).toHaveLength(3);
  });

  it('a lineage that ran out of people is told to shelter first', () => {
    expect(nextIdeas(run('greenvale/noop'), [])[0]!.head).toBe('Shelter first');
  });

  it('a victory points at feats this device has not seen yet, never at ones it has', () => {
    const c = run('greenvale/engineers');
    const ideas = nextIdeas(c, []);
    expect(ideas.length).toBeGreaterThanOrEqual(2);
    expect(ideas.map((i) => i.head)).toContain('Three Kinds of Knowing');
    // Not an idea once it is in the Codex.
    const seen: CodexEntry[] = [{ ...everything[1]!, id: 'three_branches' }];
    expect(nextIdeas(c, seen).map((i) => i.head)).not.toContain('Three Kinds of Knowing');
  });

  it('a feat the scenario cannot give is never suggested', () => {
    // Unshaken needs the Great Quake, which The Ashen Winter does not have.
    const heads = (n: string) =>
      nextIdeas(
        run(n),
        everything.filter((e) => e.id !== 'quake_unshaken'),
      );
    expect(heads('ashen/engineers').map((i) => i.head)).not.toContain('Unshaken');
    expect(heads('greenvale/engineers').map((i) => i.head)).toContain('Unshaken');
  });

  it('with the whole Codex earned there is still somewhere new to go', () => {
    const ideas = nextIdeas(run('greenvale/engineers'), everything).map((i) => i.head);
    expect(ideas).toEqual(['Another valley: The Ashen Winter', 'Hard']);
  });
});
