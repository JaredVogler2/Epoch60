import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { campaign, openGame, replayTranscript, shot, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

type DataWindow = { __epoch: { hash: () => string | null; store: { quitToTitle: () => void } } };
const hash = (page: Page) => page.evaluate(() => (window as unknown as DataWindow).__epoch.hash());
const toTitle = async (page: Page) => {
  await page.evaluate(() => (window as unknown as DataWindow).__epoch.store.quitToTitle());
  await expect(page.getByTestId('title')).toBeVisible();
};
const backTo = (page: Page) =>
  page.getByTestId('title-settings').getByRole('button', { name: 'Back', exact: true }).click();

/**
 * Phase 18's "the user can export/import": a lineage played in one browser is exported from Settings, imported into
 * another browser (a new context, so nothing is stored there), and goes on there from exactly the state it left, with
 * its Codex feats, to the same victory.
 */
test('a lineage exported from one browser plays on in another, exactly as it was', async ({
  page,
  browser,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/engineers.json', 'utf8')) as RecordedTranscript;
  // Up to the first debrief: the lineage between ages, two feats in the Codex.
  const at = await replayTranscript(page, t, 0, 'DEBRIEF');
  await expect(page.getByTestId('debrief')).toBeVisible();
  const played = await hash(page);
  await toTitle(page);
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('your-data')).toContainText('nothing is sent anywhere');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-backup').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^epoch60-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = info.outputPath('backup.json');
  await download.saveAs(file);
  const b = JSON.parse(readFileSync(file, 'utf8')) as {
    format: string;
    version: number;
    lineage: { save: string };
    codex: { id: string }[];
    runs: unknown[];
  };
  expect(b).toMatchObject({ format: 'epoch60-backup', version: 1 });
  expect(typeof b.lineage.save).toBe('string');
  expect(b.codex.map((e) => e.id)).toEqual(['archive_built', 'fire_contained']);
  await expect(page.getByTestId('data-note')).toHaveText(
    'Backup exported: your saved lineage, 2 Codex feats and 0 run cards.',
  );
  await shot(page, info, 'backup-export');

  // Another browser, with nothing in it.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = info.project.use;
  const other = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const p2 = await other.newPage();
  await openGame(p2);
  await expect(p2.getByTestId('continue')).toBeDisabled();
  await expect(p2.getByTestId('open-codex')).toContainText('0/');
  await p2.getByTestId('settings').click();
  await p2.getByTestId('import-file').setInputFiles(file);
  await expect(p2.getByTestId('import-lineage')).toHaveText(
    'a lineage: Greenvale, age I · Normal · seed 6001',
  );
  await expect(p2.getByTestId('import-preview')).toContainText('2 Codex feats');
  await shot(p2, info, 'backup-import');
  await p2.getByTestId('import-confirm').click();
  await expect(p2.getByTestId('data-note')).toHaveText(
    'Imported the lineage (Continue resumes it), 2 new Codex feats and 0 new run cards.',
  );
  await backTo(p2);
  await expect(p2.getByTestId('open-codex')).toContainText('2/');
  await p2.getByTestId('continue').click();
  await expect(p2.getByTestId('debrief')).toBeVisible();
  expect(await hash(p2)).toBe(played);
  // It plays on there: the rest of the recorded lineage, to the same victory.
  await replayTranscript(p2, t, at);
  await expect.poll(() => campaign(p2, (c) => c.phase)).toBe('VICTORY');
  expect(await hash(p2)).toBe(t.finalHash);
  await other.close();
});

/** Phase 18's "reset confirms consequences": there is room for one saved lineage, so starting over asks first. */
test('starting over asks before a saved lineage with progress is replaced, and keeping it keeps it', async ({
  page,
}, info) => {
  await openGame(page);
  await startNewGame(page);
  // Nothing done yet: starting again does not ask.
  await toTitle(page);
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  // The minute begun: now there is something to lose.
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await toTitle(page);
  const kept = await hash(page);
  await page.getByTestId('new-game').click();
  const ask = page.getByTestId('confirm-start');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText(
    'Your saved lineage (Greenvale, age I · Normal · seed 6001) will be replaced',
  );
  await expect(page.getByTestId('confirm-keep')).toBeFocused();
  await expect(page.getByTestId('new-game')).toHaveCount(0);
  await shot(page, info, 'confirm-start');
  await page.getByTestId('confirm-keep').click();
  await expect(ask).toHaveCount(0);
  // Focus goes back to the button that asked (a pointer click focuses it on desktop Chromium).
  if (info.project.name === 'desktop') await expect(page.getByTestId('new-game')).toBeFocused();
  // The other ways to begin ask too, and Escape keeps it as well.
  await page.getByTestId('daily').click();
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toHaveCount(0);
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(await hash(page)).toBe(kept);
  // Starting over for real.
  await toTitle(page);
  await page.getByTestId('random-valley').click();
  await page.getByTestId('confirm-replace').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(await campaign(page, (c) => [c.phase, c.tick])).toEqual(['PREPARE', 0]);
  expect(await hash(page)).not.toBe(kept);
});

test('a file that is not a backup changes nothing, and an edited lineage in one is left out', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('settings').click();
  const json = (name: string, v: unknown) => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)),
  });
  await page.getByTestId('import-file').setInputFiles(json('notes.json', { hello: 1 }));
  await expect(page.getByTestId('data-note')).toHaveText('That file is not an EPOCH backup.');
  await expect(page.getByTestId('import-preview')).toHaveCount(0);
  await page.getByTestId('import-file').setInputFiles(json('broken.json', '{"format":'));
  await expect(page.getByTestId('data-note')).toHaveText('That file is not an EPOCH backup.');
  // A backup whose lineage was edited: the lineage is refused, the feat still comes in.
  const feat = {
    id: 'archive_built',
    at: '2026-10-28T00:00:00.000Z',
    seed: 6001,
    scenario: 'greenvale',
    difficulty: 'normal',
  };
  await page.getByTestId('import-file').setInputFiles(
    json('edited.json', {
      format: 'epoch60-backup',
      version: 1,
      lineage: { save: '{"v":1}' },
      codex: [feat],
      runs: [],
    }),
  );
  await expect(page.getByTestId('import-unreadable')).toBeVisible();
  await expect(page.getByTestId('import-lineage')).toHaveCount(0);
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('data-note')).toHaveText('Imported 1 new Codex feat and 0 new run cards.');
  await backTo(page);
  await expect(page.getByTestId('continue')).toBeDisabled();
  await expect(page.getByTestId('open-codex')).toContainText('1/');
});
