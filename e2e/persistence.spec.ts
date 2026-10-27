import { expect, test } from '@playwright/test';
import { campaign, fastForward, openGame, phase, placeBuilding, settle, startNewGame } from './helpers';

test('backgrounding the tab freezes the clock; nothing is simulated while away', async ({ page }, info) => {
  const touch = info.project.name === 'iphone';
  await openGame(page);
  await startNewGame(page);
  await placeBuilding(page, 'cottage', { maxDist: 8 }, touch);
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.tick), { timeout: 15000 }).toBeGreaterThan(5);

  // Simulate the page being hidden (phone call / app switch): visibilitychange with document.hidden = true.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  const frozen = await campaign(page, (c) => ({ tick: c.tick, res: c.civ.res, paused: c.paused }));
  expect(frozen.paused).toBe(true);
  await page.waitForTimeout(2500);
  const later = await campaign(page, (c) => ({ tick: c.tick, res: c.civ.res }));
  expect(later.tick).toBe(frozen.tick);
  expect(later.res).toEqual(frozen.res);

  // Coming back does NOT auto-resume or fast-forward: the player taps Resume.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  expect((await campaign(page, (c) => c.tick)) === frozen.tick).toBe(true);
  await page.getByTestId('resume').click();
  await expect.poll(() => campaign(page, (c) => c.tick), { timeout: 15000 }).toBeGreaterThan(frozen.tick);
});

test('reloading mid-epoch resumes paused at the exact tick, and the catastrophe happens once', async ({
  page,
}, info) => {
  const touch = info.project.name === 'iphone';
  await openGame(page);
  await startNewGame(page);
  await placeBuilding(page, 'farm', { maxDist: 8 }, touch);
  await page.getByTestId('begin').click();
  await expect.poll(() => phase(page)).toBe('ACTIVE');
  await fastForward(page, 314); // 28.6 s left
  await page.getByTestId('pause').click();
  const before = await campaign(page, (c) => ({
    tick: c.tick,
    food: c.civ.res.food,
    timber: c.civ.res.timber,
    pop: c.civ.pop,
    structures: c.structures.map((s) => `${s.id}:${s.kind}:${s.status}`),
  }));
  expect(before.tick).toBeGreaterThanOrEqual(314);

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await expect(page.getByTestId('title')).toBeVisible();
  await expect(page.getByTestId('continue')).toBeEnabled();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await expect(page.getByTestId('pause-overlay')).toContainText(/Welcome back/);
  await settle(page);
  const after = await campaign(page, (c) => ({
    tick: c.tick,
    food: c.civ.res.food,
    timber: c.civ.res.timber,
    pop: c.civ.pop,
    structures: c.structures.map((s) => `${s.id}:${s.kind}:${s.status}`),
    paused: c.paused,
  }));
  expect(after.paused).toBe(true);
  expect(after).toMatchObject(before);

  // Resume, run out the epoch: exactly one collapse report, tick never exceeds 600.
  await page.getByTestId('resume').click();
  await fastForward(page, 400);
  await expect.poll(() => phase(page)).toBe('COLLAPSING');
  expect(await campaign(page, (c) => c.tick)).toBe(600);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __epoch: { store: { campaign: { lineage: { reports: unknown[] } } } } })
          .__epoch.store.campaign.lineage.reports.length,
    ),
  ).toBe(1);
});

test('navigating between title and game never leaves duplicate canvases', async ({ page }) => {
  await openGame(page);
  expect(await page.locator('canvas').count()).toBe(1);
  await startNewGame(page);
  expect(await page.locator('canvas').count()).toBe(1);
  await page.evaluate(() =>
    (window as unknown as { __epoch: { store: { quitToTitle: () => void } } }).__epoch.store.quitToTitle(),
  );
  await expect(page.getByTestId('title')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(1);
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(1);
});
