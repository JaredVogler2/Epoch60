# PROGRESS

Status vocabulary: NOT STARTED · IN PROGRESS · IMPLEMENTED UNVERIFIED · VERIFIED · BLOCKED · REOPENED.
Only claim VERIFIED with executed evidence recorded below.

| Phase                          | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01 Design bible / rules        | IMPLEMENTED (rules + content executable); route fixtures EXECUTED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `docs/GAME_RULES.md`, `CONTENT_SPEC.md`, generated tables, `fixtures/greenvale-traces.md`   |
| 02 Economy, actions, tech      | **VERIFIED**: 16 buildings and 9 techs enabled. Since session 4 every effect an independent review could neutralise unnoticed has a behavioural test, each checked by a one-line mutation (`tests/engine/effects.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                            | `tests/engine/{economy,hazards,legacy,ages,effects}.test.ts`                                |
| 03 Architecture / app scaffold | **VERIFIED (Chromium)**: runnable app, 3D valley, HUD, real build interaction, title→world→build E2E, no duplicate canvases, no console errors. _Not_ verified on WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                             | `e2e/journey.spec.ts`, `e2e/persistence.spec.ts`, CI green                                  |
| 04 Time engine / epochs        | **VERIFIED**: 600-tick exactness, FPS-independent hash, hidden/pause/stall freeze, reload resumes paused at exact tick, save/load 1/300/599, replay hash; browser controller + E2E                                                                                                                                                                                                                                                                                                                                                                                                                                    | `tests/game/clock.test.ts`, `tests/engine/{time,replay}.test.ts`, `e2e/persistence.spec.ts` |
| 05 Terrain / ecology / world   | PARTIAL: generator + validity + persistent fields + ruins/scars/regrowth exist and render; no per-seed screenshot set, no biome variety yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `tests/engine/world.test.ts`, `docs/review/`                                                |
| 06 Premium 3D world            | **IMPLEMENTED (session 4), scored 4/5** on the seven criteria judged from stills after three capture → inspect → fix iterations — painterly diorama across three ages with citizens: shared atmosphere (clouds, wind, painted ground), sky and haze, smooth-shaded tree species with autumn accents, masonry and age roof palettes, the valley continuing past the board, birds, instanced smoke, high-tier tilt-shift and grade, collapse fronts as smooth draped fields. Animation and performance are not scored: captures are SwiftShader stills (no GPU/iPhone frame rates)                                      | `docs/3D_QUALITY_REPORT.md`, `docs/PERF.md`, `docs/review/visual/`                          |
| 07 Desktop / iPhone UX         | PARTIAL+: mouse, keyboard and touch placement verified in E2E at 1366×768 and the iPhone-13 profile; `e2e/layout.spec.ts` covers 390×664, 320×568, 844×390 and 667×375 (Begin and the placement bar reachable, no horizontal overflow). Session 4: title, fresh valley, placement, village and collapse captured and inspected at 1920×1080, 1440×900, 1366×768, 390×844, 393×852, 844×390, 360×740 and 667×375; no control under 44×44 px measured at 390 and 360 px wide with a coarse pointer; a desktop hover highlight and pointer cursor (`e2e/interaction.spec.ts`). Real iPhone and WebKit not tested (K-001) | `e2e/*`, `docs/3D_QUALITY_REPORT.md`                                                        |
| 08 Construction / city life    | PARTIAL: scaffolds + progress sweep + crops + dust; **citizens** (instanced, role-colored, labor-driven, BFS paths, work/idle animation) and dirt roads exist; no personas/interiors, no hazard reactions beyond sprinting                                                                                                                                                                                                                                                                                                                                                                                            | `docs/review/citizens-village.jpg`                                                          |
| 09 Collapse / inheritance      | PARTIAL+: engine complete; **cinematics** for fire (front + embers + char), flood (continuous rising surface), quake (shockwave + camera shake) replay the resolved outcome read-only and skippably; debrief + interregnum verified; "then vs now" slider not built                                                                                                                                                                                                                                                                                                                                                   | `docs/review/cinematic-*.jpg`, `e2e/campaign.spec.ts`                                       |
| 10–11 Ages / disasters         | **PARTIAL+**: techs gate Stone House, Levee, Dam, Bridge, Retaining Wall, Forge, Grove with real effects; per-age roofs (thatch → tile → slate); **4 disaster types** (fire, flood, quake, ashfall winter with roof load, famine and lasting soil poison) + 7 state-derived story decisions with chip UI; a second scenario (The Ashen Winter) with its own executed traces; combination effects tested (deforestation ↔ flood/fire, neglected dam, grove ↔ flood ↔ fire, forge ↔ ash)                                                                                                                                | `tests/engine/{ages,story}.test.ts`, `e2e/story.spec.ts`, `docs/review/ages-*.jpg`          |
| 12 Playable 3-epoch slice      | **VERIFIED (engine + Chromium)**: two winning routes that play differently and credible losses, executed on seed 6001 and replayed bit-for-bit headless and in the browser; on seed 6001 each route loses without its key mechanism (ablation tests). **Since session 5 (rules 0.4.0)** an Archive is not a landmark, so a win needs knowledge _and_ a separate landmark, and the routes get their landmark differently (Engineers: the hearth they refound above the flood and hold; Archivists: a Seed Vault). One well-sited Archive alone, which won Greenvale/Normal 40/40 before, now loses (K-003)             | `fixtures/greenvale-traces.md`, `tests/engine/routes.test.ts`, `e2e/victory.spec.ts`        |
| 13–19                          | 15 PARTIAL (headless tournament + invariants + fuzz + exploit probes: `scripts/sim.ts`, `docs/BALANCE_REPORT.md`); others NOT STARTED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `tests/engine/fuzz.test.ts`                                                                 |

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

### Session 3 — Ages, decisions and winning routes (phases 10, 11, 12; first slice of 15)

Branch `claude/determined-wright-c0aptv`; PR #1 had already been merged, so this work lives in a new PR (merged `main` into the branch rather than force-pushing).

**Built:**

- _Content with effects_ — Stone House (masonry), Levee/Dam (hydrology), Bridge (bronze tools), Retaining Wall (seismic engineering), Forge (ironworking), Grove (forestry) and the six
  remaining techs are enabled; Forge boosts quarries/camps within 8 cells and taints soil, a Dam irrigates nearby farms, Groves regrow woodland and slow floods, Crop Rotation
  restores soil. Quake damage ×1.6 (the old quake was nearly toothless). Final victory now needs **3** retained technologies, so an Archive must stand.
- _Story decisions_ (`src/engine/events/story.ts`) — six state-derived, optional, deadline-defaulted decisions, ≤ 3 per epoch, `choose` action, chip UI on desktop and iPhone.
- _Bots_ — forecast-driven mitigation placement, save-up behaviour, future-hazard foresight; policies `engineers`, `archivists`, `builder`, `maximizer`, `steward`; executed traces in `fixtures/greenvale/`.
- _Models_ — seven new building models and age-dependent roofs.
- _Verification tooling_ — `scripts/sim.ts` tournament, `checkInvariants`, chaotic-action fuzz over 30 seeds, exploit probes.

**Found and fixed by the bots/tests:**

- **Soft-lock:** if the last hearth stood on a river bank, `findSites` returned no sites and the campaign could never continue (regression test fails without the fix).
- Quake was too weak to matter (rubble only within ~2 cells of the epicentre) → severity ×1.6.
- Knowledge: without a Knowledge labor focus, research starved (archive unstaffed) → bots set the focus; archive output 36→50, hearth 10→12 milli/tick.
- Victory's tech condition could be met by the hearth's oral tradition alone → threshold 3 so archives matter.
- Bot runner mis-parsed `--trace` as a seed (NaN world) — caught because the traced run disagreed with the untraced one.

**Commands run (all green):** `npm run typecheck`, `npm run lint` (0), `npm test` (**140 tests, 12 files**), `npm run build`; Playwright (see `docs/TEST_RESULTS.md`).

**Not done / honest gaps:** 4th disaster type, 8–12-epoch campaign, expeditions/daily/sandbox modes, audio, WebKit/real-device evidence, human playtest, difficulty tiers (both tuned routes win every
one of the first 20 seeds — see `docs/BALANCE_REPORT.md` for the current sample).

### Session 3b — The fourth disaster (phase 11)

**Built:** `ash` hazard (plume physics, roof load, famine against a larder, lasting soil pollution), Granary building + model, two ash traditions, a seventh story decision,
the **Ashen Winter** scenario (title-screen picker), ash cinematic (front shader mode, falling flakes, grey terrain tint), pollution captured in the pre-collapse snapshot.
**Verified:** typecheck, lint, 159 Vitest tests (11 new ash tests, 8 new ashen trace tests), build; Playwright results in `docs/TEST_RESULTS.md`.
**Found by the bots:** the first Engineers plan starved in the ash winter (it built no lumber camp or second farm); a steward ignoring roofs and larders is buried; the famine
explanation in the debrief initially described the empty village after the deaths (fixed: the larder is captured before they apply).
**Not done:** a human playtest of the ash winter; ash story decisions beyond one; Age III skyline.

### Session 3c — Accessibility, difficulty, modes and audio (slices of phases 13, 14, 15, 17)

**Built:** accessible placement (`suggestSpots`, Next-site button/`N`, arrow-key nudging, camera keeps WASD), a polite live announcer, OS reduced-motion default; difficulty tiers
(Gentle/Normal/Hard) in the engine, saves, transcripts and title; modes — validated seed/link entry, Random valley, Daily Ruins (UTC), local run cards, share link; procedural audio with
mute and independent volumes; eight paired strategic experiments (prompt 15 A–H) as permanent tests; bot back-off for failed searches.
**Fixed along the way:** "Play again" and "New valley" silently reset to Greenvale/Normal (now keep scenario and difficulty); the story e2e raced its own 15 s countdown under load.
**Verified:** typecheck, lint, 199 Vitest tests; Playwright results in `docs/TEST_RESULTS.md`.
**Not verified:** audio by ear; screen-reader behaviour with a real reader (the live region content is tested, not its reading); WebKit; real-device frame rates.

### Session 3d — Verification, phone fixes and the Hard route

**Found by the full browser suite (not by unit tests):** the new mute button was invisible on phones (an old `nth-child(3)` rule meant for Help), and the Next-site button made the placement bar
182 px tall on a 390×664 screen, stacked under the Begin card and covering the valley — three iPhone specs could not place a building. Fixed: Help is what phones hide; the placement bar is now one
info row plus one button row (107 px at 390, 122 px at 320) and the Begin card steps aside while placing. Screenshots inspected at 390×664 and 320×568. A "Next site" arrow icon replaced a second check mark.
**Process fix:** PR #2 had been merged a minute after it opened, so three later commits sat on a branch with no PR; `main` was merged into the branch and PR #3 opened. `CONTINUE_HERE.md` now says to check
`git rev-list --left-right --count origin/main...HEAD` before assuming a PR is open.
**Balance (counted, bots only):** 100 seeds × 7 policies on Greenvale/Normal = 700 campaigns, 0 invariant violations, 0 soft-locks: both tuned routes 100/100, steward 11%, other baselines 0%. 40-seed runs on
Gentle, Hard and Ashen in `docs/balance/`. The first Hard run exposed that the Engineers route could not win at all (0/40): Hard needs two landmarks and four technologies, and the route had one and three. Two
dead ends were instructive — researching two techs in one age starved the economy (timber flat at 5 for the whole epoch), and a `save`-blocked second archive deadlocked because the fire had destroyed the
lumber camp that would have paid for it. Final Hard-only plan: camp and quarry first, a second Archive (a landmark that doubles knowledge), hydrology in the third age. Greenvale Hard: Engineers 80%,
Archivists 100%; Ashen Hard: Engineers 15%, Archivists 78%. A permanent test requires both routes to win Hard Greenvale by different mechanisms (it fails without the change); Normal fixtures are unchanged.
**Verified:** typecheck, lint, 208 Vitest tests, build, Playwright 44 passed / 2 skipped / 0 failed locally, GitHub CI (`verify` and the Playwright job) green on PR #3's merge commit.
**Not verified:** WebKit, real-device frame rates (`docs/PERF.md` is software GL), audio by ear, a real screen reader, any human play.

### Session 4 — The 3D visual overhaul and the second review

**Brief:** a world-class interactive 3D look for EPOCH60 (art direction inferred from a cozy painterly village-builder reference), on modern
desktop browsers and iPhone Safari, with measured performance tiers, responsive layouts at seven named viewports and at least three
capture → inspect → fix iterations scored honestly. Process docs: `docs/3D_VISUAL_STANDARD.md`, `docs/3D_IMPLEMENTATION_PLAN.md`,
`docs/3D_QUALITY_REPORT.md`.

**Built (render-only; the engine never reads any of it):** a shared atmosphere injected into every material (moving cloud shadows, wind
sway, painted ground strokes), sky dome and distance haze, the key light moved to the front-left after a back-lit first attempt, Neutral tone
mapping chosen by A/B/C captures; smooth-shaded tree species with autumn colour on 14 % of broadleaves, 25 % of birches and 8 % of shrubs; noise-warped terrain sampling (no cell stair-steps),
pebble banks, worn yards; coursed masonry and age roof palettes; the valley continuing past the board into haze; bird flocks; one instanced
smoke system for every chimney; a high-tier composer (MSAA HDR → tilt-shift → grade → OutputPass); a CSS vignette; collapse visuals — a
travelling fire wall with smoke columns and light, and flood / quake / ash fronts as smooth draped fields (a rising water surface with a
natural shoreline, a quake shock ring with fissures, a lit ash blanket) instead of cell squares; a forecast drawn as a soft field with a
constant-width contour on the zone's edge; a settle-bounce and sawdust puff when a building is finished; on desktop the building under
the mouse gets a faint outline and brightens a little, and the cursor becomes a pointer (re-picked when the camera moves under a resting mouse).
**Iteration 3 (every required viewport, 42 captures inspected):** a speckled forecast outline (`smoothstep` with equal edges where
`fwidth` is 0) and a fire contour broken into islands; "EPOCH" wider than the title card; a clipped seed placeholder; flat-shaded
hillside stones; and on phones the collapse banner over the resource chips, a wrapping timer line and a wrapping title button — all
fixed and recaptured. The perf probe had been counting only the composer's last pass; with whole-frame counting the scenery beyond the
board dominated the triangles, so it now uses far-detail trees.
**Robustness:** WebGL context loss pauses the epoch and rebuilds the renderer; the governor sheds post-processing when even the lowest pixel
ratio is over budget; an error boundary and a no-WebGL screen replace blank pages; saves, run cards and settings are validated field by
field; modal dialogs move and trap focus and stop the hotkeys behind them; 44 px touch targets on coarse pointers; a two-column landscape
title; geometry leaks on terrain rebuilds fixed.
**Second review (independent agent, mutation-tested):** fixed — six of eleven traditions could never be offered (offers are now a lesson from
the hazard that struck, a preparation for the next age's hazard and Open Hands, rotating by seed); restoring a ruin bypassed the building
limit; a restored or repaired hearth could never finish; labour-focus orders were unbounded; the forecast went stale after an ash
reinforcement; leaving a finished lineage for the title brought the ending back as Continue; the Daily tag was lost on reload; Assisted runs
were not ranked apart; the debrief's "destroyed" count disagreed with the headline; `Math.pow`/`Math.hypot` fed hashed state. Corrected
claims — the routes are not mechanically distinct on Normal (a seven-step policy with one well-sited Archive wins Greenvale/Normal 40/40;
K-003); the trace report's "no hazard reaches the Archivists' landmarks" was false; stale versions and rates in `GAME_RULES.md`,
`CONTENT_SPEC.md`, `ARCHITECTURE.md`, `ART_DIRECTION.md`.
**Tests added:** behavioural tests for 14 effects the review could neutralise unnoticed, forecast ≡ resolution for flood and quake, five
tautological tests replaced — each checked by a deliberate one-line mutation (the new tests' author was a separate agent; two of its
mutations were re-run independently and were caught); repair limits, the hearth, the focus-order bound, tradition reachability, the store's
save/Daily/forecast behaviour, saves and settings under hostile input; a browser test for WebGL context loss.
**Verified:** typecheck, lint, 247 Vitest tests (25 files), build; traces re-recorded under rules 0.3.0 with every verdict unchanged; visual
iteration 3 at the seven required viewports plus 667×375 (scores in `docs/3D_QUALITY_REPORT.md`) and the perf probe on the new scene
(`docs/PERF.md`, software GL); balance tournaments under rules 0.3.0 (Greenvale/Normal: both routes 100/100; Hard: Greenvale Engineers 85 %,
Archivists 100 %, Ashen Engineers 40 %, Archivists 78 %); Playwright — the full suite on the visual-pass build (53 passed, 2 skipped, 1 failed:
a stall-guard artefact in the test, fixed), the full suite again after iteration 3 and the first hover version (57 passed, 3 skipped, 0 failed,
18.2 min), then on the final build the hover, journey and layout specs on both profiles (all passed; the hover test fails when the camera
re-pick or the throttle's trailing pick is removed).
**Not verified:** WebKit, a real iPhone, real-GPU frame rates, a human playtest.

### Session 5 — Normal needs two preparations (K-003)

**Problem (measured):** under rules 0.3.0 a seven-step policy — one Archive sited away from the later flood and quake, one farm, one lumber
camp, three cheap technologies, three cottages — won Greenvale/Normal on 40 of 40 seeds. The Archive was both the landmark and the knowledge
store, so where it stood decided the game; the runbook's "avoid one unbeatable best building" was not met.
**Change (rules 0.4.0, content 0.3.0):** an Archive is no longer a landmark. The victory's landmark is a Hearth a later society kept, a Seed
Vault, a Dam or a Bridge; the Archive carries technologies. Hard keeps ×1.15 hazards, ten survivors and four technologies but now asks for one
landmark, not two. Candidate rules were scored first on the final states of nine policies × 40 seeds × 2 scenarios (a rule requiring two
landmarks of any kind would have let a second Archive answer it; this one forces a second, different preparation).
**Routes:** the Engineers refound above the flood line after the fire and hold that hearth through the quake (staying on the valley floor
loses the hearth to the flood on 27 of 40 seeds); on Hard they take Open Hands after the flood. A Dam-building variant was tried and dropped
(quakes wrecked the dam and it cost the Normal route four seeds). The Archivists keep their Seed Vault.
**UI:** the planning card lists the three conditions with a live landmark count; each founding site says whether it keeps or abandons a standing
hearth; the defeat reason names what counts as a landmark; Archive ruins (their tablets can be dug up) stay at the top of the ruin list.
**Tests:** the one-Archive recipe (`minimalRecipe`) loses on four seeds and adding a landmark wins (both fail under the old rule); new
ablations — Engineers staying on the flooded floor, Archivists without the vault; Hard thresholds and mechanisms; the campaign browser test
reads the goals and the live count. Traces re-recorded under rules 0.4.0 and re-read.
**Measured (bots only, rules 0.4.0 at `3ee40b8`):** Greenvale/Normal 100 seeds — Engineers 98, Archivists 100, steward 7, other baselines 0; Gentle — both
routes 40/40; Hard — Engineers 39/40 on both scenarios, Archivists 40/40 (Greenvale) and 31/40 (Ashen); Ashen/Normal — both 40/40; 0 invariant violations,
0 soft-locks. Minimal recipes (`scripts/recipes.ts`, seeds 1–40, Normal): one Archive alone 0/40 on both scenarios; with a Seed Vault 40/40 (Greenvale) and
7/40 (Ashen); with a held hearth 27/40 and 0/40 — so Normal now asks for two things but still forgives a player who knows them (K-003, now low).
**Verified:** typecheck, lint, 251 Vitest tests (25 files; the K-003 tests fail when the Archive is made a landmark again), build; the campaign specs and
the four browser victory replays on both profiles (14 passed), and the campaign specs again after the founding-site tags (6 passed); the planning card
and the founding sites captured at 1366×768 and 390×844 and inspected (the first placement of the goals pushed the forecast below the fold on a laptop,
so they moved under the orders; the sites now say whether they keep or abandon a standing hearth).
**Not verified:** a human playtest of the new demand, WebKit, a real iPhone, real-GPU frame rates.
