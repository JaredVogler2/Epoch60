import { expect, test } from '@playwright/test';
import { openGame, phase, startNewGame } from './helpers';

type LoseWindow = { __lose?: WEBGL_lose_context | null };

/** How many distinct colours a sample of the game canvas holds (a blank or cleared canvas has one or two). */
async function canvasColours(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    (window as unknown as { __epoch: { camera: { render: () => void } } }).__epoch.camera.render();
    const src = document.querySelector('canvas');
    if (!src) return 0;
    const probe = document.createElement('canvas');
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext('2d')!;
    ctx.drawImage(src, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4)
      seen.add((d[i]! >> 3) * 1024 + (d[i + 1]! >> 3) * 32 + (d[i + 2]! >> 3));
    return seen.size;
  });
}

/**
 * A lost WebGL context (a GPU reset, or iOS reclaiming memory while the tab is in the background) must not end the
 * game: the clock stops, the player is told why, and a fresh renderer draws the same valley when the context returns.
 */
test('a lost graphics context pauses the epoch and the valley is redrawn when it returns', async ({
  page,
}) => {
  await openGame(page);
  await startNewGame(page);
  await page.getByTestId('begin').click();
  await expect.poll(() => phase(page)).toBe('ACTIVE');
  expect(await canvasColours(page)).toBeGreaterThan(40);

  await page.evaluate(() => {
    // Software GL can stall a frame long enough to pause the epoch ("stalled") before this point; the clock must
    // be running when the context goes, so the pause is the graphics one.
    (window as unknown as { __epoch: { store: { resume: () => void } } }).__epoch.store.resume();
    const cv = document.querySelector('canvas')!;
    const gl = cv.getContext('webgl2') ?? cv.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context') ?? null;
    (window as unknown as LoseWindow).__lose = ext;
    ext?.loseContext();
  });
  await expect(page.locator('.gl-lost')).toBeVisible();
  const lostAt = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __epoch: { store: { campaign: { paused: boolean; tick: number }; pauseReason: string } };
      }
    ).__epoch.store;
    return { paused: s.campaign.paused, reason: s.pauseReason, tick: s.campaign.tick };
  });
  expect(lostAt.paused).toBe(true);
  expect(lostAt.reason).toBe('graphics');
  await expect(page.getByTestId('pause-overlay')).toContainText('graphics restarted');

  await page.evaluate(() => (window as unknown as LoseWindow).__lose?.restoreContext());
  await expect(page.locator('.gl-lost')).toBeHidden();
  // The renderer was rebuilt from the store: the valley is drawn again, and no game time passed meanwhile.
  await expect.poll(() => canvasColours(page)).toBeGreaterThan(40);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __epoch: { store: { campaign: { tick: number } } } }).__epoch.store.campaign
          .tick,
    ),
  ).toBe(lostAt.tick);

  // The player resumes from the same second.
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('pause-overlay')).toBeHidden();
  expect(await phase(page)).toBe('ACTIVE');
});
