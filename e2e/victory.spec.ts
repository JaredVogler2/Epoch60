import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { campaign, openGame, shot, startNewGame } from './helpers';

type Entry = { tick: number; seq: number; epoch: number; action: Record<string, unknown> };
type Transcript = {
  seed: number;
  scenario: string;
  actions: Entry[];
  totalTicks: number;
  finalHash: string;
};

const load = (dir: string, name: string): Transcript =>
  JSON.parse(readFileSync(`fixtures/${dir}/${name}.json`, 'utf8')) as Transcript;

/** Each route's legacy, as `tests/engine/legacy-score.test.ts` pins it from the same recorded lineage. */
const CASES = [
  ['greenvale', 'engineers', 2420],
  ['greenvale', 'archivists', 3030],
  ['ashen', 'engineers', 2650],
  ['ashen', 'archivists', 2530],
  ['ashen', 'ecologists', 2500],
] as const;

/**
 * Plays a recorded winning route through the browser's own store (same dispatch the buttons use) and checks the
 * browser reaches the same final state as the headless engine, and that the victory screen tells the truth.
 * The replay runs inside one synchronous evaluate so the real-time clock cannot interleave extra ticks.
 */
for (const [dir, route, legacy] of CASES) {
  test(`${dir}: the ${route} route wins in the browser with the recorded hash`, async ({ page }, info) => {
    const t = load(dir, route);
    await openGame(page);
    await startNewGame(page);
    await page.evaluate(
      ([seed, scenario, actions]) => {
        const e = (
          window as unknown as {
            __epoch: {
              store: {
                newGame: (seed: number, mode: undefined, scenario: string) => void;
                campaign: { phase: string; tick: number };
                dispatch: (a: unknown, o: { quiet: boolean }) => { ok: boolean; message?: string };
              };
              fastForward: (n: number) => number;
            };
          }
        ).__epoch;
        e.store.newGame(seed, undefined, scenario);
        const c = () => e.store.campaign;
        for (const entry of actions as Entry[]) {
          while (c().phase === 'ACTIVE' && c().tick < entry.tick) {
            if (!e.fastForward(Math.min(25, entry.tick - c().tick))) break;
          }
          const r = e.store.dispatch(entry.action, { quiet: true });
          if (!r.ok) throw new Error(`replay refused ${JSON.stringify(entry.action)}: ${r.message}`);
        }
      },
      [t.seed, t.scenario, t.actions] as const,
    );
    await expect.poll(() => campaign(page, (c) => c.phase)).toBe('VICTORY');
    expect(
      await page.evaluate(() => (window as unknown as { __epoch: { hash: () => string } }).__epoch.hash()),
    ).toBe(t.finalHash);
    await expect(page.getByTestId('end')).toBeVisible();
    await expect(page.getByTestId('end-title')).toHaveText('The cycle is broken');
    // The ending's legacy counts what lasted, the same number the headless engine gives.
    await expect(page.getByTestId('legacy-total')).toHaveText(String(legacy));
    await expect(page.getByTestId('legacy').locator('li')).toHaveCount(4);
    await expect(page.getByTestId('legacy-people')).toContainText('came through the last catastrophe');
    // The chronicle tells the most storied works' lives from what the engine recorded, ending with how each stands.
    const works = await page.getByTestId('chronicle-work').allInnerTexts();
    expect(works.length).toBeGreaterThan(0);
    for (const w of works)
      expect(w).toMatch(
        /^The .+ at \(\d+,\d+\)\. .+ (It stands|It lies buried|It lies in ruins|The work on it was unfinished when the end came)\.$/,
      );
    await shot(page, info, `victory-${dir}-${route}`);
  });
}
