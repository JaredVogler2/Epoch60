import { expect, test } from '@playwright/test';
import { openGame } from './helpers';

/**
 * The planning controls must stay reachable at every screen shape we claim to support. Each of these once failed:
 * on an 844x390 phone the tray sat on top of the Begin button; on 390x664 a three-row placement bar covered the valley.
 */
const SIZES: [string, number, number][] = [
  ['laptop 1366x657', 1366, 657],
  ['phone portrait 390x664', 390, 664],
  ['small phone 320x568', 320, 568],
  ['phone landscape 844x390', 844, 390],
  ['small phone landscape 667x375', 667, 375],
];

for (const [label, w, h] of SIZES) {
  test(`planning controls are reachable on a ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openGame(page);
    await page.getByTestId('new-game').click();
    await expect(page.getByTestId('hud')).toBeVisible();

    const hit = (testId: string) =>
      page.evaluate((id) => {
        const el = document.querySelector(`[data-testid=${id}]`);
        if (!el) return 'missing';
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return 'offscreen';
        const top = document.elementFromPoint(cx, cy);
        return top === el || el.contains(top)
          ? 'ok'
          : `covered by ${top?.getAttribute('data-testid') ?? top?.className}`;
      }, testId);

    // The Begin button is the one control a player cannot do without.
    expect(await hit('begin'), 'Begin Epoch must be the element a tap would hit').toBe('ok');
    // No page-level overflow: the HUD never scrolls the page sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Choosing a building shows a placement bar that fits on the screen and leaves room to see the valley.
    await page.getByTestId('card-cottage').click();
    const bar = await page.getByTestId('placebar').boundingBox();
    expect(bar).not.toBeNull();
    expect(bar!.y + bar!.height, 'placement bar fits above the bottom edge').toBeLessThanOrEqual(h + 1);
    expect(bar!.height, 'placement bar leaves at least half the screen to the valley').toBeLessThan(h / 2);
    for (const id of ['next-spot', 'cancel-place', 'confirm-place']) expect(await hit(id), id).toBe('ok');

    // Next site works from the bar alone, and Cancel returns to the tray with Begin reachable again.
    await page.getByTestId('next-spot').click();
    await expect(page.getByTestId('placebar')).toHaveClass(/ok/);
    await page.getByTestId('cancel-place').click();
    await expect(page.getByTestId('tray')).toBeVisible();
    expect(await hit('begin')).toBe('ok');
  });
}
