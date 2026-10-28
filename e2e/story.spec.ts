import { expect, test } from '@playwright/test';
import { campaign, fastForward, openGame, placeBuilding, startNewGame } from './helpers';

/** A village the forecast genuinely threatens. */
async function threatenedVillage(page: import('@playwright/test').Page, touch: boolean) {
  await openGame(page);
  await startNewGame(page);
  // Even the bare hearth is in the fire's path, so any small village is genuinely threatened.
  await placeBuilding(page, 'cottage', { maxDist: 8 }, touch);
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
}

test('a decision arises from the forecast, can be answered with a tap, and changes the village', async ({
  page,
}, info) => {
  const touch = info.project.name === 'iphone';
  await threatenedVillage(page, touch);
  await expect(page.getByTestId('story-chip')).toHaveCount(0);
  await fastForward(page, 176);
  const chip = page.getByTestId('story-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('data-story', 'dry_wind');
  await expect(page.getByTestId('story-option-ignore')).toBeVisible();
  const before = await campaign(page, (c) => c.civ.res.timber);
  await page.getByTestId('story-option-clear_brush').click();
  await expect(chip).toHaveCount(0);
  const after = await campaign(
    page,
    (c) =>
      (
        c as unknown as {
          prompts: { story: string; chosen: string; status: string; auto: boolean; outcome: string }[];
        }
      ).prompts[0],
  );
  expect(after).toMatchObject({ story: 'dry_wind', chosen: 'clear_brush', status: 'resolved', auto: false });
  expect(await campaign(page, (c) => c.civ.res.timber)).toBeLessThan(before);
  // The toast reports what the clearing measurably did to the forecast — never "shrank by 0".
  await expect(page.getByTestId('toast')).toContainText(after!.outcome);
  await expect(page.getByTestId('toast')).not.toContainText('shrank by 0');
});

test('an unanswered decision never blocks play: its free default applies at the deadline', async ({
  page,
}, info) => {
  const touch = info.project.name === 'iphone';
  await threatenedVillage(page, touch);
  await fastForward(page, 176);
  await expect(page.getByTestId('story-chip')).toBeVisible();
  const timber = await campaign(page, (c) => c.civ.res.timber);
  await fastForward(page, 160);
  await expect(page.getByTestId('story-chip')).toHaveCount(0);
  const p = await campaign(
    page,
    (c) =>
      (c as unknown as { prompts: { chosen: string; auto: boolean; defaultOption: string }[] }).prompts[0],
  );
  expect(p).toMatchObject({ chosen: 'ignore', auto: true });
  // Production continued meanwhile and nothing was spent.
  expect(await campaign(page, (c) => c.civ.res.timber)).toBeGreaterThanOrEqual(timber);
});
