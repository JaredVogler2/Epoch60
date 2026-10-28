import { expect, test } from '@playwright/test';
import { campaign, fastForward, openGame, phase, shot, startNewGame } from './helpers';

type Omens = { kind: string | null; strength: number; drawn: string[] };
type OmensWindow = { __epoch: { omens: () => Omens; camera: { render: () => void } } };

/** Draw a frame and read what the omens drew in it. */
async function omens(page: import('@playwright/test').Page): Promise<Omens> {
  await page.evaluate(() => (window as unknown as OmensWindow).__epoch.camera.render());
  await page.waitForTimeout(300);
  return page.evaluate(() => (window as unknown as OmensWindow).__epoch.omens());
}

/**
 * Prompt 19's crisis image: in the last seconds the threat is in the world, not only in the warnings. The first age's
 * fire shows itself from 30 s left (smoke where it will start, embers on its wind), nothing before, and its cinematic
 * takes over when it strikes.
 */
test('the coming fire shows itself in the valley from 30 s left, and only then', async ({ page }, info) => {
  await openGame(page);
  await startNewGame(page);
  await page.getByTestId('begin').click();
  await expect.poll(() => phase(page)).toBe('ACTIVE');

  await fastForward(page, 100);
  // A frame under software GL can take longer than one wait: poll until one has been drawn at this tick.
  await expect.poll(async () => (await omens(page)).kind).toBe('fire');
  expect(await omens(page)).toMatchObject({ strength: 0, drawn: [] });

  // 3 s left: the whole omen.
  await fastForward(page, 570 - (await campaign(page, (c) => c.tick)));
  await expect.poll(async () => (await omens(page)).strength).toBeGreaterThan(0.95);
  expect(await omens(page)).toMatchObject({ kind: 'fire', drawn: ['smoke', 'embers'] });
  await shot(page, info, 'omens-fire');

  await fastForward(page, 60);
  await expect.poll(() => phase(page)).toBe('COLLAPSING');
  await expect.poll(async () => (await omens(page)).drawn).toEqual([]);
});
