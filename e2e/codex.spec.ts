import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

const TOTAL = 20;
const feats = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __epoch: { store: { campaign: { lineage: { feats: { id: string }[] } } } } }
    ).__epoch.store.campaign.lineage.feats.map((f) => f.id),
  );

/**
 * The Codex shows only what was played: a new device has nothing; a recorded winning lineage, played through the
 * browser's own store, fills the debrief, the ending and the Codex with exactly the feats the engine recorded, and the
 * Codex survives a reload.
 */
test('the Codex holds exactly the feats a played lineage earned, and keeps them', async ({ page }, info) => {
  await openGame(page);
  await page.getByTestId('open-codex').click();
  await expect(page.getByTestId('codex-count')).toHaveText(`0 of ${TOTAL} feats recorded on this device`);
  await expect(page.locator('[data-earned="no"]')).toHaveCount(TOTAL);
  await expect(page.locator('[data-earned="yes"]')).toHaveCount(0);
  await shot(page, info, 'codex-empty');
  await page.getByTestId('title-codex').getByRole('button', { name: 'Back' }).click();

  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/engineers.json', 'utf8')) as RecordedTranscript;
  // Up to the first debrief: the feats of the Age of Thatch are listed there, all new to this device.
  const at = await replayTranscript(page, t, 0, 'DEBRIEF');
  await expect(page.getByTestId('debrief')).toBeVisible();
  const firstAge = await feats(page);
  expect(firstAge).toEqual(['archive_built', 'fire_contained']);
  await expect(page.getByTestId('debrief-feats').locator('li.fresh')).toHaveCount(firstAge.length);
  await expect(page.getByTestId('debrief-feats')).toContainText('The Fire Stopped Here');
  await shot(page, info, 'debrief-feats');

  await replayTranscript(page, t, at);
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('VICTORY');
  const earned = await feats(page);
  expect(earned.length).toBe(6);
  await expect(page.getByTestId('end')).toBeVisible();
  await expect(page.getByTestId('atlas-age')).toHaveCount(3);
  await expect(page.getByTestId('atlas')).toContainText('The Great Fire');
  await expect(page.getByTestId('end-feats').locator('li')).toHaveCount(earned.length);
  await expect(page.getByTestId('end-codex-count')).toHaveText(`· Codex ${earned.length}/${TOTAL}`);
  expect(await page.getByTestId('next-ideas').locator('li').count()).toBeGreaterThanOrEqual(2);
  await shot(page, info, 'end-atlas');

  await page.getByTestId('end').getByRole('button', { name: 'Title' }).click();
  await page.getByTestId('open-codex').click();
  await expect(page.getByTestId('codex-count')).toHaveText(
    `${earned.length} of ${TOTAL} feats recorded on this device`,
  );
  await expect(page.locator('[data-earned="yes"]')).toHaveCount(earned.length);
  for (const id of earned) await expect(page.getByTestId(`feat-${id}`)).toHaveAttribute('data-earned', 'yes');
  await shot(page, info, 'codex-earned');

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await page.getByTestId('open-codex').click();
  await expect(page.locator('[data-earned="yes"]')).toHaveCount(earned.length);
});
