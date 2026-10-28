import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, fastForward, openGame, phase, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

/**
 * A victory can be carried on: the Archivists' recorded win, played through the browser's store, goes on into a
 * fourth age. Centuries pass, the fire returns fiercer over the works of three ages, and at the debrief the
 * chronicle is rested: a second ending, and a second run card, unranked.
 */
test('a victory is carried on into a fourth age and the chronicle is rested', async ({ page }, info) => {
  test.setTimeout(240_000);
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as RecordedTranscript;
  await replayTranscript(page, t);
  await expect.poll(() => phase(page)).toBe('VICTORY');
  await expect(page.getByTestId('endure-note')).toContainText('up to 12 ages');
  await page.getByTestId('endure').click();

  await expect(page.getByTestId('interregnum')).toBeVisible();
  await expect(page.getByTestId('interregnum')).toContainText('400 years pass');
  await expect(page.getByTestId('found')).toHaveText('Found age IV: The Ember Folk');
  await shot(page, info, 'chronicle-between');
  await page.getByTestId('found').click();

  await expect(page.getByTestId('prepare')).toBeVisible();
  expect(await campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 3]);
  await expect(page.getByTestId('chronicle-goals')).toContainText('age IV of at most XII');
  await expect(page.getByTestId('chronicle-goals')).toContainText(
    'The Second Great Fire comes back 10% fiercer than its first coming: it reaches further and does more harm',
  );
  await expect(page.getByTestId('victory-goals')).toHaveCount(0);
  await shot(page, info, 'chronicle-briefing');

  await page.getByTestId('begin').click();
  await expect.poll(() => phase(page)).toBe('ACTIVE');
  await fastForward(page, 300);
  await fastForward(page, 400);
  await expect.poll(() => phase(page)).toBe('COLLAPSING');
  await expect(page.getByTestId('collapse')).toBeVisible();
  await shot(page, info, 'chronicle-fire');
  await page.getByTestId('skip-collapse').click();

  await expect(page.getByTestId('debrief')).toContainText('The Second Great Fire');
  await expect(page.getByTestId('verdict')).toHaveCount(0);
  await expect(page.getByTestId('debrief-continue')).toHaveText('Let the centuries pass');
  await page.getByTestId('rest').click();

  await expect(page.getByTestId('end')).toBeVisible();
  await expect(page.getByTestId('end-title')).toHaveText('The chronicle rests');
  await expect(page.getByTestId('chronicle-ages')).toContainText('4 ages · the cycle broken in Age III');
  await expect(page.getByTestId('endure')).toHaveCount(0);
  await expect(page.getByTestId('atlas-age')).toHaveCount(4);
  expect(await phase(page)).toBe('VICTORY');
  const endless = await page.evaluate(
    () =>
      (window as unknown as { __epoch: { store: { campaign: { endless?: unknown } } } }).__epoch.store
        .campaign.endless,
  );
  expect(endless).toEqual({ rested: true });
  await shot(page, info, 'chronicle-end');

  await page.getByTestId('end').getByRole('button', { name: 'Title' }).click();
  await expect(page.getByTestId('recent-runs')).toContainText('the chronicle rests after 4 ages');
});
