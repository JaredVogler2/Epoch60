# PROGRESS

Status vocabulary: NOT STARTED · IN PROGRESS · IMPLEMENTED UNVERIFIED · VERIFIED · BLOCKED · REOPENED.
Only claim VERIFIED with executed evidence recorded below.

| Phase                          | Status                                                                                                                                                                                                                                                              | Evidence                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01 Design bible / rules        | IMPLEMENTED (rules + content executable); route fixtures PROPOSED                                                                                                                                                                                                   | `docs/GAME_RULES.md`, `CONTENT_SPEC.md`, generated tables, `fixtures/greenvale-traces.md`   |
| 02 Economy, actions, tech      | VERIFIED for the implemented subset (9 buildings, 3 techs; rest hidden)                                                                                                                                                                                             | `tests/engine/{economy,hazards,legacy}.test.ts`                                             |
| 03 Architecture / app scaffold | **VERIFIED (Chromium)**: runnable app, 3D valley, HUD, real build interaction, title→world→build E2E, no duplicate canvases, no console errors. _Not_ verified on WebKit.                                                                                           | `e2e/journey.spec.ts`, `e2e/persistence.spec.ts`, CI green                                  |
| 04 Time engine / epochs        | **VERIFIED**: 600-tick exactness, FPS-independent hash, hidden/pause/stall freeze, reload resumes paused at exact tick, save/load 1/300/599, replay hash; browser controller + E2E                                                                                  | `tests/game/clock.test.ts`, `tests/engine/{time,replay}.test.ts`, `e2e/persistence.spec.ts` |
| 05 Terrain / ecology / world   | PARTIAL: generator + validity + persistent fields + ruins/scars/regrowth exist and render; no per-seed screenshot set, no biome variety yet                                                                                                                         | `tests/engine/world.test.ts`, `docs/review/`                                                |
| 06 Premium 3D world            | **IN PROGRESS** — Age I diorama exists; art gate NOT met (no citizens, one era)                                                                                                                                                                                     | `docs/ART_DIRECTION.md`                                                                     |
| 07 Desktop / iPhone UX         | PARTIAL: mouse+keyboard+touch placement verified in E2E at 1366×768 and iPhone-13 profile; 320 px and landscape not inspected                                                                                                                                       | `e2e/*`                                                                                     |
| 08 Construction / city life    | PARTIAL: scaffolds + progress sweep + crops + dust; **citizens** (instanced, role-colored, labor-driven, BFS paths, work/idle animation) and dirt roads exist; no personas/interiors, no hazard reactions beyond sprinting                                          | `docs/review/citizens-village.jpg`                                                          |
| 09 Collapse / inheritance      | PARTIAL+: engine complete; **cinematics** for fire (front + embers + char), flood (continuous rising surface), quake (shockwave + camera shake) replay the resolved outcome read-only and skippably; debrief + interregnum verified; "then vs now" slider not built | `docs/review/cinematic-*.jpg`, `e2e/campaign.spec.ts`                                       |
| 10–11 Ages / disasters         | NOT STARTED (flood/quake resolve in engine but have no visuals; later-age buildings are data only)                                                                                                                                                                  | —                                                                                           |
| 12 Playable 3-epoch slice      | **IN PROGRESS**: a complete 3-epoch loop to an ending is playable and E2E-tested; **no executed winning trace, balance untuned**                                                                                                                                    | `e2e/campaign.spec.ts`                                                                      |
| 13–19                          | NOT STARTED                                                                                                                                                                                                                                                         | —                                                                                           |

## Log

### Session 1 — Engine foundation (phases 01, 02, engine half of 04)

Branch `claude/determined-wright-c0aptv`. Repo previously contained only prompts.

**Built:** Vite/React/TS-strict toolchain (pinned: React 19.3.1, three 0.186.1, R3F 9.8.2 (stable; 10 is alpha), drei 10.7.9, Vite 8.3.5,
Vitest 5.0.5, TypeScript 6.0.3 (7.x unsupported by typescript-eslint), Playwright 1.63.0 to match the preinstalled Chromium).
Deterministic engine: seeded valley generator with validity gate (300/300 seeds valid), economy tick, labor, placement, three physical hazards
(fire/flood/quake) shared by forecast and resolution, idempotent collapse, knowledge retention via archives, time-skip + bounded archaeology + founding,
integrity-checked saves, replay transcripts, bot framework.

