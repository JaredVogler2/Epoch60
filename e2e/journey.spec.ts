import { expect, test } from '@playwright/test';
import {
  campaign,
  fastForward,
  openGame,
  phase,
  placeBuilding,
  projectGround,
  settle,
  shot,
  startNewGame,
} from './helpers';

test.describe('first epoch: title → plan → build → time → collapse', () => {
  test('a real player path builds, pays, ticks, pauses and collapses', async ({ page }, info) => {
    const touch = info.project.name === 'iphone';
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await openGame(page);
    await shot(page, info, '01-title');
    await startNewGame(page);
    await expect(page.getByTestId('prepare')).toBeVisible();
    await expect(page.getByTestId('timer-digits')).toContainText('60.0');
    // The tray only lists finished, working buildings.
    for (const k of [
      'farm',
      'lumber_camp',
      'quarry',
      'cottage',
      'workshop',
      'archive',
      'seed_vault',
      'firebreak',
    ]) {
      await expect(page.getByTestId(`card-${k}`)).toBeVisible();
    }
    // Later-age and untaught buildings are shown, but locked with the reason.
    for (const k of ['levee', 'stone_house', 'forge']) {
      await expect(page.getByTestId(`card-${k}`)).toHaveAttribute('aria-disabled', 'true');
    }
    await shot(page, info, '02-prepare');

    // Plan three opening orders with the real pointer path. Nothing is paid yet.
    const before = await campaign(page, (c) => ({ t: c.civ.res.timber, f: c.civ.res.food }));
    await placeBuilding(page, 'farm', { avoidHazard: true, maxDist: 12 }, touch);
    await placeBuilding(page, 'lumber_camp', { maxDist: 20 }, touch);
    await placeBuilding(page, 'cottage', { avoidHazard: true, maxDist: 10 }, touch);
    await expect(page.getByTestId('plan-item')).toHaveCount(3);
    const mid = await campaign(page, (c) => ({ t: c.civ.res.timber, q: c.queue.length }));
    expect(mid.t).toBe(before.t);
    expect(mid.q).toBe(3);
    await shot(page, info, '03-planned');

    // Begin the epoch: costs are paid exactly once, construction sites appear, the clock runs.
    await page.getByTestId('begin').click();
    await expect.poll(() => phase(page)).toBe('ACTIVE');
    await expect
      .poll(() => campaign(page, (c) => c.structures.filter((s) => s.status === 'constructing').length), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
    const after = await campaign(page, (c) => ({ t: c.civ.res.timber, tick: c.tick }));
    expect(after.t).toBeLessThan(before.t);
    await expect
      .poll(() => campaign(page, (c) => c.tick), { timeout: 15000 })
      .toBeGreaterThan(after.tick + 5);
    await shot(page, info, '04-building');

    // Pause freezes the world; resume continues.
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    const frozen = await campaign(page, (c) => c.tick);
    await page.waitForTimeout(1500);
    expect(await campaign(page, (c) => c.tick)).toBe(frozen);
    await page.getByTestId('resume').click();
    await expect(page.getByTestId('pause-overlay')).toBeHidden();

    // Let the minute run out (fast-forward through the same engine ticks) and watch the collapse.
    await fastForward(page, 280);
    await expect(page.getByTestId('warning')).toBeVisible();
    await shot(page, info, '05-warning');
    await fastForward(page, 400);
    await expect.poll(() => phase(page)).toBe('COLLAPSING');
    await expect(page.getByTestId('collapse')).toBeVisible();
    await shot(page, info, '06-collapse');
    await page.getByTestId('skip-collapse').click();
    await expect(page.getByTestId('debrief')).toBeVisible();
    await expect(page.getByTestId('causes')).toBeVisible();
    await shot(page, info, '07-debrief');
    expect(errors.filter((e) => !/WebGL|GPU stall|ReadPixels/i.test(e))).toEqual([]);
  });

  test('invalid placement is explained and never charges', async ({ page }, info) => {
    test.skip(
      info.project.name === 'iphone',
      'hover is a desktop affordance; touch placement is covered in the main journey',
    );
    await openGame(page);
    await startNewGame(page);
    await page.getByTestId('card-cottage').click();
    const h = await campaign(page, (c) => c.world.anchors.hearth);
    const p = await projectGround(page, h.x + 1, h.y + 1);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    await expect(page.getByTestId('placebar')).toHaveClass(/bad/);
    await expect(page.getByTestId('place-msg')).toContainText(/already there|Blocked/i);
    await expect(page.getByTestId('confirm-place')).toBeDisabled();
    const timber = await campaign(page, (c) => c.civ.res.timber);
    await page.mouse.click(p.x, p.y);
    expect(await campaign(page, (c) => c.queue.length)).toBe(0);
    expect(await campaign(page, (c) => c.civ.res.timber)).toBe(timber);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('placebar')).toBeHidden();
    await settle(page);
  });
});
