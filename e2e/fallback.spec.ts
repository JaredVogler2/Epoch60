import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { URL, campaign, openGame, startNewGame } from './helpers';

/**
 * Phase 18's "load errors report a helpful fallback rather than a blank WebGL canvas": a browser that cannot give the
 * game a WebGL context (turned off, or the graphics driver blocklisted) gets a page that says what is wrong and how to
 * fix it, and the game does not try to draw at all.
 */
test('a browser without WebGL is told what is wrong and how to fix it, never shown a blank page', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      return /webgl/i.test(type) ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as unknown as typeof get;
  });
  await page.goto(URL);
  const card = page.getByTestId('no-webgl');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('role', 'alert');
  await expect(card.getByRole('heading')).toHaveText('The valley needs 3D graphics');
  await expect(card).toContainText('Turning on hardware acceleration');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('title')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-no-webgl.png` });
});

/**
 * When the 3D scene cannot start although the browser has WebGL (here: the game's own canvas is refused a context,
 * while the browser's capability checks still pass), the error screen offers a reload, a backup of the saved lineage,
 * and a fresh start that asks once more before it erases anything.
 */
test('when the 3D scene cannot start, the error screen offers a reload, a backup and a confirmed fresh start', async ({
  page,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await page.evaluate(() =>
    (window as unknown as { __epoch: { store: { quitToTitle: () => void } } }).__epoch.store.quitToTitle(),
  );
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      return /webgl/i.test(type) && this.isConnected
        ? null
        : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as unknown as typeof get;
  });
  await page.reload();
  const fatal = page.getByTestId('fatal');
  await expect(fatal).toBeVisible();
  await expect(fatal.getByRole('heading')).toHaveText('The valley could not be drawn');
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-fatal.png` });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('fatal-export').click(),
  ]);
  const file = info.outputPath('backup.json');
  await download.saveAs(file);
  const b = JSON.parse(readFileSync(file, 'utf8')) as { lineage?: { save: string } };
  expect(typeof b.lineage?.save).toBe('string');

  const saved = () => page.evaluate(() => localStorage.getItem('epoch60.save.v1'));
  await page.getByTestId('fatal-fresh').click();
  await expect(page.getByTestId('fatal-erase')).toBeVisible();
  expect(await saved()).not.toBeNull();
  await page.getByTestId('fatal-erase').click();
  await expect.poll(saved).toBeNull();
});
