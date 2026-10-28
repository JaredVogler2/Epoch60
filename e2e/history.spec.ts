import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

const showHistory = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => (window as unknown as { __epoch: { store: { showHistory: boolean } } }).__epoch.store.showHistory,
  );

/**
 * Between ages the map shows what each age left (buildings and ruins by age, where each catastrophe reached, eroded
 * ground), with a legend that counts it; while planning an inherited age the same lens is a toggle (button or H).
 */
test('the history lens shows between ages and on request while planning', async ({ page }, info) => {
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as RecordedTranscript;
  const founds = t.actions.flatMap((a, i) => (a.action.type === 'found' ? [i] : []));
  const [k, k2] = [founds[0]!, founds[1]!];
  // Between the first and second ages: the lens is on; its legend counts the first age's works and the fire's reach.
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, k) });
  expect(await campaign(page, (c) => c.phase)).toBe('INTERREGNUM');
  const legend = page.getByTestId('interregnum').getByTestId('history-legend');
  await expect(legend.getByTestId('history-age-0')).toContainText('Age of Thatch: 2 standing, 6 ruins');
  await expect(legend.getByTestId('history-reach-0')).toContainText(
    'The Great Fire (age I) reached 372 cells',
  );
  await shot(page, info, 'history-between-ages');

  // Founded: planning the second age, the lens waits for the player.
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, k + 1) }, k);
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 1]);
  await expect(page.getByTestId('history-legend')).toHaveCount(0);
  const prepare = page.getByTestId('prepare');
  if (!(await page.getByTestId('toggle-history').isVisible()))
    await prepare.locator('.prepare-toggle').click();
  await page.getByTestId('toggle-history').click();
  expect(await showHistory(page)).toBe(true);
  await expect(prepare.getByTestId('history-age-0')).toBeVisible();
  await expect(prepare.getByTestId('history-age-1')).toContainText('Age of Bronze');
  await expect(prepare.getByTestId('history-reach-0')).toContainText(
    'The Great Fire (age I) reached 372 cells',
  );
  // The legend opens below the fold of the briefing card's scroll area, so it brings itself into view.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const body = document.querySelector('[data-testid="prepare"] .prepare-body')!.getBoundingClientRect();
        const legend = document
          .querySelector('[data-testid="prepare"] [data-testid="history-legend"]')!
          .getBoundingClientRect();
        return legend.top >= body.top - 1 && legend.bottom <= body.bottom + 1;
      }),
    )
    .toBe(true);
  await shot(page, info, 'history-planning');
  // H toggles it from the keyboard (desktop only: a hardware-keyboard path).
  if (info.project.name === 'desktop') {
    await page.locator('body').press('h');
    expect(await showHistory(page)).toBe(false);
  }

  // Between the second and third ages the flood's reach joins the fire's: read from its report, since the erosion it
  // left has faded below the eroded-ground mark.
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, k2) }, k + 1);
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['INTERREGNUM', 1]);
  const second = page.getByTestId('interregnum').getByTestId('history-legend');
  await expect(second.getByTestId('history-reach-1')).toContainText(
    'The Great Flood (age II) reached 493 cells',
  );
  await expect(second.getByTestId('history-eroded')).toContainText('18 cells of eroded ground');
  await shot(page, info, 'history-after-flood');
});
