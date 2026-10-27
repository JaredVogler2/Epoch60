# CONTINUE HERE

**Branch:** `claude/determined-wright-c0aptv` · **Last verified commit:** see `git log -1` (docs updated in the same commit).

## State

Engine foundation is complete and tested (70 passing tests). There is **no browser UI yet**.

## Last successful commands

`npx tsc --noEmit && npx eslint . && npx vitest run` → all green (70 tests). `npx vite-node scripts/campaign.ts 6001` → 3 epochs, verdict reached.

## Next exact steps (Phase 03)

1. `src/main.tsx`, `src/App.tsx`: title screen (New / Continue / How to Play / Settings) → game shell.
2. `src/ui/store.ts`: one mutable `Campaign` + revision counter via `useSyncExternalStore`; controller wraps dispatch + RAF tick accumulator (phase 04).
3. `src/render/`: R3F `<Canvas>`: terrain mesh from `world.height`, river, trees (instanced), `Structure` meshes by kind. Keep scene read-only.
4. HUD: epoch clock (tenths), 4 resource chips + pop, bottom build tray from `getCatalog(c)`, ghost placement via `checkPlacement`.
5. Playwright `e2e/`: title → world → Begin → place Farm → resource decreases → construction appears; capture screenshots (seed 6001).

## Pre-push gate (mandatory)

`npm run typecheck && npm run lint && npm test && npm run build` — no `| tail`/pipes (they hide exit codes). CI runs the same four steps.

## Gotchas

- Engine mutates in place; clone with `cloneCampaign` before speculative work.
- `advanceFixedTick` is the only way time moves. Controller must auto-pause on `visibilitychange`.
- Do not add Math.random/Date.now to `src/engine` (lint will fail).
- Chromium for Playwright is preinstalled at /opt/pw-browsers (v1243 ↔ Playwright 1.63.0). Use SwiftShader flags in `playwright.config.ts`.
