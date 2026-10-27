import { expect, test } from '@playwright/test';
import { dailyRun, utcDate } from '../src/game/modes';
import { campaign, fastForward, openGame } from './helpers';

type Snap = { seed: number; scenario: string; difficulty: string };
const snap = (c: unknown): Snap => c as Snap;

test('a shared link pre-selects the valley, scenario and difficulty, and starts exactly that', async ({
  page,
}) => {
  await page.goto('/?debug&still&quality=low&seed=777&scenario=ashen&difficulty=hard');
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await expect(page.getByTestId('seed-input')).toHaveValue('777');
  await expect(page.getByTestId('scenario-ashen')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('seed-note')).toContainText('shared link');
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  const c = await campaign(page, (x) => x);
  expect(snap(c)).toMatchObject({ seed: 777, scenario: 'ashen', difficulty: 'hard' });
});

test('hostile or malformed share links are ignored, never trusted', async ({ page }) => {
  await page.goto(
    '/?debug&still&quality=low&seed=%3Cscript%3Ealert(1)%3C/script%3E&scenario=__proto__&difficulty=insane',
  );
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await expect(page.getByTestId('seed-input')).toHaveValue('');
  await expect(page.getByTestId('scenario-greenvale')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('difficulty-normal')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('new-game').click();
  expect(snap(await campaign(page, (x) => x))).toMatchObject({
    seed: 6001,
    scenario: 'greenvale',
    difficulty: 'normal',
  });
});

test('typing any words as a seed gives a stable valley', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('seed-input').fill('river kingdom');
  await expect(page.getByTestId('seed-note')).toContainText('Valley ');
  await page.getByTestId('new-game').click();
  const a = snap(await campaign(page, (x) => x)).seed;
  expect(a).toBeGreaterThan(0);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __epoch?: unknown }).__epoch);
  await page.getByTestId('seed-input').fill('river kingdom');
  await page.getByTestId('new-game').click();
  expect(snap(await campaign(page, (x) => x)).seed).toBe(a);
});

test('Daily Ruins starts today’s UTC challenge, and finished runs leave a local card with a share link', async ({
  page,
}) => {
  await openGame(page);
  const today = dailyRun(utcDate(new Date()));
  await expect(page.getByTestId('daily')).toContainText(today.daily!);
  await page.getByTestId('daily').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  expect(snap(await campaign(page, (x) => x))).toMatchObject({
    seed: today.seed,
    scenario: today.scenario,
    difficulty: 'normal',
  });

  // An unprepared village does not survive: the ending leaves a card and offers a link to the same valley.
  await page.getByTestId('begin').click();
  await expect.poll(() => campaign(page, (c) => c.phase)).toBe('ACTIVE');
  await fastForward(page, 600);
  await page.getByTestId('skip-collapse').click();
  await page.getByTestId('debrief-continue').click();
  await expect(page.getByTestId('end')).toBeVisible();
  await expect(page.getByTestId('copy-link')).toBeVisible();
  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem('epoch60.runs.v1') ?? '[]'));
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({ seed: today.seed, scenario: today.scenario, daily: today.daily });
});
