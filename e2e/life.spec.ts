import { expect, test } from '@playwright/test';
import { fastForward, openGame, startNewGame } from './helpers';

type LifeWindow = {
  __epoch: {
    store: {
      campaign: {
        civ: { pop: number };
        structures: { kind: string; status: string; workers: number }[];
      };
      dispatch: (a: Record<string, unknown>) => { ok: boolean };
      pause: (reason: string) => void;
    };
    camera: { render: () => void };
    findSpot: (
      c: unknown,
      kind: string,
      opts: Record<string, unknown>,
    ) => { x: number; y: number; rot: 0 | 1 } | null;
    citizens: () => { role: string; moving: boolean }[];
  };
};

test('the villagers mirror the engine: each job shows as many people as the engine puts to work', async ({
  page,
}) => {
  await openGame(page);
  await startNewGame(page);
  await page.evaluate(() => {
    const e = (window as unknown as LifeWindow).__epoch;
    const plans: [string, Record<string, unknown>][] = [
      ['farm', { maxDist: 7, avoidHazard: true }],
      ['lumber_camp', { maxDist: 12 }],
    ];
    for (const [kind, opts] of plans) {
      const sp = e.findSpot(e.store.campaign, kind, opts);
      if (sp) e.store.dispatch({ type: 'build', kind, x: sp.x, y: sp.y, rot: sp.rot });
    }
    e.store.dispatch({ type: 'beginEpoch' });
  });
  await fastForward(page, 250);
  // Paused, people stand still but are still given their work a few times a second.
  await page.evaluate(() => (window as unknown as LifeWindow).__epoch.store.pause('user'));
  const expected = await page.evaluate(() => {
    const c = (window as unknown as LifeWindow).__epoch.store.campaign;
    const JOB: Record<string, string> = {
      farm: 'farmer',
      lumber_camp: 'lumberjack',
      quarry: 'quarryman',
      archive: 'scholar',
    };
    const n: Record<string, number> = {};
    let busy = 0;
    for (const s of c.structures) {
      if (s.workers <= 0) continue;
      const role =
        s.status === 'constructing'
          ? 'builder'
          : s.status === 'active' || s.status === 'damaged'
            ? (JOB[s.kind] ?? 'builder')
            : null;
      if (!role) continue;
      n[role] = (n[role] ?? 0) + s.workers;
      busy += s.workers;
    }
    const idle = Math.min(c.civ.pop, 40) - busy;
    if (idle > 0) n.idle = idle;
    return n;
  });
  expect(Object.keys(expected).length).toBeGreaterThan(1);
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as unknown as LifeWindow).__epoch.camera.render());
      return page.evaluate(() =>
        (window as unknown as LifeWindow).__epoch
          .citizens()
          .reduce<Record<string, number>>((m, x) => ((m[x.role] = (m[x.role] ?? 0) + 1), m), {}),
      );
    })
    .toEqual(expected);
});
