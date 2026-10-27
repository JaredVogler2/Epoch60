import { expect, test } from '@playwright/test';
import { campaign, openGame, projectGround, settle, startNewGame } from './helpers';

type HoverWindow = { __epoch: { store: { hoverId: number | null } } };

const hoverState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    id: (window as unknown as HoverWindow).__epoch.store.hoverId,
    cursor: document.querySelector('canvas')!.style.cursor,
  }));

test('the building under the mouse is highlighted and shows a pointer cursor', async ({ page }, info) => {
  test.skip(info.project.name === 'iphone', 'hover is a mouse affordance');
  await openGame(page);
  await startNewGame(page);
  await settle(page);
  const hearth = await campaign(page, (c) => {
    const h = c.structures.find((s) => s.kind === 'hearth')!;
    return { id: h.id, x: h.x + h.w / 2, z: h.y + h.h / 2 };
  });

  const on = await projectGround(page, hearth.x, hearth.z);
  await page.mouse.move(on.x, on.y);
  await expect.poll(() => hoverState(page)).toEqual({ id: hearth.id, cursor: 'pointer' });

  // Open grass a few cells away: nothing to click, so no highlight and the default cursor.
  const off = await projectGround(page, hearth.x + 5, hearth.z + 5);
  await page.mouse.move(off.x, off.y, { steps: 4 });
  await expect.poll(() => hoverState(page)).toEqual({ id: null, cursor: '' });
});
