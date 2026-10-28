import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

const hash = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __epoch: { hash: () => string } }).__epoch.hash());

/**
 * A lineage that lost can go back to the founding of a later age and play on from there. The branch starts from
 * exactly the state that age was founded with, and its ending and run card say it is a branch, never ranked.
 */
test('the ending replays an age from its founding, and the branch is marked and unranked', async ({
  page,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/builder.json', 'utf8')) as RecordedTranscript;
  let seen = 0;
  const k = t.actions.findIndex((a) => a.action.type === 'found' && ++seen === 2) + 1;
  // The builder's lineage up to the founding of the third age: remember that state.
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, k) });
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 2]);
  const founded = await hash(page);
  await replayTranscript(page, t, k);
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('DEFEAT');
  await expect(page.getByTestId('end')).toBeVisible();
  await expect(page.getByTestId('replay-age-1')).toBeVisible();
  await expect(page.getByTestId('replay-age-2')).toBeVisible();
  await expect(page.getByTestId('replay-note')).toContainText('never ranked');
  await shot(page, info, 'end-replay');

  await page.getByTestId('replay-age-2').click();
  await expect(page.getByTestId('end')).toBeHidden();
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 2]);
  expect(await hash(page)).toBe(founded);
  await expect(page.getByTestId('branch-mark')).toContainText('replayed from Age III');

  // Play the third age again (the same orders) to its end: the ending says it is a branch.
  await replayTranscript(page, t, k);
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('DEFEAT');
  await expect(page.getByTestId('end').getByTestId('branch-mark')).toContainText(
    'a branch from Age III, not ranked',
  );
  await page.getByTestId('end').getByRole('button', { name: 'Title' }).click();
  await expect(page.getByTestId('recent-runs')).toContainText('branch from age III');
});
