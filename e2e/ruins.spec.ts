import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

type RuinWindow = {
  __epoch: {
    store: {
      select: (id: number | null) => void;
      campaign: { structures: { id: number; kind: string; status: string }[]; queue: unknown[] };
    };
  };
};
const select = (page: import('@playwright/test').Page, id: number) =>
  page.evaluate((i) => (window as unknown as RuinWindow).__epoch.store.select(i), id);

/**
 * Pressing a ruin tells its age, what it was for, how it fell and what clearing or restoring does now. The village
 * is the Archivists' recorded lineage at the founding of the second age, played through the browser's store.
 */
test('a ruin tells its story, and its Restore button does what the inspector says', async ({
  page,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as RecordedTranscript;
  const k = t.actions.findIndex((a) => a.action.type === 'found');
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, k + 1) });
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 1]);

  // The lumber camp the fire took: never dug up, so it can only be cleared for now.
  await select(page, 4);
  await expect(page.getByTestId('ruin-facts')).toBeVisible();
  await expect(page.getByTestId('ruin-built')).toContainText(
    'Built in the Age of Thatch by The Founders (age I).',
  );
  await expect(page.getByTestId('ruin-fell')).toContainText('was destroyed by The Great Fire');
  await expect(page.getByTestId('ruin-clear')).toContainText('less than 1 timber');
  await expect(page.getByTestId('ruin-restore')).toHaveText('To restore it, excavate it first between ages.');
  await expect(page.getByTestId('act-repair')).toHaveCount(0);

  // The quarry dug up between ages: the inspector names the price the Restore button shows, and the button orders it.
  await select(page, 5);
  await expect(page.getByTestId('ruin-restore')).toContainText('Restoring it costs 8 timber');
  await expect(page.getByTestId('ruin-restore')).toContainText('it works again as a Quarry');
  await expect(page.getByTestId('act-repair')).toContainText('8');
  await expect(page.getByTestId('act-repair')).toBeInViewport();
  await shot(page, info, 'ruin-inspector');
  await page.getByTestId('act-repair').click();
  await expect
    .poll(() =>
      campaign(page, (c) => (c.queue as { action: { type: string; id: number } }[]).map((q) => q.action)),
    )
    .toContainEqual({ type: 'repair', id: 5 });
  // On a phone the inspector sheet covers the briefing: close it, as a player would, then begin.
  await page.getByTestId('inspector').getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('begin').click();
  await expect
    .poll(() => campaign(page, (c) => c.structures.find((s) => s.id === 5)?.status))
    .toBe('constructing');
});
