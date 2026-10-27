import { expect, test } from '@playwright/test';
import { campaign, openGame, projectGround, settle, startNewGame } from './helpers';

type HoverWindow = {
  __epoch: {
    store: { hoverId: number | null };
    camera: {
      get: () => { x: number; z: number };
      set: (p: Record<string, number>, instant?: boolean) => void;
      render: () => void;
    };
  };
};

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

  // The camera moves under a resting mouse: the highlight follows what is under it now, not what was.
  await page.mouse.move(on.x, on.y, { steps: 4 });
  await expect.poll(() => hoverState(page)).toEqual({ id: hearth.id, cursor: 'pointer' });
  await page.evaluate(() => {
    const cam = (window as unknown as HoverWindow).__epoch.camera;
    const at = cam.get();
    cam.set({ x: at.x + 5, z: at.z + 5 }, true);
  });
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as unknown as HoverWindow).__epoch.camera.render());
      return hoverState(page);
    })
    .toEqual({ id: null, cursor: '' });
});
