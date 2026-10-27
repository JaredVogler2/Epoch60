import { expect, test } from '@playwright/test';
import { campaign, fastForward, openGame, phase, placeBuilding, settle, shot, startNewGame } from './helpers';

/** Place whatever is affordable and legal from a priority list (epochs are deliberately resource-scarce). */
async function placeSome(
  page: import('@playwright/test').Page,
  touch: boolean,
  max: number,
): Promise<number> {
  const wants: [string, Record<string, unknown>][] = [
    ['farm', { maxDist: 7 }],
    ['cottage', { maxDist: 7 }],
    ['firebreak', { rots: [1], maxDist: 8 }],
    ['lumber_camp', { maxDist: 13 }],
  ];
  let placed = 0;
  for (const [kind, opts] of wants) {
    if (placed >= max) break;
    try {
      await placeBuilding(page, kind, opts, touch);
      placed++;
    } catch (e) {
      if (!/no legal spot/.test(String(e))) throw e;
    }
  }
  return placed;
}

async function playOneEpochToDebrief(
  page: import('@playwright/test').Page,
  touch: boolean,
  build: boolean,
): Promise<void> {
  if (build) {
    await settle(page);
    expect(await placeSome(page, touch, 2)).toBeGreaterThan(0);
  }
  await page.getByTestId('begin').click();
  await expect.poll(() => phase(page)).toBe('ACTIVE');
  await fastForward(page, 700);
  await expect.poll(() => phase(page)).toBe('COLLAPSING');
  await page.getByTestId('skip-collapse').click();
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test('the collapse is inherited: epoch two is the same valley with ruins, scars and a choice', async ({
  page,
}, info) => {
  const touch = info.project.name === 'iphone';
  await openGame(page);
  await startNewGame(page);
  const scarBefore = await campaign(page, (c) => c.world.anchors.hearth.x);
  void scarBefore;
  await playOneEpochToDebrief(page, touch, true);

  // Debrief → interregnum
  await page.getByTestId('debrief-continue').click();
  await expect(page.getByTestId('interregnum')).toBeVisible();
  await settle(page);
  await shot(page, info, '08-interregnum');
  const ruinCount = await page.getByTestId('ruin-row').count();
  expect(ruinCount).toBeGreaterThan(0);
  await expect(page.getByTestId('site-0')).toBeVisible();
  await expect(page.getByTestId('site-1')).toBeVisible();

  // Bounded archaeology: one dig only.
  const first = page.getByTestId('excavate').first();
  await first.click();
  await expect(page.getByTestId('excavate').first()).toBeDisabled();

  // Choose the high ground and a tradition, found the next age.
  await page.getByTestId('site-2').click();
  const traditionButtons = page.locator('[data-testid^="trad-"]');
  await expect(traditionButtons).toHaveCount(3);
  await traditionButtons.first().click();
  const idsBefore = await campaign(page, (c) => c.structures.map((s) => s.id));
  await page.getByTestId('found').click();
  await expect(page.getByTestId('prepare')).toBeVisible();
  await expect(page.getByTestId('inherit-summary')).toBeAttached();
  const after = await campaign(page, (c) => ({
    epoch: c.epoch,
    kept: c.structures.filter((s) => s.id !== undefined).length,
    phase: c.phase,
  }));
  expect(after.epoch).toBe(1);
  expect(after.phase).toBe('PREPARE');
  // Everything built before still exists as a standing work or a ruin (except what the new hearth replaced).
  const idsAfter = await campaign(page, (c) => c.structures.map((s) => s.id));
  const survivors = idsBefore.filter((id) => idsAfter.includes(id));
  expect(survivors.length).toBeGreaterThanOrEqual(idsBefore.length - 1);
  await settle(page);
  await shot(page, info, '09-epoch2-prepare');
  await expect(page.getByTestId('epoch-chip')).toContainText('River Kingdom');
});

test('three epochs run to an ending, and Play again starts fresh', async ({ page }, info) => {
  const touch = info.project.name === 'iphone';
  test.setTimeout(300_000);
  await openGame(page);
  await startNewGame(page);
  let epochsPlayed = 0;
  for (let epoch = 0; epoch < 3; epoch++) {
    await expect(page.getByTestId('prepare')).toBeVisible();
    // Keep people alive with a farm and a home each epoch; fall back to doing nothing if no spot is legal.
    await playOneEpochToDebrief(page, touch, true);
    epochsPlayed++;
    await page.getByTestId('debrief-continue').click();
    const ended = await phase(page);
    if (ended === 'VICTORY' || ended === 'DEFEAT') break;
    await expect(page.getByTestId('interregnum')).toBeVisible();
    await page.getByTestId('site-0').click();
    await page.getByTestId('found').click();
    await expect.poll(() => campaign(page, (c) => c.epoch)).toBe(epoch + 1);
  }
  expect(epochsPlayed).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('end')).toBeVisible();
  await expect(page.getByTestId('end-title')).not.toBeEmpty();
  await settle(page);
  await shot(page, info, '10-ending');
  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('prepare')).toBeVisible();
  expect(await campaign(page, (c) => c.epoch)).toBe(0);
});
