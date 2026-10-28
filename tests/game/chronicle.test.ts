import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TECHS, replayCampaign } from '../../src/engine';
import type { Campaign, Transcript } from '../../src/engine';
import { chronicleOf, retell } from '../../src/ui/chronicle';

const archivists = (): Campaign =>
  replayCampaign(JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as Transcript);

describe('the chronicle of works tells what the engine recorded, and nothing else', () => {
  it('picks the most storied works: the keeper of knowledge first', () => {
    const c = archivists();
    const bios = chronicleOf(c);
    expect(bios.map((b) => b.title)).toEqual([
      'The Archive at (27,26)',
      'The Hearth at (17,16)',
      'The Quarry at (26,24)',
    ]);
  });

  it("retells every provenance line, naming ages instead of epoch numbers and dropping the building's address", () => {
    const c = archivists();
    for (const b of chronicleOf(c)) {
      const s = c.structures.find((x) => x.id === b.id)!;
      const founded = /^(The founders lit|Founded in)/.test(s.provenance[0]!);
      // Origin (unless its own first line says it) + one sentence per recorded event + knowledge kept + how it stands.
      expect(b.story).toHaveLength(
        (founded ? 0 : 1) + s.provenance.length + (s.storedTechs.length ? 1 : 0) + 1,
      );
      for (const line of b.story) {
        expect(line).not.toMatch(/epoch \d/);
        expect(line).not.toContain(' at (');
        expect(line.charAt(0)).toBe(line.charAt(0).toUpperCase());
      }
    }
    const archive = chronicleOf(c)[0]!;
    expect(archive.story).toEqual([
      'Raised by The Founders in the Age of Thatch.',
      'Survived The Great Fire.',
      'Untouched by The Great Flood.',
      'Weathered into disrepair over the centuries.',
      'The people of the Age of Iron set about restoring it.',
      'Untouched by The Great Quake.',
      `Knowledge kept here: ${['seismic_engineering', 'hydrology', 'masonry', 'writing'].map((t) => TECHS[t as keyof typeof TECHS].name).join(', ')}.`,
      'It stands.',
    ]);
    const quarry = chronicleOf(c)[2]!;
    expect(quarry.story).toContain('Damaged by The Great Fire, it stood.');
    expect(quarry.story).toContain(
      'Dug up by the people of the Age of Bronze: Cut blocks stacked beside the face, never hauled away.',
    );
    expect(quarry.story.filter((l) => / set about restoring it\.$/.test(l))).toHaveLength(2);
  });

  it('a building still being worked on when the end came is not called a ruin', () => {
    const c = archivists();
    const quarry = c.structures.find((x) => x.id === chronicleOf(c)[2]!.id)!;
    quarry.status = 'constructing';
    expect(chronicleOf(c)[2]!.story.at(-1)).toBe('The work on it was unfinished when the end came.');
  });

  it('a hearth tells its own founding, and a ruin how it lies', () => {
    const c = archivists();
    const hearth = chronicleOf(c)[1]!;
    expect(hearth.story[0]).toBe('The founders lit the first fire here.');
    expect(hearth.story.at(-1)).toBe('It lies buried.');
    const s = c.structures.find((x) => x.id === hearth.id)!;
    expect(
      retell(c, s, `Hearth at (17,16) was destroyed by The Great Fire. Its stone footings remain.`),
    ).toBe('Destroyed by The Great Fire. Its stone footings remain.');
  });
});
