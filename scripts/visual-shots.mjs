// Repeatable visual QA captures: the same scenes, cameras and viewports every time, so iterations can be compared.
//   npm run build && npx vite preview --port 4173 &
//   node scripts/visual-shots.mjs <tag> [--set core|full] [--scenes title,start,place,village,collapse] [--quality high]
// Writes PNGs to docs/screenshots/visual/<tag>/<scene>-<viewport>.png (git-ignored) and prints console errors.
// Rendering is software GL (SwiftShader) here: the images show composition, colour and geometry, not frame rate.
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const tag = args[0] ?? 'latest';
const opt = (name, d) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : d;
};
const base = opt('url', 'http://127.0.0.1:4173');
const quality = opt('quality', 'high');
const set = opt('set', 'core');
const tone = opt('tone', '');

const VIEWPORTS = {
  'desktop-1920x1080': { width: 1920, height: 1080, dpr: 1, touch: false },
  'desktop-1440x900': { width: 1440, height: 900, dpr: 1, touch: false },
  'laptop-1366x768': { width: 1366, height: 768, dpr: 1, touch: false },
  'iphone-390x844': { width: 390, height: 844, dpr: 2, touch: true },
  'iphone-393x852': { width: 393, height: 852, dpr: 2, touch: true },
  'iphone-landscape-844x390': { width: 844, height: 390, dpr: 2, touch: true },
  'small-360x740': { width: 360, height: 740, dpr: 2, touch: true },
};
const SETS = {
  core: ['laptop-1366x768', 'iphone-390x844', 'iphone-landscape-844x390'],
  full: Object.keys(VIEWPORTS),
};
const vps = (opt('viewports', '') || SETS[set].join(',')).split(',');
const scenes = opt('scenes', 'title,start,place,village,collapse').split(',');

const showcaseAges = readFileSync(new URL('./showcase-ages.js', import.meta.url), 'utf8');
const showcase = readFileSync(new URL('./showcase.js', import.meta.url), 'utf8');

const portrait = (vp) => vp.height > vp.width;
const HIDE_PAUSE = '<style>.overlay.pause{display:none!important}</style>';
// Scene-only captures hide transient cards (story decisions, collapse title) that would cover the village.
const HIDE_CARDS = '<style>.story,.collapse-overlay{display:none!important}</style>';

async function render(page, times = 2) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.__epoch.camera.render());
    await page.waitForTimeout(Number(process.env.RENDER_WAIT ?? 2500));
  }
}

const SCENES = {
  // First impression: the title over the living valley.
  title: async () => {},
  // A fresh lineage: what a player sees before the first order.
  start: async (page) => {
    await page.getByTestId('new-game').click();
    await page.getByTestId('hud').waitFor();
  },
  // After an interaction: a building chosen and a site suggested (ghost + placement bar).
  place: async (page) => {
    await page.getByTestId('new-game').click();
    await page.getByTestId('hud').waitFor();
    await page.getByTestId('card-cottage').click();
    await page.getByTestId('next-spot').click();
  },
  // The richest composition: a village showing all three ages and the engineering works.
  village: async (page, vp) => {
    // Mid-epoch calm (the stock showcase runs to the collapse): same village, ordinary daylight.
    await page.evaluate(showcaseAges.replace('e.runTicks(c, 590);', 'e.runTicks(c, 240);'));
    await page.evaluate(
      (html) => document.head.insertAdjacentHTML('beforeend', html),
      HIDE_PAUSE + HIDE_CARDS,
    );
    const cam = portrait(vp)
      ? { x: 17.5, z: 16.5, dist: 36, polar: 0.98, az: 0.35 }
      : { x: 17.5, z: 16, dist: 27, polar: 0.86, az: 0.35 };
    await page.evaluate((c) => window.__epoch.camera.set(c, true), cam);
  },
  // Close on the houses: architecture, roofs, windows, smoke, people.
  closeup: async (page, vp) => {
    await page.evaluate(showcaseAges.replace('e.runTicks(c, 590);', 'e.runTicks(c, 240);'));
    await page.evaluate(
      (html) => document.head.insertAdjacentHTML('beforeend', html),
      HIDE_PAUSE + HIDE_CARDS,
    );
    const cam = portrait(vp)
      ? { x: 17.5, z: 16.5, dist: 19, polar: 0.82, az: 0.6 }
      : { x: 17.5, z: 16, dist: 14, polar: 0.62, az: 0.6 };
    await page.evaluate((c) => window.__epoch.camera.set(c, true), cam);
  },
  // An animated event: the wildfire front halfway through the collapse cinematic.
  collapse: async (page, vp) => {
    await page.evaluate(showcase);
    await page.evaluate(() => {
      const e = window.__epoch;
      e.store.resume();
      e.fastForward(700);
    });
    await page.waitForTimeout(800);
    const cam = portrait(vp)
      ? { x: 17.5, z: 15.5, dist: 30, polar: 0.95, az: 0.3 }
      : { x: 17.5, z: 15.5, dist: 22, polar: 0.8, az: 0.3 };
    await page.evaluate((c) => window.__epoch.camera.set(c, true), cam);
    await page.evaluate(() => {
      window.__epoch.presentation.override = 0.45;
    });
  },
};

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const dir = `docs/screenshots/visual/${tag}`;
mkdirSync(dir, { recursive: true });
const problems = [];
for (const vpName of vps) {
  const vp = VIEWPORTS[vpName];
  if (!vp) throw new Error(`unknown viewport ${vpName}`);
  for (const scene of scenes) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: vp.touch,
      isMobile: vp.touch,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${vpName}/${scene} pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('GPU stall'))
        problems.push(`${vpName}/${scene}: ${m.text()}`);
    });
    const t0 = Date.now();
    await page.goto(`${base}/?debug&still&quality=${quality}${tone ? `&tone=${tone}` : ''}`, {
      waitUntil: 'load',
    });
    await page.waitForFunction(() => !!window.__epoch, null, { timeout: 20000 });
    await SCENES[scene](page, vp);
    await render(page);
    const out = `${dir}/${scene}-${vpName}.png`;
    await page.screenshot({ path: out });
    console.log(`${out}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    await ctx.close();
  }
}
await browser.close();
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
else console.log('no console errors');
