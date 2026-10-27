// Usage: node scripts/collapse-shots.mjs <hazard: fire|flood|quake> [w] [h]
// Builds a showcase village in the chosen epoch, runs it to collapse, then captures the cinematic at fixed progress points.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const hazard = process.argv[2] ?? 'fire';
const w = Number(process.argv[3] ?? 1366);
const h = Number(process.argv[4] ?? 768);
const epoch = hazard === 'flood' ? 1 : hazard === 'quake' ? 2 : 0;
const showcase = readFileSync(new URL('./showcase.js', import.meta.url), 'utf8');

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/?debug&still&quality=low');
await page.waitForFunction(() => !!window.__epoch);
await page.evaluate(`(() => { window.__EPOCH_IDX = ${epoch}; })()`);
await page.evaluate(
  showcase.replace(
    'e.store.newGame(6001);',
    `e.store.newGame(6001); if (${epoch} > 0) { e.store.campaign.epoch = ${epoch}; }`,
  ),
);
await page.evaluate(() => {
  const e = window.__epoch;
  e.store.resume();
  e.fastForward(700);
});
const info = await page.evaluate(() => ({
  phase: window.__epoch.store.campaign.phase,
  tick: window.__epoch.store.campaign.tick,
}));
console.log(hazard, info);
await page.waitForTimeout(1500);
await page.evaluate(() =>
  window.__epoch.camera.set({ x: 17.5, z: 15.5, dist: 22, polar: 0.8, az: 0.3 }, true),
);
for (const t of [0.02, 0.2, 0.4, 0.6, 0.84, 1.0]) {
  await page.evaluate((v) => {
    window.__epoch.presentation.override = v;
    window.__epoch.camera.render();
  }, t);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__epoch.camera.render());
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: `/tmp/shots/collapse-${hazard}-${String(Math.round(t * 100)).padStart(3, '0')}.png`,
  });
  console.log('t', t);
}
await browser.close();
