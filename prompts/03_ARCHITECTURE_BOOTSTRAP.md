# Phase 03 — Create a real browser game scaffold, not a static concept site

## Tech stack

Fresh repo: Vite + React + TypeScript strict + Three.js + stable React Three Fiber + Drei, using WebGL2 by default. Before installing consult official current version compatibility: stable R3F v9 with React19; R3F v10 alpha should not be selected accidentally. Use native DOM React for accessible HUD and R3F for 3D only. Vitest unit/integration, Playwright Chromium & WebKit mobile-like E2E, ESLint and prettier. Optional small state library if useful, but deterministic engine must remain plain TS without React dependencies. Vercel static build, no mandatory login/server.

Scripts: dev, build, preview, typecheck, lint, test, test:e2e, test:sim and any snapshot/test:visual target. Lockfile and .gitignore, GitHub Actions CI for typecheck/unit/build; versioned root README and docs/PROGRESS.md. If assets created, store source/licenses.

## Architectural seams

src/engine/core: fixed tick reducer, action validation, seeded PRNG, events, state hash.
src/engine/economy: buildings, population, production, labor/resource transfer.
src/engine/world: geographic grid/elevation, forest/soil/water/minerals, hazards.
src/engine/legacy: cataclysm, survival, decay, physical & cultural inheritance, archaeology.
src/engine/ages: tech graph, era transitions and endings.
src/engine/content: versioned validated scenario/building/disaster data.
src/engine/save: serialize/migrate, local game history and deterministic command log.
src/engine/ai: scripted strategies, tournament/seed validation.
src/render: canvas, camera, heightfield, water, buildings, citizens, ruins, particles, optimization.
src/ui: title, game shell, epoch clock, build/action tray, inspector, research, debrief, interregnum.
src/audio: original sound effects/soundscape.
tests/: headless engine, browser E2E, visual states, perf.

## Typed API

createCampaign(seed, mode, difficulty); getLegalActions(state, selection); startEpoch(state); dispatchAction(state, tickStampedAction); advanceFixedTick(state); collapseEpoch(state); startNextEpoch(state, foundingChoice); getRenderSnapshot(state); getEventHistory(state); serialize/deserialize; replayCampaign(seed, version, actions); computeHash(state). Use type-checked error unions with legal alternatives and reason codes. Export schema version and content version to support replays after upgrades.

## Renderer rule

State changes originate ONLY from engine action/ticks. 3D renderer reads projections and interpolates between engine positions; it must never decide food growth, disaster destruction, heritage survival or who lives. No Math.random, Date.now or frame rate in engine. Use stable coordinate conversion. Scene should be *real 3D* with a flattering view and interactive picking; a plane and cubes are scaffolding ONLY and cannot ship as final.

## Minimal actually working path

Working initial title with New/Continue/How to Play/Settings; hero 3D valley; central HUD (epoch, 60-second clock, 3–5 resource chips); at least one real buildable structure with resources consumed and render updates; Start -> 60s engine ticks -> end cataclysm -> debrief -> Next Epoch with persistent changed state. No placeholder buttons on core flow. Use developer clock multiplier only for tests, not normal scoring.

## Temporal plan

10 ticks/s example → 600 ticks per active epoch. RAF accumulates wall time to feed deterministic ticks while foreground and unpaused, but no simulation when tab hidden. Input event records accepted tick plus monotonic sequence. Save after meaningful actions/checkpoints, restore same tick. Rig a headless simulation runner to bypass waiting in test CLI; no reliance on browser timers for deterministic QA.

## Tests

Fresh npm ci and standard scripts run. Seed=0 deterministic; resource costs, tick/clock 600 exact, pause/visibility freeze, build preview legal vs illegal, saved state roundtrip, epoch2 world differs because of persistent actions, switching render doesn't modify state, one Playwright route visits title→world and clicks an actual build action. Test unmount/navigation cleanup with no duplicate canvases. No runtime console errors. Commit app in runnable state and proceed.