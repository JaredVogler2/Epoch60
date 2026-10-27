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

/**
 * Plays a recorded winning route through the browser's own store (same dispatch the buttons use) and checks the
 * browser reaches the same final state as the headless engine, and that the victory screen tells the truth.
 * The replay runs inside one synchronous evaluate so the real-time clock cannot interleave extra ticks.
 */
const CASES = [
  ['greenvale', 'engineers'],
  ['greenvale', 'archivists'],
  ['ashen', 'engineers'],
  ['ashen', 'archivists'],
] as const;
for (const [dir, route] of CASES) {
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
    await shot(page, info, `victory-${dir}-${route}`);
  });
}
