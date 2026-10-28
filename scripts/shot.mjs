// Usage: node scripts/shot.mjs <out.png> [--w 1366] [--h 768] [--dpr 1] [--js "code"] [--wait 1500] [--url http://127.0.0.1:5173/?debug]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const out = args[0];
const opt = (name, d) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : d;
};
const w = Number(opt('w', 1366));
const h = Number(opt('h', 768));
const dpr = Number(opt('dpr', 1));
const wait = Number(opt('wait', 2500));
const url = opt('url', 'http://127.0.0.1:5173/?debug&still');
const js = opt('js', '');
const touch = opt('touch', '0') === '1';
const cam = opt('cam', '');

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: dpr,
  hasTouch: touch,
  isMobile: touch,
  // Scripts run with --js may inject styles; the preview's production CSP would refuse them.
  bypassCSP: true,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__epoch, null, { timeout: 15000 });
if (js) await page.evaluate(js);
await page.waitForTimeout(wait);
if (cam) await page.evaluate(`window.__epoch.camera.set(${cam}, true)`);
const frames = Number(opt('frames', 1));
for (let i = 0; i < frames; i++) {
  await page.evaluate(() => window.__epoch.camera.render());
  await page.waitForTimeout(Number(process.env.RENDER_WAIT ?? 4000));
}
await page.screenshot({ path: out });
console.log(
  logs
    .filter((l) => !l.includes('GPU stall'))
    .slice(0, 15)
    .join('\n'),
);
await browser.close();
console.log('saved', out);
