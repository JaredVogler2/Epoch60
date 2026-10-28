import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

/** Whether a tap at the centre of a control would reach it: 'ok', 'missing', 'offscreen' or what covers it. */
const hitTest = (page: Page, testId: string) =>
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
const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const [label, w, h] of SIZES) {
  test(`planning controls are reachable on a ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openGame(page);
    await page.getByTestId('new-game').click();
    await expect(page.getByTestId('hud')).toBeVisible();
    const hit = (testId: string) => hitTest(page, testId);

    // The Begin button is the one control a player cannot do without.
    expect(await hit('begin'), 'Begin Epoch must be the element a tap would hit').toBe('ok');
    // No page-level overflow: the HUD never scrolls the page sideways.
    expect(await noSidewaysScroll(page)).toBe(true);
    // Every top-bar button keeps a 44 px touch target, even on a 320 px phone (K-008), and the timer is not cut off.
    const top = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.topbar button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return {
            name: b.getAttribute('aria-label') ?? '',
            width: r.width,
            height: r.height,
            right: r.right,
          };
        }),
    );
    expect(top.length).toBeGreaterThanOrEqual(4);
    for (const b of top) {
      expect(b.width, `${b.name}: width`).toBeGreaterThanOrEqual(44);
      expect(b.height, `${b.name}: height`).toBeGreaterThanOrEqual(44);
      expect(b.right, `${b.name}: on screen`).toBeLessThanOrEqual(w);
    }
    expect(
      await page.evaluate(() => {
        const d = document.querySelector('.timer-digits')!;
        return d.scrollWidth <= d.clientWidth;
      }),
      'the timer digits fit',
    ).toBe(true);

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

/** Phase 18's "font scale": a larger browser text size keeps Begin reachable and the page from scrolling sideways. */
for (const [label, w, h] of [
  ['phone portrait 390x664', 390, 664],
  ['laptop 1366x657', 1366, 657],
] as const) {
  test(`larger text keeps the planning controls usable on a ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openGame(page);
    await page.getByTestId('new-game').click();
    await expect(page.getByTestId('hud')).toBeVisible();
    for (const scale of ['125%', '150%']) {
      await page.evaluate((size) => (document.documentElement.style.fontSize = size), scale);
      expect(await hitTest(page, 'begin'), `Begin at ${scale}`).toBe('ok');
      expect(await noSidewaysScroll(page), `no sideways scroll at ${scale}`).toBe(true);
    }
  });
}
