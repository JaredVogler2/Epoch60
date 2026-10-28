import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { URL, campaign, replayTranscript, startNewGame } from './helpers';
import type { RecordedTranscript } from './helpers';

type CspWindow = { __csp?: string[]; __epoch?: { store: { quitToTitle: () => void } } };

/**
 * The game is served with the production headers (`vercel.json`; `vite preview` sends the same ones, so every browser
 * test runs under them). Its content security policy allows no inline script or style and no other origin; a journey
 * through the title, a whole age with its catastrophe, the interregnum, the next founding and a backup's download
 * reports no violation.
 */
test('the production content security policy holds through a whole age, with no violation', async ({
  page,
}) => {
  const refused: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) refused.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const w = window as unknown as CspWindow;
      (w.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const res = await page.goto(URL);
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain("style-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['permissions-policy']).toContain('camera=()');
  await page.waitForFunction(() => !!(window as unknown as CspWindow).__epoch);

  await startNewGame(page);
  const t = JSON.parse(readFileSync('fixtures/greenvale/engineers.json', 'utf8')) as RecordedTranscript;
  // The Great Fire, its debrief and the interregnum, up to the second age's founding.
  const founded = t.actions.findIndex((a) => a.action.type === 'found') + 1;
  await replayTranscript(page, { ...t, actions: t.actions.slice(0, founded) });
  await expect.poll(() => campaign(page, (c) => [c.phase, c.epoch])).toEqual(['PREPARE', 1]);
  await expect(page.getByTestId('hud')).toBeVisible();

  await page.evaluate(() => (window as unknown as CspWindow).__epoch!.store.quitToTitle());
  await page.getByTestId('settings').click();
  await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);

  expect(await page.evaluate(() => (window as unknown as CspWindow).__csp ?? [])).toEqual([]);
  expect(refused).toEqual([]);
});
