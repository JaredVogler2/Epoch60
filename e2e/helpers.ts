import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

export const URL = '/?debug&still&quality=low';

type EpochWindow = {
  __epoch: {
    store: {
      campaign: {
        phase: string;
        tick: number;
        epoch: number;
        paused: boolean;
        civ: {
          res: { food: number; timber: number; stone: number; knowledge: number };
          pop: number;
          techs: string[];
        };
        structures: {
          id: number;
          kind: string;
          x: number;
          y: number;
          w: number;
          h: number;
          status: string;
        }[];
        queue: unknown[];
        world: { anchors: { hearth: { x: number; y: number } } };
        report: { survivors: number } | null;
        lineage: { interregnum: { sites: unknown[] } | null };
      };
      placing: unknown;
      ghost: { ok: boolean } | null;
      pauseReason: string | null;
    };
    camera: {
      set: (p: Record<string, number>, instant?: boolean) => void;
      render: () => void;
      get: () => Record<string, number>;
      project: (x: number, z: number) => { x: number; y: number } | null;
    };
    findSpot: (
      c: unknown,
      kind: string,
      opts: Record<string, unknown>,
    ) => { x: number; y: number; rot: 0 | 1; w: number; h: number } | null;
    fastForward: (n: number) => number;
  };
};

export async function openGame(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as unknown as EpochWindow).__epoch);
  await expect(page.getByTestId('title')).toBeVisible();
}

/** Render frames until the camera has finished easing, so projections match what is on screen. */
export async function settle(page: Page): Promise<void> {
  let prev = '';
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => {
      const e = (window as unknown as EpochWindow).__epoch;
      e.camera.render();
      return JSON.stringify(e.camera.get());
    });
    await page.waitForTimeout(90);
    if (now === prev) break;
    prev = now;
  }
  await page.evaluate(() => (window as unknown as EpochWindow).__epoch.camera.render());
  await page.waitForTimeout(150);
}

export async function startNewGame(page: Page): Promise<void> {
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('hud')).toBeVisible();
  await settle(page);
}

export async function phase(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as EpochWindow).__epoch.store.campaign.phase);
}

export async function campaign<T>(
  page: Page,
  fn: (c: EpochWindow['__epoch']['store']['campaign']) => T,
): Promise<T> {
  return page.evaluate(`(${fn.toString()})(window.__epoch.store.campaign)`) as Promise<T>;
}

/** Pixel position of the centre of a footprint, projected through the live camera. */
export async function screenOf(
  page: Page,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(
    ([a, b]) => (window as unknown as EpochWindow).__epoch.camera.project(a!, b!),
    [x + w / 2, y + h / 2],
  );
  if (!p) throw new Error('projection failed');
  return p;
}

/**
 * Choose a building from the tray and place it on a legal site using the real pointer path:
 * mouse hover + click on desktop, tap + big Confirm button on touch devices.
 */
export async function placeBuilding(
  page: Page,
  kind: string,
  opts: Record<string, unknown> = {},
  touch = false,
): Promise<{ x: number; y: number }> {
  const spot = await page.evaluate(
    ([k, o]) => {
      const e = (window as unknown as EpochWindow).__epoch;
      return e.findSpot(e.store.campaign, k as string, o as Record<string, unknown>);
    },
    [kind, opts],
  );
  if (!spot) throw new Error(`no legal spot for ${kind}`);
  await page.getByTestId(`card-${kind}`).click();
  await expect(page.getByTestId('placebar')).toBeVisible();
  if (spot.rot === 1) await page.getByTestId('rotate').click();
  const pos = await screenOf(page, spot.x, spot.y, spot.w, spot.h);
  await page.evaluate(() => (window as unknown as EpochWindow).__epoch.camera.render());
  if (touch) {
    await page.touchscreen.tap(pos.x, pos.y);
    await page.evaluate(() => (window as unknown as EpochWindow).__epoch.camera.render());
    await expect(page.getByTestId('placebar')).toHaveClass(/ok/);
    await page.getByTestId('confirm-place').click();
  } else {
    await page.mouse.move(pos.x, pos.y);
    await page.waitForTimeout(150);
    await page.evaluate(() => (window as unknown as EpochWindow).__epoch.camera.render());
    const dbg = await page.evaluate(() => {
      const e = (window as unknown as EpochWindow).__epoch;
      const c = e.store.campaign;
      return JSON.stringify({
        epoch: c.epoch,
        hearths: c.structures.filter((s) => s.kind === 'hearth').map((s) => [s.x, s.y, s.status]),
        cam: e.camera.get(),
      });
    });
    const msg = (await page.getByTestId('place-msg').innerText()) + ' ' + dbg;
    await expect(
      page.getByTestId('placebar'),
      `hover ${kind} at ${JSON.stringify(spot)} px ${JSON.stringify(pos)}: ${msg}`,
    ).toHaveClass(/ok/);
    await page.mouse.click(pos.x, pos.y);
  }
  await expect(
    page.getByTestId('placebar'),
    `placing ${kind} at ${JSON.stringify(spot)} was not accepted`,
  ).toBeHidden();
  return pos;
}

export async function projectGround(page: Page, x: number, z: number): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(
    ([a, b]) => (window as unknown as EpochWindow).__epoch.camera.project(a as number, b as number),
    [x, z],
  );
  if (!p) throw new Error('projection failed');
  return p;
}

export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => (window as unknown as EpochWindow).__epoch.camera.render());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-${name}.png` });
}

export async function fastForward(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (window as unknown as EpochWindow).__epoch.fastForward(n), ticks);
}
