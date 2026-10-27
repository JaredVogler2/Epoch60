# Architecture

```
src/engine/      Plain TypeScript, no React/DOM, no Math.random/Date.now (lint-enforced). Authoritative.
  core/          constants, types, seeded PRNG (sfc32), stable hash, event log
  content/       BuildingDef, TechDef, Tradition, Scenario/Epoch/Hazard data
  world/         generate (valley + validation), hazards (fire/flood/quake), query helpers
  economy/       placement, labor, production, population, research, structure helpers
  legacy/        collapse (resolve once, casualties, retention, report), inheritance (time-skip, archaeology, founding)
  ai/            findSpot, priority-list bot framework (baselines now; strategy bots in phase 12/15)
  save/          computeHash, serialize/deserialize (integrity-checked), transcript + replay
  campaign.ts    createCampaign, dispatchAction, advanceFixedTick, getCatalog, getForecast
src/render/      (phase 03+) React Three Fiber scene — READ-ONLY projection of engine state
src/ui/          (phase 03+) DOM HUD, tray, debrief, interregnum
tests/engine/    Vitest headless engine suites
e2e/             Playwright desktop + iPhone-sized journeys
scripts/         vite-node dev tools (maps, playthroughs, doc generation)
```

## Rules of the seam

1. **State changes only through the engine.** `dispatchAction` validates and queues; `advanceFixedTick` applies. The renderer never decides
   food, damage, survival or who lives.
2. **The engine mutates a `Campaign` in place** for speed (bots run thousands of epochs). Use `cloneCampaign` (structuredClone) for branching.
   The UI holds one mutable campaign plus a revision counter and reads it through selectors.
3. **Determinism:** integer fixed-point economy, IEEE-exact arithmetic only in generation (no `Math.sin/pow/exp`), insertion-ordered iteration,
   seeded PRNG streams. Same seed + same accepted-action log ⇒ same `computeHash`.
4. **Forecast = resolution.** `resolveHazard` is a pure projection used by both the live overlay and the final collapse.
5. **Saves are integrity-checked** (hash of the campaign), versioned (`SCHEMA_VERSION`), and an ACTIVE save always reloads paused.

## Public API (`src/engine/index.ts`)

`createCampaign(seed, mode, scenario)` · `dispatchAction(c, action)` · `advanceFixedTick(c)` · `runTicks(c, n)` · `setPaused(c, bool)` ·
`getCatalog(c)` · `getForecast(c)` · `checkPlacement(c, kind, x, y, rot)` · `collapseEpoch(c)` · `computeHash(c)` · `serialize/deserialize` ·
`transcriptOf(c)` / `replayCampaign(t)` · `cloneCampaign(c)`.
