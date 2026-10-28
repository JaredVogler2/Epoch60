import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

type Store = {
  campaign: { phase: string; tick: number };
  snapshots: Record<number, { then?: string; after?: string }>;
};
type Epoch = {
  store: Store & { pause: (reason: string) => void; resume: () => void };
  fastForward: (n: number) => number;
};
/** Software GL draws a frame in up to a few seconds: allow the pictures time. */
const SLOW = { timeout: 30_000 };
const JPEG = /^data:image\/jpeg/;

const picture = (page: Page, epoch: number, kind: 'then' | 'after') =>
  page.evaluate(
    ([e, k]) => (window as unknown as { __epoch: Epoch }).__epoch.store.snapshots[e]?.[k] ?? null,
    [epoch, kind] as const,
  );

/**
 * Plays entries [from, upto) of a recorded lineage through the browser's store, stopping where a real minute gives the
 * render layer frames to work with: in the last seconds of each age (the "then" picture) and before each founding (the
 * "after" one). A replay runs synchronously, so without these stops no frame would ever see those moments.
 */
async function playWithPictures(
  page: Page,
  t: RecordedTranscript,
  from: number,
  upto: number,
  thenTaken: Set<number>,
): Promise<void> {
  let i = from;
  while (i < upto) {
    const stop = t.actions.findIndex(
      (a, j) =>
        j >= i && j < upto && ((a.tick >= 570 && !thenTaken.has(a.epoch)) || a.action.type === 'found'),
    );
    const end = stop === -1 ? upto : stop;
    if (end > i) await replayTranscript(page, { ...t, actions: t.actions.slice(0, end) }, i);
    i = end;
    if (stop === -1) break;
    const entry = t.actions[stop]!;
    if (entry.action.type === 'found' && thenTaken.has(entry.epoch)) {
      // Between ages: the valley after the centuries, then the founding.
      await expect.poll(() => picture(page, entry.epoch, 'after'), SLOW).toMatch(JPEG);
      await replayTranscript(page, { ...t, actions: t.actions.slice(0, stop + 1) }, stop);
      i = stop + 1;
      continue;
    }
    // The last seconds of the minute: the village as it stands before the catastrophe resolves. Paused while the
    // picture is taken (it needs frames, not ticks), so a slow software frame cannot read as a stall.
    await page.evaluate(() => {
      const e = (window as unknown as { __epoch: Epoch }).__epoch;
      const c = e.store.campaign;
      if (c.phase === 'ACTIVE' && c.tick < 575) e.fastForward(575 - c.tick);
      e.store.pause('user');
    });
    await expect.poll(() => picture(page, entry.epoch, 'then'), SLOW).toMatch(JPEG);
    await page.evaluate(() => (window as unknown as { __epoch: Epoch }).__epoch.store.resume());
    thenTaken.add(entry.epoch);
  }
}

test('the valley is pictured as each minute ended and afterwards, between ages and in the Atlas', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/archivists.json', 'utf8')) as RecordedTranscript;
  const k = t.actions.findIndex((a) => a.action.type === 'found');
  const taken = new Set<number>();

  // Up to the first age's end and the centuries after it.
  await playWithPictures(page, t, 0, k, taken);
  expect(await campaign(page, (c) => c.phase)).toBe('INTERREGNUM');
  await expect.poll(() => picture(page, 0, 'after'), SLOW).toMatch(JPEG);
  const figure = page.getByTestId('interregnum').getByTestId('then-now');
  await expect(figure).toBeVisible();
  const srcThen = await page.getByTestId('then-now-then').getAttribute('src');
  const srcAfter = await page.getByTestId('then-now-after').getAttribute('src');
  expect(srcThen).toMatch(JPEG);
  expect(srcAfter).toMatch(JPEG);
  expect(srcThen).not.toBe(srcAfter);
  // Both pictures are real frames of the same size, 16:9.
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>('[data-testid="then-now"] img')].map((im) => [
      im.naturalWidth,
      im.naturalHeight,
    ]),
  );
  expect(sizes).toHaveLength(2);
  expect(sizes[0]).toEqual(sizes[1]);
  expect(sizes[0]![0]! / sizes[0]![1]!).toBeCloseTo(16 / 9, 1);
  await expect(figure.locator('figcaption')).toContainText('As the minute ended');
  await expect(figure.locator('figcaption')).toContainText('years later');
  // The slider moves the seam: all the way left shows only the valley as it is now, all the way right only then.
  await page.getByTestId('then-now-slider').focus();
  await page.keyboard.press('Home');
  await expect(figure.locator('.then-now-frame')).toHaveAttribute('style', /--split:\s*0%/);
  await page.keyboard.press('End');
  await expect(figure.locator('.then-now-frame')).toHaveAttribute('style', /--split:\s*100%/);
  for (let n = 0; n < 50; n++) await page.keyboard.press('ArrowLeft');
  await shot(page, info, 'then-now-between-ages');

  // The rest of the lineage, to its ending: the Atlas pairs every age's two pictures.
  await playWithPictures(page, t, k, t.actions.length, taken);
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('VICTORY');
  await expect.poll(() => picture(page, 2, 'after'), SLOW).toMatch(JPEG);
  await expect(page.getByTestId('end').getByTestId('atlas-pics')).toHaveCount(3);
  await page.getByTestId('end').getByTestId('atlas-pics').first().scrollIntoViewIfNeeded();
  await shot(page, info, 'then-now-atlas');
});
