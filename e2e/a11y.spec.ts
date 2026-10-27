import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { campaign, fastForward, openGame, shot } from './helpers';

/** Move keyboard focus with Tab only, until the element with this test id has it. */
async function tabTo(page: Page, testId: string, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    const hit = await page.evaluate(
      (id) => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') === id,
      testId,
    );
    if (hit) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`could not Tab to ${testId}`);
}

test('a complete first epoch can be played with the keyboard alone', async ({ page }, info) => {
  test.skip(info.project.name === 'iphone', 'keyboard path is a desktop affordance');
  await openGame(page);
  await tabTo(page, 'new-game');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('hud')).toBeVisible();

  // Pick buildings with number keys, find a site with N, confirm with Enter — no pointer anywhere.
  for (const [key, kind] of [
    ['1', 'farm'],
    ['4', 'cottage'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(page.getByTestId('placebar')).toBeVisible();
    await page.keyboard.press('n');
    await expect(page.getByTestId('placebar')).toHaveClass(/ok/);
    await expect(page.getByTestId('place-msg')).toContainText(/site 1 of/);
    // Arrow keys nudge the ghost; the engine re-validates every move.
    const before = await page.evaluate(() => {
      const p = (window as unknown as { __epoch: { store: { placing: { x: number; y: number } } } }).__epoch
        .store.placing;
      return `${p.x},${p.y}`;
    });
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => {
      const p = (window as unknown as { __epoch: { store: { placing: { x: number; y: number } } } }).__epoch
        .store.placing;
      return `${p.x},${p.y}`;
    });
    expect(after).not.toBe(before);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('placebar')).toBeHidden();
    expect(kind).toBeTruthy();
  }
  await expect(page.getByTestId('plan-item')).toHaveCount(2);

  // Begin with Tab + Enter, pause and resume with Space.
  await tabTo(page, 'begin');
  await page.keyboard.press('Enter');
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await tabTo(page, 'resume');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pause-overlay')).toBeHidden();

  // The live region speaks at meaningful moments rather than every tick.
  await expect(page.getByTestId('announcer')).not.toHaveText('');
  await fastForward(page, 600);
  await expect(page.getByTestId('announcer')).toContainText(/took|lives|Great|Wildfire|fire/i);
  await shot(page, info, 'keyboard-only-collapse');
  await tabTo(page, 'skip-collapse');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('debrief')).toBeVisible();
});

test('the operating system’s reduced-motion preference is honoured by default', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await openGame(page);
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('title-settings').getByRole('checkbox', { name: /motion/i })).toBeChecked();
  await ctx.close();
});

test('with reduced motion the catastrophe card appears at once and the facts are kept', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await openGame(page);
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await fastForward(page, 600);
  await expect(page.getByTestId('collapse')).toHaveClass(/done/);
  await expect(page.getByTestId('skip-collapse')).toHaveText('See what survived');
  await ctx.close();
});
