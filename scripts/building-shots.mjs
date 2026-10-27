// Close-up catalog of every structure in the Age showcase village, one capture each (architecture QA).
//   node scripts/building-shots.mjs <tag> [--w 900] [--h 640] [--only cottage,stone_house]
// Writes docs/screenshots/buildings/<tag>/<kind>-<id>.png (git-ignored). Software GL: look, not speed.
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const tag = args[0] ?? 'latest';
const opt = (name, d) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : d;
};
const w = Number(opt('w', 900));
const h = Number(opt('h', 640));
const only = opt('only', '')
  .split(',')
  .filter(Boolean);
const showcaseAges = readFileSync(new URL('./showcase-ages.js', import.meta.url), 'utf8');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:4173/?debug&still&quality=high', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__epoch);
await page.evaluate(showcaseAges.replace('e.runTicks(c, 590);', 'e.runTicks(c, 240);'));
await page.evaluate(() =>
  document.head.insertAdjacentHTML(
    'beforeend',
    '<style>.overlay.pause,.story,.collapse-overlay,.hud{display:none!important}</style>',
  ),
);
const list = await page.evaluate(() =>
  window.__epoch.store.campaign.structures
    .filter((s) => s.status === 'active' || s.status === 'damaged')
    .map((s) => ({ id: s.id, kind: s.kind, x: s.x + s.w / 2, z: s.y + s.h / 2, size: Math.max(s.w, s.h) })),
);
const dir = `docs/screenshots/buildings/${tag}`;
mkdirSync(dir, { recursive: true });
const seen = new Set();
for (const s of list) {
  if (only.length && !only.includes(s.kind)) continue;
  if (seen.has(s.kind) && s.kind !== 'cottage' && s.kind !== 'stone_house') continue;
  seen.add(s.kind);
  await page.evaluate(
    (c) => window.__epoch.camera.set(c, true),
    { x: s.x, z: s.z, dist: 4.5 + s.size * 1.6, polar: 0.62, az: 0.55 },
  );
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__epoch.camera.render());
    await page.waitForTimeout(2200);
  }
  const out = `${dir}/${s.kind}-${s.id}.png`;
  await page.screenshot({ path: out });
  console.log(out);
}
await browser.close();
