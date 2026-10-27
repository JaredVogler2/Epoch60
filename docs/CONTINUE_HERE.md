# CONTINUE HERE

**Branch:** `claude/determined-wright-c0aptv` · **PR:** https://github.com/JaredVogler2/Epoch60/pull/3 (PRs #1 and #2 were merged; #2 merged a minute after it opened, so later commits needed a new PR) · Last verified commit: see `git log -1`.

## State

The 3-epoch loop is **playable in the browser and winnable two different ways** (Chromium-verified): title → plan → build → 60 s → collapse cinematic → debrief → interregnum
(ruins, survey/excavate, sites, traditions) → next age → … → ending → Play again. Ages change the architecture (thatch → tile → slate); 16 buildings and 9 techs have tested effects;
six state-derived story decisions appear as a deadline chip; two executed winning routes (Engineers, Archivists) and credible losses are recorded in `fixtures/greenvale/` and replayed
headless (`tests/engine/routes.test.ts`) and in the browser (`e2e/victory.spec.ts`). 140 unit tests + Playwright on desktop 1366×768 and an iPhone-13 touch profile.

## Pre-push gate (mandatory, no pipes)

`npm run typecheck && npm run lint && npm test && npm run build` — then `npx playwright test` for UI changes. After any rules/content change:
`npx vite-node scripts/record-traces.ts` and **read the diff of `fixtures/greenvale-traces.md`** (a route that stopped winning must be understood, not silently re-recorded).

## Next exact steps (highest value first)

1. **Phase 15 — run the tournament at scale:** `npx vite-node scripts/sim.ts --seeds 200 --report docs/BALANCE_REPORT.md` (≈ 10 s per seed; the Engineers bot dominates the time). Add difficulty tiers
   (the first 20 seeds are won by both tuned routes, so Normal is easy for competent play), the paired experiments A–H from `prompts/15_*.md` as permanent tests, and cache hazard maps in the bots.
2. **Phase 17 — mobile / accessibility / performance:** 320×568 and landscape screenshots, tray with 15 cards, reduced-motion E2E, keyboard-only loop, DOM alternative to raycast placement,
   quality profiles with measured frame times (real device if ever available), WebKit when installed (`EPOCH_WEBKIT=1`).
3. **Phase 14 — polish:** audio (Web Audio, mute/volume, iOS unlock), citizen outfits per age, Age III skyline, flood-edge and quake fracture geometry, then-vs-now slider.
4. **Phase 11 remainder:** a 4th disaster type (volcanic/toxic winter) with its own mechanics, more story decisions, NPC evacuation behaviour.
5. **Phase 13:** modes (Expeditions, Daily Ruins, Sandbox), ≥ 12 modifiers, 8–12 epoch campaign, share URLs, local run cards. **Phases 16, 18, 19:** meta, deployment (nothing is deployed yet), final adversarial review.

## Tooling you will use

- `npx vite --port 5173` then `node scripts/shot.mjs out.png --js "$(cat scripts/showcase-ages.js)" --cam "{x:17,z:16,az:0.4,polar:0.8,dist:24}"` for screenshots
  (default URL uses `?debug&still`: on-demand render avoids software-GL stalls). `scripts/showcase.js`, `showcase-ages.js`, `showcase-story.js` build demo villages.
- `npx vite-node scripts/routes.ts engineers --trace --epoch=1` traces a policy; `scripts/sim.ts` is the tournament; `scripts/hazardmap.ts` prints hazard ASCII maps;
  `scripts/campaign.ts` is the original scripted builder.
- `window.__epoch` (only with `?debug` or dev): `store`, `camera.project(x,z)`, `findSpot`, `fastForward(n)`, `hash()`.
- Review screenshots are produced by E2E into git-ignored `docs/screenshots/`; compressed copies for review live in `docs/review/`.

## Gotchas

- Engine mutates in place; `cloneCampaign` before speculative work (bots must never create structures on the live campaign: it shifts `nextId` and desyncs replays).
- `advanceFixedTick` is the only way time moves. Do not add `Math.random`/`Date.now` to `src/engine` (lint fails). UI state changes go through store methods that `emit()`.
- Playwright Chromium is preinstalled (v1243 ↔ Playwright 1.63.0); config passes SwiftShader flags. Software GL cannot sustain a continuous render loop at 1366×768, so tests use `?still`.
- Do not run `pkill -f "<pattern>"` with a pattern that appears in your own command line — it kills the shell.
- Geometry primitives auto-orient triangles; do not hand-wind faces.
- The first `npx playwright test` of a session rebuilds `dist`; do not edit `src/` until the preview server is up.
- PRs #1 and #2 are merged. Check `git rev-list --left-right --count origin/main...HEAD` before trusting that your branch has an open PR; if its PR was merged, merge `main` into the branch (a force-push was refused in this environment), push, and open a new PR.
