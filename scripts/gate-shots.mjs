// The Phase 19 visual gate's canonical captures (prompts/19 and prompts/QUALITY_GATE_VISUAL_AND_FUN.md), repeatable:
//   npm run build && npx vite preview --host 127.0.0.1 --port 4173 &
//   node scripts/gate-shots.mjs <tag> [--scenes mid,crisis] [--viewports laptop-1366x768] [--quality high]
//     [--fixture ashen/ecologists] [--focus 27.5,25]  (lineage scenes: look closely at that cell instead of the village)
// Every lineage scene is a recorded win (by default the Engineers', fixtures/greenvale/engineers.json: seed 6001,
// Greenvale, Normal) replayed through the browser's own store to a fixed age and tick, then paused (its card hidden) so the picture holds
// still; the camera is placed on that age's hearth with the pose below. Writes PNGs to docs/screenshots/gate/<tag>/
// (git-ignored) and prints console errors. Rendering is software GL (SwiftShader): stills, not frame rates.
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

const VIEWPORTS = {
  'desktop-1920x1080': { width: 1920, height: 1080, dpr: 1, touch: false },
  'laptop-1366x768': { width: 1366, height: 768, dpr: 1, touch: false },
  'iphone-390x844': { width: 390, height: 844, dpr: 2, touch: true },
  'small-320x568': { width: 320, height: 568, dpr: 2, touch: true },
};
const ALL = Object.keys(VIEWPORTS);
const LAPTOP = ['laptop-1366x768'];
const PHONES = ['iphone-390x844', 'small-320x568'];

const lineage = JSON.parse(
  readFileSync(new URL(`../fixtures/${opt('fixture', 'greenvale/engineers')}.json`, import.meta.url), 'utf8'),
);
const showcaseAges = readFileSync(new URL('./showcase-ages.js', import.meta.url), 'utf8');
const showcaseSpires = readFileSync(new URL('./showcase-spires.js', import.meta.url), 'utf8');

const portrait = (vp) => vp.height > vp.width;
const style = (page, css) =>
  page.evaluate((c) => document.head.insertAdjacentHTML('beforeend', `<style>${c}</style>`), css);
const HIDE_PAUSE = '.overlay.pause{display:none!important}';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/**
 * The pose for a scene: on a target cell, closer on wide screens, steeper on tall ones; far enough to hold a village
 * `extent` cells across.
 */
const pose = (vp, x, z, near = false, extent = 0) =>
  portrait(vp)
    ? {
        x,
        z: z + 0.5,
        dist: near ? 19 : clamp(extent * 2.1, 34, 46),
        polar: near ? 0.82 : 0.98,
        az: 0.35,
      }
    : { x, z, dist: near ? 14 : clamp(extent * 1.45, 26, 34), polar: near ? 0.62 : 0.86, az: 0.35 };

/**
 * Replays the recorded lineage to `stop` (an age and a tick in its minute, or a phase), as the buttons would, and
 * returns where the camera should look: the middle of everything built that is not buried (works and ruins), and how
 * many cells across that is.
 */
async function replayTo(page, stop) {
  return page.evaluate(
    ([t, stop]) => {
      const e = window.__epoch;
      e.store.newGame(t.seed, undefined, t.scenario, t.difficulty ?? 'normal');
      const c = () => e.store.campaign;
      const inTarget = () => c().epoch === stop.epoch && c().phase === 'ACTIVE';
      const advanceTo = (tick) => {
        while (c().phase === 'ACTIVE' && c().tick < tick)
          if (!e.fastForward(Math.min(25, tick - c().tick))) break;
      };
      for (const entry of t.actions) {
        if (
          stop.beforeFound !== undefined &&
          entry.action.type === 'found' &&
          entry.epoch === stop.beforeFound
        )
          break;
        if (stop.tick !== undefined && inTarget()) {
          advanceTo(Math.min(entry.tick, stop.tick));
          if (c().tick >= stop.tick) break;
        } else advanceTo(entry.tick);
        const r = e.store.dispatch(entry.action, { quiet: true });
        if (!r.ok) throw new Error(`replay refused ${JSON.stringify(entry.action)}: ${r.message}`);
      }
      if (stop.tick !== undefined && inTarget()) advanceTo(stop.tick);
      if (c().phase === 'ACTIVE') e.store.pause('user');
      // People stand where they were walking to, as they would after a minute in real time.
      e.settleCitizens();
      const seen = c().structures.filter((s) => s.status !== 'buried');
      const x0 = Math.min(...seen.map((s) => s.x));
      const x1 = Math.max(...seen.map((s) => s.x + s.w));
      const z0 = Math.min(...seen.map((s) => s.y));
      const z1 = Math.max(...seen.map((s) => s.y + s.h));
      return {
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        extent: Math.max(x1 - x0, z1 - z0),
        epoch: c().epoch,
        phase: c().phase,
        tick: c().tick,
      };
    },
    [lineage, stop],
  );
}

const focus = opt('focus', '')?.split(',').map(Number);

/** A lineage scene: replay, hold still, frame the village (or, with --focus, one spot up close). */
const at = (stop, extra) => async (page, vp) => {
  const r = await replayTo(page, stop);
  await style(page, HIDE_PAUSE);
  const view = focus?.length === 2 ? pose(vp, focus[0], focus[1], true) : pose(vp, r.x, r.z, false, r.extent);
  await page.evaluate((c) => window.__epoch.camera.set(c, true), view);
  if (extra) await extra(page, vp, r);
  return r;
};

