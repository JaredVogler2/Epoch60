import { chromium } from '@playwright/test';
const q = process.argv[2] ?? 'low';
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await (
  await browser.newContext({
    viewport: { width: Number(process.argv[3] ?? 1366), height: Number(process.argv[4] ?? 768) },
  })
).newPage();
await page.goto(`http://127.0.0.1:5173/?debug&still&quality=${q}`);
await page.waitForFunction(() => !!window.__epoch);
await page.evaluate(() => {
  const e = window.__epoch;
  e.store.newGame(6001);
  e.store.dispatch({ type: 'beginEpoch' });
});
const t0 = Date.now();
await page.waitForTimeout(6000);
const r = await page.evaluate(() => {
  const c = window.__epoch.store.campaign;
  return { tick: c.tick, paused: c.paused, reason: window.__epoch.store.pauseReason };
});
console.log(q, 'after', (Date.now() - t0) / 1000, 's real ->', r);
await browser.close();
