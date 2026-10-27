# CONTINUE HERE

**Branch:** `claude/determined-wright-c0aptv` · **PR:** https://github.com/JaredVogler2/Epoch60/pull/1 · Last verified commit: see `git log -1`.

## State

A complete 3-epoch loop is **playable in the browser** (Chromium-verified): title → plan → build → 60 s → collapse → debrief → interregnum (ruins, sites,
traditions) → next epoch → … → ending → Play again. 83 unit tests + 13 Playwright tests (desktop 1366×768 and iPhone-13 touch profile) pass; CI green.

## Pre-push gate (mandatory, no pipes)

`npm run typecheck && npm run lint && npm test && npm run build` — then `npx playwright test` for UI changes.

## Next exact steps (highest value first)

1. ~~Citizens and collapse cinematic~~ — DONE (see PROGRESS session 2b). Remaining polish: then-vs-now slider, fracture geometry, citizen personas.
2. **Phase 10/11 — ages & disasters:** enable Stone House / Levee / Dam / Retaining Wall / Forge / Bridge + hydrology/seismic techs with real effects, add Age II/III
   architecture variants (stone/brick vs thatch), flood water surface + quake visuals. Update `docs/GAME_RULES.md` and tables, hide until tested.
3. **Phase 12 gate:** tune Greenvale with bots (`src/engine/ai/bots.ts`) until two different routes win and no-action loses; record executed traces in `fixtures/`.
4. Mobile polish: 320×568 + landscape screenshots, one-row resource chips, WebKit run when available, measure FPS on a real device.

## Tooling you will use

- `npx vite --port 5173` then `node scripts/shot.mjs out.png --js "…" --cam "{x:..}"` for screenshots (default URL uses `?debug&still`: on-demand render
  avoids software-GL stalls). `scripts/showcase.js` builds a demo village.
- `npx vite-node scripts/campaign.ts 6001` runs a headless 3-epoch bot campaign; `scripts/hazardmap.ts` prints hazard ASCII maps.
- `window.__epoch` (only with `?debug` or dev): `store`, `camera.project(x,z)`, `findSpot`, `fastForward(n)`.
- Review screenshots are produced by E2E into git-ignored `docs/screenshots/`; compressed copies for review live in `docs/review/`.

## Gotchas

- Engine mutates in place; `cloneCampaign` before speculative work. `advanceFixedTick` is the only way time moves.
- Do not add `Math.random`/`Date.now` to `src/engine` (lint fails). UI state changes go through store methods that `emit()`.
- Playwright Chromium is preinstalled (v1243 ↔ Playwright 1.63.0); config passes SwiftShader flags. Software GL cannot sustain a continuous render loop at 1366×768,
  so tests use `?still`.
- Geometry primitives auto-orient triangles; do not hand-wind faces.