// Each scene with the viewports it is captured at by default.
const SCENES = {
  // First impression: the title over the valley.
  title: [ALL, async () => {}],
  // The age begins (60 s): the briefing, the forecast and the tray before the first order.
  start: [
    ALL,
    async (page) => {
      await page.getByTestId('new-game').click();
      await page.getByTestId('hud').waitFor();
    },
  ],
  // Choosing where to build: the ghost on the terrain, its footprint and the placement bar.
  place: [
    ['laptop-1366x768', ...PHONES],
    async (page) => {
      await page.getByTestId('new-game').click();
      await page.getByTestId('hud').waitFor();
      await page.getByTestId('card-cottage').click();
      await page.getByTestId('next-spot').click();
    },
  ],
  // 35 s left in the first age: people at work, the village half built.
  mid: [ALL, at({ epoch: 0, tick: 250 })],
  // 3 s left: the warning, the forecast, what is about to burn.
  crisis: [ALL, at({ epoch: 0, tick: 570 })],
  // The later ages' last seconds: rain before the Great Flood, dust before the Great Quake.
  'crisis-flood': [LAPTOP, at({ epoch: 1, tick: 570 })],
  'crisis-quake': [LAPTOP, at({ epoch: 2, tick: 570 })],
  // The Great Fire mid-way through its cinematic, the outcome the engine resolved.
  collapse: [
    ['laptop-1366x768', 'iphone-390x844'],
    at({ epoch: 0, tick: 600 }, async (page) => {
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        window.__epoch.presentation.override = 0.45;
      });
    }),
  ],
  // Between ages, after the dig: the same valley with its ruins, the history lens and the founding choices.
  archaeology: [['laptop-1366x768', ...PHONES], at({ beforeFound: 0 })],
  // The second and third ages at 35 s left: the same river, new architecture, the first age's ruins.
  age2: [LAPTOP, at({ epoch: 1, tick: 250 })],
  age3: [['desktop-1920x1080', 'laptop-1366x768', 'iphone-390x844'], at({ epoch: 2, tick: 250 })],
  // The last age's last seconds with the interface hidden: what a route has built to meet its last catastrophe.
  last: [LAPTOP, at({ epoch: 2, tick: 570 }, (page) => style(page, '.hud{display:none!important}'))],
  // The third age with the interface hidden: the diorama alone.
  diorama: [
    ['desktop-1920x1080'],
    at({ epoch: 2, tick: 250 }, (page) => style(page, '.hud{display:none!important}')),
  ],
  // Close on the houses of every age (the showcase village): roofs, windows, doors, smoke, people.
  closeup: [
    LAPTOP,
    async (page, vp) => {
      await page.evaluate(showcaseAges.replace('e.runTicks(c, 590);', 'e.runTicks(c, 240);'));
      await style(page, HIDE_PAUSE + '.story,.collapse-overlay{display:none!important}');
      await page.evaluate((c) => window.__epoch.camera.set(c, true), pose(vp, 17.5, 16, true));
    },
  ],
  // The same village with a Granary of the first two ages beside the round huts: a store must not read as a home.
  granaries: [
    LAPTOP,
    async (page, vp) => {
      await page.evaluate(
        showcaseAges.replace(
          'e.runTicks(c, 590);',
          "put('granary', 0);\n  put('granary', 1);\n  c.epoch = 2;\n  e.runTicks(c, 240);",
        ),
      );
      await style(page, HIDE_PAUSE + '.story,.collapse-overlay{display:none!important}');
      await page.evaluate((c) => window.__epoch.camera.set(c, true), pose(vp, 17.5, 16, true));
    },
  ],
  // The latest architecture: the long chronicle's Age of Spires beside the Age of Iron.
  spires: [
    LAPTOP,
    async (page, vp) => {
      await page.evaluate(showcaseSpires);
      await page.evaluate((c) => window.__epoch.camera.set(c, true), pose(vp, 17.5, 16));
    },
  ],
};

const only = (opt('scenes', '') || Object.keys(SCENES).join(',')).split(',');
const vpFilter = opt('viewports', '');

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const dir = `docs/screenshots/gate/${tag}`;
mkdirSync(dir, { recursive: true });
const problems = [];
for (const scene of only) {
  const [vps, run] = SCENES[scene] ?? [];
  if (!run) throw new Error(`unknown scene ${scene}`);
  for (const vpName of vpFilter ? vpFilter.split(',').filter((v) => vps.includes(v)) : vps) {
    const vp = VIEWPORTS[vpName];
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: vp.touch,
      isMobile: vp.touch,
      // The preview sends the production CSP (`style-src 'self'`), which refuses the styles these captures inject to
      // hide cards; the captures bypass it (the game itself never injects a style).
      bypassCSP: true,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${scene}/${vpName} pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('GPU stall'))
        problems.push(`${scene}/${vpName}: ${m.text()}`);
    });
    const t0 = Date.now();
    await page.goto(`${base}/?debug&still&quality=${quality}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__epoch, null, { timeout: 20000 });
    const r = await run(page, vp);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.__epoch.camera.render());
      await page.waitForTimeout(Number(process.env.RENDER_WAIT ?? 2500));
    }
    const out = `${dir}/${scene}-${vpName}.png`;
    await page.screenshot({ path: out });
    const where = r ? ` age ${r.epoch + 1}, ${r.phase}, tick ${r.tick}` : '';
    console.log(`${out}${where}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    await ctx.close();
  }
}
await browser.close();
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
else console.log('no console errors');
