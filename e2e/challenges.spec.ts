import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { URL, openGame, settle, shot } from './helpers';

type Lib = { id: number; kind: string; status: string; x: number; y: number; w: number; h: number };
type ChallengeWindow = {
  __epoch: {
    store: {
      select: (id: number | null) => void;
      focusOn: (x: number, y: number, zoom?: number) => void;
      campaign: {
        modifiers?: string[];
        civ: { pop: number };
        structures: (Lib & { originEpoch: number })[];
      };
    };
  };
};
const run = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as ChallengeWindow).__epoch.store.campaign;
    return {
      modifiers: c.modifiers,
      pop: c.civ.pop,
      lib: c.structures.find((s) => s.originEpoch < 0) ?? null,
    };
  });
const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
const entry = (id: string) => ({
  id,
  at: '2026-10-28T00:00:00.000Z',
  seed: 6001,
  scenario: 'greenvale',
  difficulty: 'normal',
});

/**
 * Challenges open from the Codex: a new device sees all twelve, none open. Once it has seen the feats that open two of them,
 * they can be chosen, the lineage begins with them (fourteen people, a buried library in the valley), the briefing lists
 * them, and the library tells its own story.
 */
test('challenges open from the Codex, begin a lineage that has them, and are listed on the briefing', async ({
  page,
}, info) => {
  await openGame(page);
  const summary = page.getByTestId('challenges-summary');
  await expect(summary).toHaveText('none · 0 of 12 open');
  await page.getByTestId('challenges').locator('summary').click();
  const library = page.getByTestId('challenge-buried_library');
  await expect(library).toHaveAttribute('aria-disabled', 'true');
  await expect(library).toContainText('Opens when you earn “Words Kept”');
  // A locked challenge is announced as disabled; pressing it anyway changes nothing.
  await library.click({ force: true });
  await expect(library).toHaveAttribute('aria-checked', 'false');

  await page.evaluate(
    (codex) => localStorage.setItem('epoch60.codex.v1', codex),
    JSON.stringify([entry('archive_built'), entry('cycle_broken')]),
  );
  await page.reload();
  await ready(page);
  await expect(summary).toHaveText('none · 2 of 12 open');
  await page.getByTestId('challenges').locator('summary').click();
  await library.click();
  await page.getByTestId('challenge-overcrowded_refuge').click();
  await expect(summary).toHaveText('Overcrowded Refuge · Buried Library');
  await expect(page.getByTestId('challenge-effects').locator('li')).toHaveCount(4);
  await expect(page.getByTestId('challenge-soft_rock')).toHaveAttribute('aria-disabled', 'true');
  await shot(page, info, 'challenges-title');

  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  const c = await run(page);
  expect(c.modifiers).toEqual(['overcrowded_refuge', 'buried_library']);
  expect(c.pop).toBe(14);
  expect(c.lib).toMatchObject({ kind: 'archive', status: 'buried' });
  const brief = page.getByTestId('challenge-brief');
  if (!(await brief.isVisible())) await page.locator('.prepare-toggle').click();
  await expect(brief).toContainText('Overcrowded Refuge');
  await expect(brief).toContainText('Buried Library');
  await shot(page, info, 'challenges-brief');

  // The library in the valley, and its inspector.
  const lib = c.lib!;
  await page.evaluate((l) => {
    const s = (window as unknown as ChallengeWindow).__epoch.store;
    s.focusOn(l.x + l.w / 2, l.y + l.h / 2, 18);
    s.select(l.id);
  }, lib);
  await settle(page);
  await expect(page.getByTestId('ruin-built')).toContainText(
    'Built before the founders came, by a people no record names.',
  );
  await expect(page.getByTestId('ruin-fell')).toContainText('crumbled with the centuries');
  await shot(page, info, 'challenges-library');
});

test('a shared link brings its challenges, even ones this device has not opened; a bad set brings none', async ({
  page,
}) => {
  await page.goto(`${URL}&seed=42&mods=soft_rock`);
  await ready(page);
  await expect(page.getByTestId('challenges-summary')).toHaveText('Soft Rock');
  await expect(page.getByTestId('challenge-soft_rock')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect((await run(page)).modifiers).toEqual(['soft_rock']);

  await page.goto(`${URL}&seed=42&mods=dry_summers,fertile_floodplain`);
  await ready(page);
  await expect(page.getByTestId('challenges-summary')).toHaveText('none · 0 of 12 open');
});

test('an expedition is a random valley with challenges drawn from those open', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('challenges').locator('summary').click();
  await expect(page.getByTestId('expedition')).toBeDisabled();
  await page.evaluate(
    (codex) => localStorage.setItem('epoch60.codex.v1', codex),
    JSON.stringify([entry('archive_built'), entry('cycle_broken')]),
  );
  await page.reload();
  await ready(page);
  await page.getByTestId('challenges').locator('summary').click();
  await page.getByTestId('expedition').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  const c = await run(page);
  expect(c.modifiers?.length).toBeGreaterThanOrEqual(1);
  for (const m of c.modifiers!) expect(['overcrowded_refuge', 'buried_library']).toContain(m);
  const brief = page.getByTestId('challenge-brief');
  if (!(await brief.isVisible())) await page.locator('.prepare-toggle').click();
  await expect(brief.locator('li')).toHaveCount(c.modifiers!.length);
});
