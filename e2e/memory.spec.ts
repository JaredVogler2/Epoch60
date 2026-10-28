import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openGame, settle } from './helpers';

type QuitWindow = { __epoch: { store: { quitToTitle: () => void } } };

/** A new valley from the title, drawn, then back to the title (a lineage with nothing done: the title does not ask). */
async function newWorld(page: Page): Promise<void> {
  await page.getByTestId('random-valley').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await settle(page);
  await page.evaluate(() => (window as unknown as QuitWindow).__epoch.store.quitToTitle());
  await expect(page.getByTestId('title')).toBeVisible();
}

/**
 * Phase 18's "no memory runaway after 10 new-world transitions": ten new valleys in a row, each drawn, leave one canvas
 * and a JavaScript heap that does not keep growing (Chromium's own heap metric, after a forced collection). One
 * profile is enough: the heap does not depend on the viewport.
 */
test('ten new worlds in a row leave one canvas and a heap that does not keep growing', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'measured once, on the desktop profile');
  await openGame(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize')!.value;
  };
  // Two worlds first, so that caches fill and the first allocations settle.
  await newWorld(page);
  await newWorld(page);
  const before = await heap();
  const after: number[] = [];
  for (let i = 0; i < 10; i++) {
    await newWorld(page);
    after.push(await heap());
  }
  const mb = (n: number) => Math.round(n / 1e5) / 10;
  info.annotations.push({ type: 'heap (MB)', description: `${mb(before)} → ${after.map(mb).join(' · ')}` });
  expect(await page.locator('canvas').count()).toBe(1);
  // Each world is a whole valley; a leak would keep every one of them.
  expect(after.at(-1)!).toBeLessThan(before * 1.25);
});
