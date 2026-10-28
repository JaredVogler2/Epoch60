import { expect, test } from '@playwright/test';
import { campaign, openGame, shot, startNewGame } from './helpers';

type SelectWindow = { __epoch: { store: { select: (id: number | null) => void } } };

/**
 * Every order given while planning takes one of the three opening slots, so the briefing lists every one (not only
 * builds and research, as it once did, leaving a reinforcement to use a slot unseen) and each can be withdrawn.
 */
test('every opening order is listed in the briefing, and withdrawing one frees its slot', async ({
  page,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  const hearth = await campaign(page, (c) => c.structures.find((s) => s.kind === 'hearth')!.id);
  const select = (id: number | null) =>
    page.evaluate((x) => (window as unknown as SelectWindow).__epoch.store.select(x), id);

  await select(hearth);
  // The inspector reads the engine's own figures: the hearth carries one technology, and every resistance is shown.
  await expect(page.getByTestId('insp-carries')).toContainText('Carries 1 technology through a collapse');
  await expect(page.getByTestId('insp-resist')).toContainText('% resistance');
  await shot(page, info, 'plans-inspector');
  await page.getByTestId('act-reinforce').click();
  // Ordered once, it is not offered twice.
  await expect(page.getByTestId('act-reinforce')).toHaveCount(0);
  await select(null);

  const briefing = page.getByTestId('prepare');
  if (
    !(await page
      .getByTestId('plan-item')
      .first()
      .isVisible()
      .catch(() => false))
  )
    await page.locator('.prepare-toggle').click();
  await expect(page.getByTestId('plan-item')).toHaveCount(1);
  await expect(page.getByTestId('plan-item')).toContainText('Reinforce the Hearth against fire');
  // Not only in the card but in sight: below the forecast it would otherwise be scrolled out of a phone's view.
  await expect(page.getByTestId('plan-item')).toBeInViewport();
  await expect(briefing).toContainText('Opening orders 1/3');
  await shot(page, info, 'plans-reinforce');

  await page.getByTestId('plan-item').getByRole('button', { name: 'Withdraw plan' }).click();
  await expect(page.getByTestId('plan-item')).toHaveCount(0);
  await expect(briefing).toContainText('Opening orders 0/3');
  expect(await campaign(page, (c) => c.queue.length)).toBe(0);
  await select(hearth);
  await expect(page.getByTestId('act-reinforce')).toBeVisible();
});
