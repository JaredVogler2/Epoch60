import { expect, test } from '@playwright/test';
import { campaign, openGame } from './helpers';

type W = Window & { __ctxs?: number; AudioContext?: unknown };

test('audio starts only after a gesture, uses a single context, and the mute choice persists', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as W;
    w.__ctxs = 0;
    const Real = w.AudioContext as new () => unknown;
    w.AudioContext = function () {
      (w.__ctxs as number)++;
      return new Real();
    } as unknown;
  });
  await openGame(page);
  expect(await page.evaluate(() => (window as unknown as W).__ctxs)).toBe(0);

  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  // many more gestures: still one context
  await page.getByTestId('toggle-forecast').click();
  await page.getByTestId('toggle-forecast').click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as unknown as W).__ctxs)).toBe(1);

  await page.getByTestId('toggle-sound').click();
  await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-pressed', 'true');
  const saved = await page.evaluate(() => localStorage.getItem('epoch60.settings.v1'));
  expect(JSON.parse(saved!)).toMatchObject({ sound: false });

  // Pausing frees the hardware too: the page keeps its single context.
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as W).__ctxs)).toBe(1);

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-pressed', 'true');
});

test('the title settings expose sound and independent music / effects volume', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('setting-sound')).toBeChecked();
  await page.getByTestId('setting-music').fill('0.2');
  await page.getByTestId('setting-sfx').fill('0.9');
  const saved = await page.evaluate(() => localStorage.getItem('epoch60.settings.v1'));
  expect(JSON.parse(saved!)).toMatchObject({ musicVolume: 0.2, sfxVolume: 0.9 });
  await page.getByTestId('setting-sound').uncheck();
  const off = await page.evaluate(() => localStorage.getItem('epoch60.settings.v1'));
  expect(JSON.parse(off!)).toMatchObject({ sound: false });
});
