import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

type ReplayWindow = {
  __epoch: {
    store: {
      replay: { matched: boolean | null; next: number; actions: unknown[] } | null;
      resume: () => void;
      campaign: { phase: string; epoch: number; paused: boolean };
    };
  };
};
const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as ReplayWindow).__epoch.store;
    return {
      matched: s.replay?.matched ?? null,
      watching: !!s.replay,
      phase: s.campaign.phase,
      epoch: s.campaign.epoch,
      paused: s.campaign.paused,
    };
  });
/** Software GL can stall a frame past the stall guard (K-011); a viewer would press Resume, so the test does. */
const resumeIfStalled = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as ReplayWindow).__epoch.store;
    if (s.campaign.phase === 'ACTIVE' && s.campaign.paused) s.resume();
  });

/**
 * The ending offers to watch the lineage again: the Archivists' recorded win is replayed from its first day through the
 * same engine, every action at its tick, with the debrief, the dig and the catastrophes shown, and the replay says it
 * ended in exactly the lineage's state. Nothing can be built while it runs; Back returns to the ending.
 */
test('a finished lineage can be watched again, and ends exactly where it did', async ({ page }, info) => {
  test.setTimeout(600_000);
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as RecordedTranscript;
  await replayTranscript(page, t);
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('VICTORY');
  await expect(page.getByTestId('end')).toBeVisible();
  const title = await page.getByTestId('end-title').innerText();

  await page.getByTestId('watch-lineage').click();
  await expect(page.getByTestId('replay-bar')).toBeVisible();
  await expect(page.getByTestId('end')).toHaveCount(0);
  await page.getByTestId('replay-speed-4').click();
  await expect(page.getByTestId('replay-speed-4')).toHaveAttribute('aria-checked', 'true');
  // Watching, not playing: no tray, and the briefing's Begin cannot be pressed.
  await expect(page.getByTestId('tray')).toHaveCount(0);
  expect((await state(page)).watching).toBe(true);

  let captured = false;
  for (let i = 0; i < 540; i++) {
    const s = await state(page);
    if (s.matched !== null) break;
    if (!captured && s.epoch === 1 && s.phase === 'ACTIVE') {
      await shot(page, info, 'replay-watching');
      captured = true;
    }
    await resumeIfStalled(page);
    await page.waitForTimeout(1000);
  }
  await expect(page.getByTestId('replay-result')).toBeVisible();
  await expect(page.getByTestId('replay-result')).toHaveAttribute('data-matched', 'true');
  await expect(page.getByTestId('end-title')).toHaveText(title);
  await expect(page.getByTestId('replay-bar')).toHaveCount(0);
  expect(captured).toBe(true);
  await shot(page, info, 'replay-result');

  await page.getByTestId('replay-back').click();
  await expect(page.getByTestId('replay-result')).toHaveCount(0);
  await expect(page.getByTestId('play-again')).toBeVisible();
  expect((await state(page)).watching).toBe(false);
});