**Commands run (all green at end of session):**

- `npx tsc --noEmit` → clean
- `npx eslint .` → clean
- `npx vitest run` → 7 files, 70 tests passed
- `npx vite-node scripts/campaign.ts 6001` → full 3-epoch bot campaign in ≈3.7 s (reaches a verdict; the _scripted bot loses on the victory conditions_, as expected for an untuned baseline)

**Bugs found by tests and fixed:** replay desync (non-timed actions logged with tick 0, so replays never ran the epoch out); quadratic reachability BFS made bot scans take minutes (now cached).

**CI incident (found by the PR checks, fixed):** the first push failed `npm run build` — `index.html` referenced `/src/main.tsx`, which did not exist yet.
I had verified typecheck/lint/test locally but not `build`, and one local check chain used `| tail`, which hides failures. Fixed by adding the real entry
point. **Rule from now on:** before every push run exactly `npm run typecheck && npm run lint && npm test && npm run build` with no pipes, and only then push.

**Not done / honest gaps:** no browser app yet; no 3D; no UI; Stone House/Levee/Dam/Bridge/Retaining Wall/Forge/Grove and later techs are data only
(`enabled:false`); no winning trace exists yet (fixtures are proposed); balance untuned (hazards are currently easy for a bot that sites buildings out of the forecast footprint).

### Session 2 — The playable browser loop (phases 03, 04 browser half, parts of 06/07/09/12)

**Built:** `src/game` (store with revisions + cached forecast + placement state machine + autosave; `EpochClock`; persistence), `src/render` (terrain
mesh with levelled pads, river shader, soil-strata skirt, instanced vegetation, ~10 procedural building models with construction/ruin/damage states,
decals for forecast/ghost/selection/risk, picking, camera rig for mouse/touch/keyboard), `src/ui` (title over a living engine-built village, HUD,
tray, placement bar, inspector, research/focus/help, pause, briefing, collapse, debrief, interregnum, ending).

**Commands run (all green):** `npm run typecheck`, `npm run lint` (0 findings), `npm test` (82), `npm run build`, `npx playwright test` (13 passed, 1 skipped), CI green.

**Bugs found and fixed this session (by tests/screenshots):**

- CI: first push failed `build` (missing `src/main.tsx`) — I had not run `build` locally. Gate rule added.
- Geometry winding: cone/gable normals inverted → grey roofs and hollow-looking huts. Primitives now self-orient.
- Decal grid used a fractional count for non-integer sizes → stray diagonal strip.
- `opacity` on cards over a `backdrop-filter` parent composited badly → blocked cards use color/dashed border.
- Render hitch (first frame after Begin) was misread as a stall and paused the game → stall limit 2.5 s + clock reset on Begin/Resume.
- Replay desync (non-timed actions logged tick 0) — session 1.
- `findSpot` searched near the _original_ hearth after relocation; camera did not re-center on the new hearth after founding.
- Resource rates counted purchases as losses; toast overlapped the Begin button; briefing card covered the village on desktop.
- UI handlers mutated store fields without emitting (Help button needed a toast hack) → store methods (`togglePanel`, `setInter`, …).

**Honest status:** the loop _plays_ start-to-ending in a real browser, but it is not yet a _good game_: no citizens, one architectural era, balance untuned,
collapse is a title card, no audio, no WebKit/real-device/FPS evidence. See `docs/KNOWN_ISSUES.md` and the self-assessed art table in `docs/ART_DIRECTION.md`.

### Session 2b — Life and the collapse cinematic (phases 08, 09)

**Built:** `render/paths.ts` (walkable grid, BFS distance fields, dirt-road mask painted into the terrain), `render/Citizens.tsx` (instanced torso/head/legs/tool;
roles from the engine's real labor allocation; walk/work/idle animation; deaths played out during collapse), `render/presentation.ts` + `render/CollapseFx.tsx`
(read-only cinematic: the report now records pre-collapse cell state; terrain/forests/buildings show "before" until the hazard front arrives; per-hazard front overlay;
burn and dust effects; quake shake; atmosphere shifts as the clock runs down). Report gained `before: BeforeCells` (test added).

**Verified:** typecheck, lint (0), 83 unit tests, build, 13 Playwright tests passing (desktop + iPhone profile) after the changes.
**Not verified:** cinematic timing/FPS on real hardware (software GL only); reduced-motion path not E2E-tested; flood front edge is jagged (cell-gated).
