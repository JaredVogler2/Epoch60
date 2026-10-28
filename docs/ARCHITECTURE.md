# Architecture

```
src/engine/      Plain TypeScript, no React/DOM, no Math.random/Date.now (lint-enforced). Authoritative.
  core/          constants (incl. RULES/CONTENT/SCHEMA versions), types, seeded PRNG (sfc32), stable hash, event log
  content/       BuildingDef, TechDef, TraditionDef, Scenario/Epoch/Hazard data and difficulty tiers
  world/         generate (valley + validation), hazards (fire, flood, quake, ash), query helpers
  economy/       placement, labor, production, population, research, structure helpers, site suggestions
  events/        story decisions (state-derived prompts with a free default at the deadline)
  legacy/        collapse (resolve once, casualties, retention, report, verdict), inheritance (time-skip, archaeology,
                 sites and traditions, founding), feats (awarded at the moment they happen, kept in lineage.feats)
  ai/            findSpot, priority-list bot framework, baseline policies and the scripted routes (Engineers, Archivists)
  save/          computeHash, serialize/deserialize (integrity hash + shape validation), transcript + replay
  campaign.ts    createCampaign, dispatchAction, advanceFixedTick, getCatalog, getForecast, repairBlocked
src/game/        Browser-side state around the engine: store (one mutable campaign + revisions), clock (frames → ticks,
                 stall/visibility pauses), persist (save, settings, Daily tag), modes (seeds, share links, run cards),
                 codex (device-local copy of earned feats), audio
src/render/      React Three Fiber scene — a READ-ONLY projection of engine state:
                 Scene (canvas, lights, tone mapping, context-loss recovery), atmosphere (shared clock/wind/clouds injected
                 into materials), Sky, terrain + water, Foliage + Outskirts + models/, Structures, SmokeField, Birds,
                 Citizens, CollapseFx + FrontFx + presentation (the collapse cinematic, render-only), Overlays (forecast,
                 placement), CameraRig, Post (high-tier tilt-shift + grade), quality tiers + frame-time governor
src/ui/          DOM HUD, tray, inspector and panels, debrief, interregnum, ending (Atlas of Ages, feats, ideas for the
                 next lineage), title (incl. the Codex); useDialog (modal focus); Fallback (error boundary, no-WebGL screen)
tests/engine/    Vitest headless engine suites (incl. replayed route fixtures)
tests/game/      Vitest suites for the browser-side state (clock, governor, modes, persistence, store)
e2e/             Playwright desktop 1366×768 + iPhone-13 touch profile journeys
scripts/         vite-node / node tools: traces, tournament (sim.ts), visual and perf captures, maps, doc generation
fixtures/        recorded transcripts of the scripted routes and of the feat runs (fixtures/feats/), replayed by tests
                 (headless and in the browser)
```

## Rules of the seam

1. **State changes only through the engine.** `dispatchAction` validates and queues; `advanceFixedTick` applies. The renderer never decides
   food, damage, survival or who lives; the collapse cinematic only _shows_ a report the engine already resolved.
2. **The engine mutates a `Campaign` in place** for speed (bots run thousands of epochs). Use `cloneCampaign` (structuredClone) for branching.
   The UI holds one mutable campaign plus revision counters and reads it through selectors.
3. **Determinism:** integer fixed-point economy; IEEE-exact arithmetic for anything that reaches hashed state (no `Math.sin/pow/exp/hypot`
   there — `Math.sqrt` of integers and integer tables instead); insertion-ordered iteration; seeded PRNG streams. Same seed + same accepted-action
   log ⇒ same `computeHash`.
4. **Forecast = resolution.** `resolveHazard` is a pure projection used by both the live overlay and the final collapse.
5. **Saves are integrity-checked** (hash of the campaign), shape-validated on load (unknown scenario, difficulty, phase, mode or an out-of-range
   epoch/tick is rejected), versioned (`SCHEMA_VERSION`), and an ACTIVE save always reloads paused.

## Public API (`src/engine/index.ts`)

`createCampaign(seed, mode, scenario, difficulty)` · `dispatchAction(c, action)` · `advanceFixedTick(c)` · `runTicks(c, n)` ·
`setPaused(c, bool)` · `getCatalog(c)` · `getForecast(c)` · `checkPlacement(c, kind, x, y, rot)` · `repairBlocked(c, s)` / `repairCost(s)` ·
`collapseEpoch(c)` · `computeHash(c)` · `serialize/deserialize` · `transcriptOf(c)` / `replayCampaign(t)` · `cloneCampaign(c)`.
