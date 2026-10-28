# PROGRESS

Status vocabulary: NOT STARTED · IN PROGRESS · IMPLEMENTED UNVERIFIED · VERIFIED · BLOCKED · REOPENED.
Only claim VERIFIED with executed evidence recorded below.

| Phase                          | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01 Design bible / rules        | IMPLEMENTED (rules + content executable); route fixtures EXECUTED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `docs/GAME_RULES.md`, `CONTENT_SPEC.md`, generated tables, `fixtures/greenvale-traces.md`   |
| 02 Economy, actions, tech      | **VERIFIED**: 16 buildings and 9 techs enabled. Since session 4 every effect an independent review could neutralise unnoticed has a behavioural test, each checked by a one-line mutation (`tests/engine/effects.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `tests/engine/{economy,hazards,legacy,ages,effects}.test.ts`                                |
| 03 Architecture / app scaffold | **VERIFIED (Chromium)**: runnable app, 3D valley, HUD, real build interaction, title→world→build E2E, no duplicate canvases, no console errors. _Not_ verified on WebKit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `e2e/journey.spec.ts`, `e2e/persistence.spec.ts`, CI green                                  |
| 04 Time engine / epochs        | **VERIFIED**: 600-tick exactness, FPS-independent hash, hidden/pause/stall freeze, reload resumes paused at exact tick, save/load 1/300/599, replay hash; browser controller + E2E                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `tests/game/clock.test.ts`, `tests/engine/{time,replay}.test.ts`, `e2e/persistence.spec.ts` |
| 05 Terrain / ecology / world   | PARTIAL: generator + validity + persistent fields + ruins/scars/regrowth exist and render; no per-seed screenshot set, no biome variety yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `tests/engine/world.test.ts`, `docs/review/`                                                |
| 06 Premium 3D world            | **IMPLEMENTED (session 4), scored 4/5** on the seven criteria judged from stills after three capture → inspect → fix iterations — painterly diorama across three ages with citizens: shared atmosphere (clouds, wind, painted ground), sky and haze, smooth-shaded tree species with autumn accents, masonry and age roof palettes, the valley continuing past the board, birds, instanced smoke, high-tier tilt-shift and grade, collapse fronts as smooth draped fields. Animation and performance are not scored: captures are SwiftShader stills (no GPU/iPhone frame rates)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `docs/3D_QUALITY_REPORT.md`, `docs/PERF.md`, `docs/review/visual/`                          |
| 07 Desktop / iPhone UX         | PARTIAL+: mouse, keyboard and touch placement verified in E2E at 1366×768 and the iPhone-13 profile; `e2e/layout.spec.ts` covers 390×664, 320×568, 844×390 and 667×375 (Begin and the placement bar reachable, no horizontal overflow). Session 4: title, fresh valley, placement, village and collapse captured and inspected at 1920×1080, 1440×900, 1366×768, 390×844, 393×852, 844×390, 360×740 and 667×375; no control under 44×44 px measured at 390 and 360 px wide with a coarse pointer (and, since session 7, every top-bar button at 320 px in `e2e/layout.spec.ts`); a desktop hover highlight and pointer cursor (`e2e/interaction.spec.ts`). Real iPhone and WebKit not tested (K-001)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `e2e/*`, `docs/3D_QUALITY_REPORT.md`                                                        |
| 08 Construction / city life    | PARTIAL: scaffolds + progress sweep + crops + dust; **citizens** (instanced, labor-driven, BFS paths, work/idle animation) and dirt roads; since session 5 they are told apart by job — straw hats on farmers, a red cap and an axe on lumberjacks, leather caps and picks on quarrymen, felt hats and mallets on builders, tablets for scholars — and dress by age (undyed linen, dyed cloth, dark wool). No personas/interiors, no hazard reactions beyond sprinting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `docs/review/visual/v5-villagers.jpg`, `e2e/life.spec.ts`                                   |
| 09 Collapse / inheritance      | PARTIAL+: engine complete; **cinematics** for fire (front + embers + char), flood (continuous rising surface), quake (shockwave + camera shake) replay the resolved outcome read-only and skippably; debrief + interregnum verified; since session 6 a "then and now" slider between ages (pictures from one viewpoint, session memory only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `docs/review/cinematic-*.jpg`, `e2e/campaign.spec.ts`                                       |
| 10–11 Ages / disasters         | **PARTIAL+**: techs gate Stone House, Levee, Dam, Bridge, Retaining Wall, Forge, Grove with real effects; per-age roofs (thatch → tile → slate; since session 7 copper and spires in the long chronicle's Age of Spires); **4 disaster types** (fire, flood, quake, ashfall winter with roof load, famine and lasting soil poison) + 7 state-derived story decisions with chip UI; a second scenario (The Ashen Winter) with its own executed traces; combination effects tested (deforestation ↔ flood/fire, neglected dam, grove ↔ flood ↔ fire, forge ↔ ash)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `tests/engine/{ages,story}.test.ts`, `e2e/story.spec.ts`, `docs/review/ages-*.jpg`          |
| 12 Playable 3-epoch slice      | **VERIFIED (engine + Chromium)**: two winning routes that play differently and credible losses, executed on seed 6001 and replayed bit-for-bit headless and in the browser; on seed 6001 each route loses without its key mechanism (ablation tests). **Since session 5 (rules 0.4.0)** an Archive is not a landmark, so a win needs knowledge _and_ a separate landmark, and the routes get their landmark differently (Engineers: the hearth they refound above the flood and hold; Archivists: a Seed Vault). One well-sited Archive alone, which won Greenvale/Normal 40/40 before, now loses (K-003)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `fixtures/greenvale-traces.md`, `tests/engine/routes.test.ts`, `e2e/victory.spec.ts`        |
| 13–19                          | 13 PARTIAL: seed links, Daily Ruins, local run cards, Assisted ranked apart, twelve challenge modifiers, expeditions and a replay viewer (session 7), and the long chronicle, carrying a won lineage on to twelve ages (session 7); no authored 8–12-epoch scenarios or sandbox (K-004) · 14 PARTIAL: procedural audio (never heard, K-015), villagers by job and age; no personas or interiors · 15 PARTIAL: headless tournament + invariants + fuzz + exploit probes, difficulty tiers (`scripts/sim.ts`, `docs/BALANCE_REPORT.md`) · **16 PARTIAL (session 6): 18 feats awarded from real state (20 with session 7's long chronicle), each earned by a recorded run (`fixtures/feats.md`); a device-local Codex; an Atlas of Ages and ideas for the next lineage on the ending; a ruin inspector; replaying an age as an unranked branch; a history lens on the map; a legacy score that counts only what lasted; then-and-now pictures (session only); a chronicle of the most storied works; twelve challenge mutators opened by Codex feats and the long chronicle's endless play, bounded at twelve ages (session 7)** — no other unlocks (K-022), no land part in the legacy (K-023) · 17 PARTIAL: keyboard-only play, live announcer, reduced motion, phone layouts; no real screen reader or device (K-016, K-001, K-009) · 18 PARTIAL (session 7): deploy-ready and checked: a strict content security policy and other headers that every browser test runs under, a release check of the build in CI, backups to export and import, a confirmation before a saved lineage is replaced, `docs/RELEASE_CHECKLIST.md`; not deployed (needs the owner's confirmation, K-018), no WebKit or Firefox runs (K-001) · 19 PARTIAL (session 7): an independent adversarial review found ten real defects (one P1, nine P2), each fixed with a test that fails on the code it replaced (rules 0.4.2); the visual gate on the final build scores the four core categories 4/5 from software-GL stills (water, villagers and historical progression 3/5) after omens before each catastrophe, a lighter history lens, a building surface pass and phone framing (`docs/ADVERSARIAL_REVIEW.md`); the verdict is not a pass: no real iPhone or WebKit, no real-GPU frame times, no human playtest, nothing deployed |

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
**Villagers (render only):** a hat or cap and a tool by job, tunics and trousers by age, and idle people spreading wider as a village
grows (21 idle villagers had been knotted around one hearth). Captured before and after at both ages, at 2.4, 6.5, 10 and 15 cells from the
camera: the jobs read clearly up close and as coloured hats at play zoom; at the default distance villagers remain a few pixels tall.
Scene cost +5 draw calls (hats and tools skip the shadow pass; `docs/PERF.md`). A browser test checks that each job shows as many villagers
as the engine puts to work (it fails when farms are drawn as builders).
**Not verified:** a human playtest of the new demand, WebKit, a real iPhone, real-GPU frame rates.

### Session 6 — Feats, the Codex and the Atlas of Ages (first slice of phase 16)

**Built.** Eighteen feats in five groups (knowledge, heritage, engineering, stewardship, endings), awarded by the engine at
the moment each happens — a building finished, a research job done, a collapse report written, a ruin dug up, an age founded —
from the state that event produced (`src/engine/legacy/feats.ts`), and kept in `lineage.feats`. Being hashed, saved and replayed,
a recorded run always earns exactly the same feats; they change nothing in play. A device-local **Codex** (`src/game/codex.ts`,
`epoch60.codex.v1`) copies them from played lineages only — never the title screen's demo village — and drops stored entries this
build cannot vouch for; the title has a Codex view, feats earned in play or between ages are announced once by a toast, and the
debrief and the ending list them ("new" when the device had not seen them). The ending's lineage list became an **Atlas of Ages**
(per age: society, catastrophe, people before and after, the best technology known, the landmarks standing afterwards, the ecology
score, the first causal line and that age's feats) followed by two or three **ideas for the next lineage**: what the run lacked when
the end came, then feats this device has not seen that the scenario allows, then another valley or Hard.
**Measured first.** Tallying feats over 96 bot campaigns (6 seeds × 8 policies × 2 scenarios) found that no technology was ever lost
at a collapse (K-020): feats for rediscovering lost knowledge and recovering forgotten tablets would only have rewarded sabotage, so
they were replaced by _Shored Up_ (a building you reinforced is struck by that catastrophe and stands) and _Works of the River_ (a
Bridge or a Dam). Two first drafts were too easy — a quake or catastrophe that never reached the village counted as "unshaken" and
"without loss" (the losing builder earned both) — so both now require the hazard to reach at least one building.
**Every feat is attainable, by a recorded run.** The eight route fixtures earn ten feats; five new runs in `fixtures/feats/` —
variants of the route policies recorded by `scripts/record-feats.ts` (minimal recipe with a Seed Vault, Archivists on Hard, an
Archive raised in the fire's path, levees and a grove in the river age, a Dam) — earn the other eight. `fixtures/feats.md` lists who
earns what, in which age.
**Also fixed:** the title card returns to its top when switching views (the Codex opened mid-list on a 320 px phone). The
clear-the-brush story reported "the predicted burn shrank by 0 cells" when the cleared scrub lay off the fire's path (it does on
seed 6001: the Engineers pay 4 timber for nothing there); it now says the burn is unchanged. Its unit test had asserted only "≤" and
the word "cells", so it passed on a scenario where nothing shrank: it is now two tests — a scrub-choked hearth whose burn really shrinks
by the number reported, and one off the fire's path that must say "unchanged" — and the browser test checks the toast against the
measured outcome.
**Verified:** typecheck, lint, **291 Vitest tests** (28 files; new: 27 feat tests replaying all thirteen recorded runs plus rule-edge
tests, 6 Codex storage tests, 5 next-lineage-idea tests, 1 store test), build. Twelve one-line mutations of the feat rules (dropping
"reaches the village", counting a withdrawn quarry plan, counting a story decision's brace as reinforcement, a one-age-old library, any
grove, a restoration without excavation, flood deaths ignored, one farm enough, a later-age landmark, any difficulty for Hard, two tech
branches, no firebreak) each fail at least one test; so does letting the demo village into the Codex. Browser: `e2e/codex.spec.ts` on
both profiles (a fresh device shows 0 of 18; the Engineers' recorded win, played through the browser's store, lists exactly its feats
in the debrief and the ending, fills the Codex with them, and the Codex survives a reload). Captures of the title Codex at 1366×768,
390×664, 320×568 and 844×390 (no horizontal overflow; the Codex button is 44 px tall) and of the debrief and ending on both profiles
were inspected; the phone's Atlas header wrapped badly and the 320 px Codex opened mid-list, both fixed and re-captured (review copy:
`docs/review/visual/v6-codex.jpg`). The **full Playwright suite** on the feats build (`c1eb079`): **61 passed, 3 skipped**
(desktop-only), 0 failed, 18.6 min. After the story wording fix: the story, Codex and victory specs on both profiles, 14 passed (the
fixture hashes did not move: an age's story prompts are cleared when the next age is founded). The old story wording fails the new
story test.
**Ruin inspector.** Pressing a ruin now says when and by whom it was built and what it was for, how it fell (destroyed outright,
or broken by a catastrophe and finished by the centuries), what clearing it gives and what restoring it costs and does — or why it
cannot be restored yet — all read from the engine's records and rules (`src/ui/ruins.ts`). Writing it found three things: salvage
under one unit read "gives 0 timber" (now "less than 1"); the text floored a price the Restore button rounds up (7 against 8 — prices
now round up everywhere); and the longer inspector pushed its buttons below the fold of the phone sheet (the action row is now pinned
to the bottom of every inspector). An excavated ruin no longer repeats what its dig already took. Tests compare the stated salvage
and price with what the actions really give and take, follow a restored Bridge from the first age into the victory's landmark count,
and the browser test reads a fire-taken lumber camp and the dug-up quarry in the Archivists' second age and orders the restoration
through the inspector's own button (both profiles; the phone needs the sheet closed before Begin, as before).
**Verified (ruin inspector):** typecheck, lint, **297 Vitest tests** (29 files; +6 ruin tests); two mutations of the ruin text (a
landmark sentence for any kind; floored scraps) fail them; `e2e/ruins.spec.ts` 2 passed; captures of the ruin and a standing building's
inspector on both profiles inspected.
**Replay an age.** The ending offers "Replay from Age II / III": the lineage as it stood when that age was founded, kept in
the browser for the current lineage only (`src/game/branches.ts`). The resumed lineage is a branch — the briefing and the ending say
so, its run card is marked, its feats count, and "best for this valley" ignores it, the Daily Ruins included. Replaying drops the
later points of the timeline it leaves; damaged or foreign points are never loaded. Capturing the ending for this found that the
new Atlas, feats and ideas had pushed Play again 2.5 screens down on a phone, against Phase 16's "one-tap Retry/New World": the
ending's choices are now pinned to the bottom of the card (one swipeable row on phones). A first pinned bar was squeezed to 27 px —
the card is a flex column and the bar's own scrolling let it shrink — so it no longer shrinks.
**Verified (branches):** typecheck, lint, **303 Vitest tests** (30 files; +6 branch tests driving the store through recorded
lineages — points saved at each founding and cleared by a new lineage, the exact state restored (hash), later points dropped and
re-made, the card marked and unranked, the mark kept across a reload only for its seed, damaged or foreign points refused); three
mutations (branches ranked, no pruning, no mark kept) each fail them. Browser: `e2e/branch.spec.ts` on both profiles (the
builder's recorded defeat replayed from Age III starts from exactly the hash of that founding, and its second ending and the
title's recent runs say it is a branch), and with it the Codex, campaign and victory specs, 18 passed. The ending captured at
1366×768 and 390×664, top and bottom, and inspected.
**History lens.** The map now shows what each age left (`src/render/history.ts`). It is always on between ages, and on
request while planning an inherited age (the briefing's button, or H). Every building and ruin is outlined in the colour of its
age, ruins hatched; each past catastrophe's reach is drawn from its collapse report; eroded ground is marked; a legend counts it
all, and the hazard forecast steps aside while the lens is shown. An inherited standing building's inspector also names the age
that built it. Building it found four things:

- The regrown forest hid the lens: it is now drawn over the canopy as a map layer.
- The first draft thresholded fading world fields: burnt ground (scar), scoured ground (erosion) and poisoned soil (pollution).
  Probing every recorded run between ages showed three problems. Pollution is always 0 there: only an ash collapse writes it,
  and ash falls only in the Ashen Winter's last age, which no interregnum follows. The "smoke" in the poisoned label was false:
  the Forge writes no pollution. And the flood's own erosion (+30, 21 after the centuries) fell below the scoured mark, so the
  second age's flood, 455–495 cells on the recorded runs, was invisible. The lens now draws each catastrophe's reach from the
  record, keeps only eroded ground as a field (felled woodland the flood washed over, and quarry pits) and drops poisoned soil.
- A toggle left on by an earlier lineage would have hidden the first age's forecast, with no button or key to turn it off there.
  The first age has no history, and the lens now ignores the toggle there.
- The legend opened below the fold of the briefing card's scroll area, entirely hidden on the phone. It now scrolls itself into
  view.

**Verified (history lens):** typecheck, lint, **307 Vitest tests** (31 files; +4 history tests: every site carries its age;
each catastrophe's reach equals its report's cells, the flood's included, though most of its erosion has faded; eroded ground is
exactly the worn land, never the river; the lens is on between ages, on request while planning, never over the first age).
Three mutations each fail them: dropping the first-age guard, dropping the flood's reach, and letting the river count as eroded.
Browser: `e2e/history.spec.ts` on both profiles, 2 passed. Between ages the legend counts the Archivists' first age (2 standing,
6 ruins) and the fire's 372 cells. After founding, the button and H toggle the lens, and the legend is inside the card's visible
area: a build without the reveal fails that on both profiles. After the flood the legend reads 493 cells reached and 18 eroded.
With the campaign, ruins and branch specs (run before the reach change): 12 passed. Captures between ages, while planning and
after the flood, on both profiles, inspected; review copy `docs/review/visual/v6-history.jpg`.
**Legacy score.** The ending's single "Lineage score" (the sum of every debrief's total) gave way to a **legacy** that counts
only what lasted (`src/engine/legacy/score.ts`): People (100 per person who came through the last catastrophe), Knowledge
(120 per technology still held), Works (30 per building standing, 150 more per landmark from an earlier age) and Feats (100
per feat), each with the count it rests on. Measured first:

- The debrief's livelihood added 10 for every completed building, so building and clearing the same Firebreak six times
  added 60 for nothing. Since rules 0.4.1 it counts the works standing when the minute ends.
- A land part was drafted, comparing the valley's end with how the first people found it, and dropped: between ages the
  valley regrows and is enriched on its own, so every recorded lineage that reached its last age ends far greener than it
  began (forest 369 → 491–627, fertility 493 → 687–765) whatever was built. It would have scored the centuries (K-023).
  Run cards keep the legacy and the rules version; "best for this valley" compares only runs scored under the same rules
  (a victory first, then the greater legacy, then more survivors), and the title shows the legacy beside each recent run.

**Verified (legacy):** typecheck, lint, **312 Vitest tests** (32 files; +4 legacy tests: nothing before the first catastrophe;
each part read from the state all thirteen recorded lineages end in, the landmarks matching the verdict's; the eight route
lineages' totals pinned, every victory above every defeat; building and clearing a Firebreak six times leaves the age's
livelihood and the legacy no higher; +1 run-card test, and the best-run test now also ranks by legacy). Mutations each fail
them: the old completion-counting livelihood (60 against 0), dropping the same-rules filter, dropping the legacy tie-break.
`scripts/record-traces.ts` and `scripts/record-feats.ts` re-run: only hashes and the rules version moved; every outcome,
survivor count, condition and feat is unchanged. Browser: the four victory replays now also read the ending's legacy (2420,
3030, 2650, 2530, the numbers the unit tests pin), and with the campaign, branch, modes and Codex specs, **26 passed** on
both profiles. The ending captured at 1366×768 and on the phone profile, inspected (review copy `docs/review/visual/v6-legacy.jpg`).
**Then and now.** The render layer photographs the valley from one fixed viewpoint, the default framing centred on the age's
hearth (`src/render/Snapshot.tsx`): once in the last three seconds of each minute, before the catastrophe resolves, and once
afterwards (between ages, or at the ending for the last age). Overlays are hidden for the shot, the sky dome and haze are set for
the snapshot camera and restored, and the frame is drawn into a corner of the canvas and read back. Between ages a slider lays
the two pictures over each other ("as the minute ended" against "420 years later"); the ending's Atlas pairs each age's two.
They live only in this session's memory. Writing the browser test found that the stall guard pauses the game when a software
frame takes over 2.5 s, so the test pauses the game itself while a picture is taken (the shot needs frames, not ticks).

**Verified (then and now):** typecheck, lint, **315 Vitest tests** (33 files; +3: "then" is asked for once in the last seconds
and "after" once the catastrophe has passed, from the same viewpoint; a recorded age pairs its minute with the valley between
ages; nothing behind the title, no "after" without a "then", and a new lineage forgets every picture). Two mutations (no title
guard, "after" without "then") fail them. Browser: `e2e/then-now.spec.ts` on both profiles plays the Archivists' recorded
lineage, stopping where a real minute gives frames: between the first two ages both pictures are real 16:9 frames of the same
size and differ, the slider moves the seam from end to end, and the ending's Atlas shows all three pairs. Both pictures saved at
full size and inspected: the Age I village as the minute ended, and the same view 420 years later with the forest back over it,
the hearth a ruin and the Seed Vault standing. The interregnum and the ending captured on both profiles and inspected.
Review copy: `docs/review/visual/v6-then-now.jpg`. The full suite on that build: 68 passed, 3 skipped, 1 failed. The failure was
the desktop real-time journey: the stall guard paused it ("the device stalled") while a full Vitest run with about 30 workers
competed for the CPU, against the hand-off's rule (`docs/CONTINUE_HERE.md`) of no heavy jobs beside the suite. Run alone, the journey spec passed three
times on desktop and twice on the phone.
**Chronicle of works.** The ending now tells the lives of the lineage's three most storied buildings (`src/ui/chronicle.ts`),
under the Atlas. The buildings chosen are those with the most recorded events, weighted towards landmarks and keepers of
knowledge. Each story retells the building's own provenance lines: ages named instead of numbered ("Restored by the people of the
Age of Iron"), the address dropped. It opens with who raised it (unless its first record already says so) and closes with the
knowledge it keeps and how it stands. In the Archivists' win, the Archive survived the fire, weathered into disrepair, was
restored by the people of the Age of Iron and keeps four technologies. The Quarry was dug up and restored twice.

**Verified (chronicle):** **318 Vitest tests** (34 files; +3: the most storied works are chosen, keeper of knowledge first; every
provenance line is retold, with no epoch number or address left and every sentence capitalised; the Archive's story exactly; a
hearth tells its own founding and a ruin how it lies). Two mutations (keeping the address, naming the wrong age) fail them. The
four browser victories also check every chronicle entry's form (title, story, how it stands), and with the campaign specs **14
passed** on both profiles. The chronicle captured on desktop and phone and inspected.
**Review fixes.** A code review of this session's work returned ten findings. Each was checked against the code first, and
nine were real:

- Run cards were stamped with the current rules version, not the lineage's own. A lineage resumed from an older save or branch
  point would have been ranked against runs scored under today's rules. Cards now carry the campaign's `rules`.
- _The River Held_ was earned by any flood that killed nobody while a levee or dam stood, even one that never reached the
  village. The engine now also projects the same flood with no levee or dam standing (`collapseEpoch`, a pure projection), and the
  feat needs the defences to have kept the water off a building, or hit it less hard. The levees-and-grove run still earns it.
- A building already in disrepair that a catastrophe touched without new harm was counted as "damaged by" it, which alone
  refused _An Age Without Loss_. Its integrity was also reset to what the light blow left, mending an older wound. It now
  "came through" the catastrophe "still in disrepair", is not counted as damaged, and integrity, like status, only worsens.
- _Three Kinds of Knowing_ was checked only when research finished, so a third branch read from dug-up tablets never counted.
  Founding an age checks it now.
- A save or branch point naming a feat this build does not know would have crashed the debrief and the ending. Loading drops
  unknown feats.
- The chronicle called a building still under construction or restoration a ruin. It now says the work was unfinished when
  the end came, and a repair is told as begun ("set about restoring it"), since the record is written when it is ordered.
- Three cleanups: the victory and the legacy share one landmark rule (`earlierLandmarks`); the four guarded storage helpers
  are one (`safeStorage`); the history legend rebuilds its layers only when buildings, the world or the age change.

The tenth finding was that _Fire Contained_ and _The River Held_ would accept a firebreak, levee or dam left by an earlier age.
In both scenarios the fire comes in the first age and the flood in the second, the age levees and dams can first be built, so
no inherited defence can stand at either. Nothing was changed; a comment at the check says what a scenario moving those hazards
later must add. The two feats' rule texts now say what is checked.

**Verified (review fixes):** typecheck, lint, **323 Vitest tests** (34 files; +5: an unknown feat dropped on load; the
levees-and-grove flood held against the same flood undefended, and for a building it reached less hard, and refused for
defences that changed nothing, a flood that reached no one, or no projection; a third branch from the dig counted at founding; an Archive in disrepair lightly hit is no
worse, keeps its integrity, and the report's damaged count matches the provenance; a building under construction is not called
a ruin; the run-card test also checks a card from older rules is never ranked). One mutation per fix fails the tests: the
current rules on cards, the flood without `held`, only buildings the water missed counted as spared, no check at founding, integrity reset, every touched building "damaged", no
filter of unknown feats, and the old chronicle ending. `scripts/record-traces.ts` and `scripts/record-feats.ts` re-run: only
hashes moved, on the five lineages where a catastrophe lightly strikes a building already worn by the centuries; every outcome,
survivor count, condition, action and feat is unchanged. Browser: the full suite on the fixed build gave 68 passed, 3 skipped,
1 failed (28.7 min). The failure was the desktop story spec: the stall guard paused the game right after a 176-tick fast-forward,
and the pause overlay took the click (K-011). The test-only hook ignored only the frame that straddles a jump, but the redraw a
jump causes can itself pass 2.5 s under software GL, so it now forgives the next three frames too. The full suite on that
build: **69 passed, 3 skipped, 0 failed** (27.2 min).

**Not verified:** a human playtest of whether the feats invite another lineage; WebKit; a real iPhone.

### Session 7 — Challenges: Phase 13's world modifiers as Phase 16's challenge mutators

**Engine (first milestone).** A lineage can begin with up to three **challenges** (`src/engine/content/modifiers.ts`), each
changing the world, a catastrophe or the people for the whole lineage, never the clock or the rules of play: Fertile Floodplain
(richer soil within six cells of the river, floods ×1.30), Dry Summers (fire ×1.30, floods ×0.80, food −15%), Soft Rock
(deposits ×1.5, quarries +25%, quake ×1.20), Fractured Fault (the quake's epicentre beside the first hearth), Overcrowded
Refuge (+4 people and −10 food at the start of every age) and Buried Library (an Archive older than the founders, buried west of
the first hearth, holding Writing and Hydrology). They are stored on the campaign in canonical order, hashed, saved and carried
by transcripts. A standard lineage has no challenge field at all, so every recorded hash and save is unchanged. Strength now has
one scaling function (`hazardStrength`: difficulty, then challenges); mapping the code first found that founding-site risk
scaled the quake by hand in a second place, which now calls it too. Starting people were never taken from the modifier bundle at
creation; they are now (no change for a standard lineage). The Grandparents' Library now asks for an Archive the lineage built,
so the Buried Library's older people do not hand it out.
**Measured on seed 6001** (both route bots, each challenge alone): every challenge changes what it says (the flood reaches 575
cells instead of 495 on the Fertile Floodplain, the fire 421 instead of 372 for the Archivists in Dry Summers, the quake 752
cells instead of 536 on the Fractured Fault, though both bots found their third age away from it), both routes still win every
one on both scenarios, and every run replays to its recorded hash. Overcrowded Refuge starves: 14 people on 20 food come through
the first fire as 7 or 8, not 9 or 10. Both bots dig the Buried Library up in the first interregnum; the Engineers spend their
one excavation on it and come through the flood worse (2 deaths and 4 buildings lost, against none and 2).
**Verified (engine):** typecheck, lint, **337 Vitest tests** (35 files; +14 in `tests/engine/modifiers.test.ts`: allowed sets
and canonical order; no field and an unchanged hash for a standard lineage; each challenge's exact effect on the world, the
strengths and the rates; the refugees at the start and at a founding; the library's site, its tablets reaching the next age and
no Grandparents' Library; room for the library on seeds 1–120; the forecast, the resolution and the founding sites using the
challenged strength; transcripts and saves keeping challenges, and forged sets refused). Ten mutations, one per hook, each fail
them: strength ignoring challenges, founding-site risk unscaled, rates ignoring challenges, foundings ignoring their extras, the
refugees not added at the start, the world not modified, a library without tablets, the library counted as grandparents, saves
not checked, transcripts dropping challenges. `scripts/record-feats.ts` re-run: only the Grandparents' Library rule text moved.
**Choosing them (second milestone).** The title has a Challenges list (`src/ui/Title.tsx`, `src/game/challenges.ts`): all six
are shown, and each opens once the device's Codex holds the feat that shows its kind of trouble has been met (Words Kept opens
the Buried Library, The Cycle Is Broken the Overcrowded Refuge, Not One Field Lost the Fertile Floodplain, The Fire Stopped Here
Dry Summers, Unshaken Soft Rock, Shored Up the Fractured Fault). A locked one says which feat opens it; one that does not suit the
scenario, clashes or would be a fourth says why. Chosen ones list their exact effects. Share links carry them (`mods=`, validated:
one bad name and the link carries none) and are honoured even where the device has not opened them; the Daily Ruins never carry
them. Run cards and branch points keep them, and "best for this valley" compares only lineages with the same challenges. The
briefing lists them every age, the ending names them, Play again, New valley and Copy link keep them, and the title's recent runs
show them. Everything that named a building's age now handles the library's people, older than the founders: the ruin
inspector ("Built before the founders came, by a people no record names."), the interregnum's ruin list, a restored building's
inspector, the chronicle (its own first record says who raised it) and the history lens (its own colour and a "Before the
founders" legend line). Building over a ruin now says so on the placement bar, and clearing or building over an Archive never dug
up warns that any tablets inside are lost (without saying what an unsurveyed ruin holds).
**Found by inspecting the captures:** on desktop the picker fell to one column, pushing New Lineage far down the card (now two
columns), and on the phone the effect bullets inherited the card's centred text (now left-aligned). The ruin inspector offered
"Clear ruin" for the library saying only "gives 3 stone": it now says the tablets would be lost too.
**Verified (choosing):** typecheck, lint, **345 Vitest tests** (36 files; +8 in `tests/game/challenges.test.ts`: unlocks from
the Codex and the reasons a challenge cannot be added; links carrying them in canonical order and dropping bad sets; a run card
keeping them and the ranking comparing only the same set; stored cards with sets this build cannot run dropped; the store
starting a lineage with them but never a Daily Ruins; the library's story in the inspector and the chronicle, and the clearing
warning). Eight mutations each fail them: ranking ignoring challenges, links trusting any set, stored cards unchecked, the Daily
Ruins taking challenges, locked challenges choosable, the library's age unnamed, the chronicle repeating its opener, and the
clearing warning dropped. Browser: the new `e2e/challenges.spec.ts` on both profiles (a fresh device sees 0 of 6 open and a
locked one does not toggle; with two feats in the Codex two open, the lineage begins with them, fourteen people and a buried
library, the briefing lists them and the library's inspector tells its story; a shared link brings Soft Rock to a device that
never opened it, and a clashing set brings none), with the modes, Codex, ruins, branch and campaign specs: **24 passed**. Title,
briefing and library captures inspected on desktop and phone (review copy `docs/review/visual/v7-challenges.jpg`).
**Twelve, and expeditions (third milestone).** Six more challenges bring Phase 13's count to the twelve it asks for, each through
a system the game already has: Storm Front (floods ×1.40, woods regrow half as fast again), Thin Woods (half the forest, half the
regrowth), Overgrown (forest ×1.4), Blight (farms ×0.75 until Crop Rotation), Rich Vein (no stone within 9 cells of the hearth,
every other deposit doubled) and Elders' Lore (the first founders know Masonry; research +20%). Thin Woods and Overgrown change
no hazard rule: the fire burns what fuel there is and the flood's peak follows the catchment's forest, so on seed 6001 Thin Woods
shrinks the fire from 337–372 cells to 144–228 and raises the flood to 549, Overgrown lowers the flood to 477, and Rich Vein's bare
knoll lets the fire spread a little further. Both route bots still win with each, and every run replays to its hash; Elders'
Lore leaves the bots' outcomes unchanged (their plans never use early Masonry). An **expedition** (a button in the Challenges box)
is a random valley with one to three challenges drawn from the open ones by its seed, so a seed always brings the same draw.
**Verified (twelve):** **351 Vitest tests** (36 files; +5 modifier tests: the forest at the start, regrowth compared on the same
world crossing the same centuries, the blight against the same farm with and without Crop Rotation, Elders' Lore's knowledge and
costs, the Rich Vein's map; +1 expedition test over 300 seeds of both scenarios: always a set the engine accepts as written, sizes
1–3 and all twelve drawn, only open ones). Six mutations each fail them (regrowth ignoring challenges, no blight, blight ignoring
Crop Rotation, founders knowing nothing, forest not thinned, the knoll left). Browser: `e2e/challenges.spec.ts` (now also an
expedition drawing only open challenges) **6 passed**, the modes and Codex specs **10 passed**, both profiles. The title with
twelve challenges captured on desktop and phone and inspected.
**Measured over 40 seeds** (`docs/balance/challenges.md`, from `scripts/challenges.ts`: each challenge alone, both scenarios,
the two route bots and the steward). Every challenge moves the catastrophes it names: the flood reaches 560–578 cells instead of
484–497 under Fertile Floodplain and Storm Front, 429–446 in Dry Summers; the first fire 171–232 cells in Thin Woods against
249–402, up to 485 when Overgrown or in Dry Summers; the quake 595 cells on Soft Rock and 747 on the Fractured Fault against 527.
The tuned routes barely notice most of them (Archivists 39–40/40 everywhere; Engineers lowest under Blight, 34/40, and Dry
Summers, 36/40). The Buried Library is mostly a gift: it lifts the steward from 4 to 20 of 40 on Greenvale. Elders' Lore changes
almost nothing for the bots. Bots do not read challenges, so this is what a challenge does to a fixed plan, not how hard it is.
**Watching a lineage again (Phase 13's replay viewer).** The ending offers "Watch this lineage": the finished lineage
replayed from its first day through the same engine (`GameStore.watchLineage`, driven by the clock): each accepted action is
applied at the tick it was logged, before that tick runs, exactly as `replayCampaign` does, while the minute runs at 1×, 2×
or 4× and the screens outside it wait a moment of wall time (the collapse waits out its cinematic). It is a viewing: the HUD's
controls are inert, only Space pauses, nothing can be selected, and nothing is saved, carded, branched or recorded in the
Codex. At the end the ending says whether the replay reached exactly the lineage's final state hash. On the phone the first
replay bar sat on the resource row, wrapped its title into a column and pushed Stop off-screen; it now takes the build tray's
place at the bottom (there is no tray while watching), on one row on desktop and two on phones.
**Verified (replay):** **356 Vitest tests** (37 files; +5 in `tests/game/replay.test.ts`: three recorded lineages, a
defeat among them, watched again through the real clock end in exactly their recorded hash; so does a lineage begun with a
challenge, at 60 fps and at 4× with 250 ms frames; nothing reaches the save, the run cards, the branch points or the Codex,
input is refused, and Stop restores the finished lineage; a wrong final hash is reported; only a finished lineage can be
watched, once at a time). Seven mutations each fail them: actions applied after their tick, actions one tick late, a match
always reported, the save overwritten, a run card written, a branch point saved, input not blocked. Browser: the new
`e2e/replay.spec.ts` on both profiles (the Archivists' recorded win watched again at 4×: no tray, the replay passes through
the second age, ends with "Replayed exactly" and the same title, and Back returns to the finished lineage's ending), 1 passed
each (4.8–5.5 min on desktop and 3.1–3.2 min on the phone, while the challenge measurement ran beside them). Captures of the
replay mid-way and of its result inspected on both profiles (review copy `docs/review/visual/v7-replay.jpg`).
**The long chronicle (Phase 16's endless play after the capstone, bounded at twelve ages).** A lineage that wins its
scenario's last age can carry its chronicle on (`endure`): centuries pass as after any age, and each later age brings
back one of the scenario's catastrophes in their order, 10% fiercer per age past the last authored one three ways at
once: reach (strength), harm to every building it reaches (`chronicleSeverityPm`), and every building's resistance
against it, divided by the same factor (`effectiveResistance`; the forecast's "resistance %" is the divided one), up to
age XII. Later ages carry no verdict:
the chronicle ends by itself at a debrief that leaves fewer than three people or after the twelfth age, or the player
rests it there (`rest`); every ending is a victory with its own unranked run card. `epochSpec(c, epoch)` replaced every
`scenario.epochs[i]` lookup (engine, UI, render), so the long chronicle's ages have names, peoples ("The Ember Folk"),
headlines ("The Second Great Fire"), provisions and the last age's architecture. `endure` and `rest` are logged actions,
so transcripts and the replay viewer (which now waits on a victory before carrying it on) reproduce a long chronicle;
`Campaign.endless` is absent otherwise, so no recorded hash moved. Route policies meet a returning catastrophe with the
plan they made for its first coming (`planAge`); `playCampaign(…, { ages })` carries a victory on and rests it. Branch
points keep only the newest that fit 2 million characters: a long chronicle's save reaches 0.57 million characters by
age XII (measured on the recorded Archivists' and Engineers' lineages carried on), and all of them together would crowd
the save itself out of the browser's storage. The ending offers one choice of age to replay from when there are more than
three, and the history lens has a colour for each of twelve ages.
**Why all three ways (measured while tuning, Greenvale, Normal):** with strength alone, every winning Engineers lineage
on seeds 1–15 (14 of 14) lived all twelve ages; a quake's intensity is capped per cell and a fire's harm is the share of a
footprint it burns. With harm scaled too, the Archivists still lived all twelve on seeds 1–6, losing 0–4 people per later
age, and so did the Engineers; even a 40% step (×4.6 by age XII) left the Archivists completing on seeds 1–4: a late
village's resistances sit at their cap of 98% (traditions stack every age), and multiplying its 2% vulnerability changes
little. Dividing resistance as well (the shipped rule, 10% step) keeps the Archivists, who build out of every
catastrophe's way, completing all twelve ages on seeds 1–6, while the Engineers, who hold the line with walls and
reinforcement, fall at ages VII–X on 5 of 6 seeds: defences age out; living out of harm's way endures.
**Verified so far:** typecheck, lint, **366 Vitest tests** (39 files; +6 in `tests/engine/endless.test.ts`: the
scenario's own ages untouched and later ages cycling their catastrophes with stepped strength, headlines, peoples and
provisions; every building's resistance divided and its harm scaled in a later age, on the same ground, as the
forecast's words say; a tradition for every founding up to the twelfth age;
the Archivists' recorded win carried into a fourth age, the Second Great Fire unjudged, the chronicle replayed exactly and
saved; resting only at a later age's debrief, ending by itself when too few survive or after the last age; saves
refusing a malformed chronicle or an age past the last; +3 in `tests/game/endless.test.ts`: the chronicle's own unranked
card, the store carrying a victory on and carding the chronicle when rested, the replay viewer passing through the
victory to the chronicle's end with the same hash, showing the victory for its wait; +1 branch test: the storage budget
keeps the newest points). Every recorded trace and feat hash is unchanged. Ten mutations each fail them: later ages
judged, too few survivors never ending it, defences never weakened, strength not stepped, resting allowed between ages,
the chronicle's card unmarked or ranked, the branch budget ignored, saves accepting later ages without the chronicle,
and the replay not pausing on the victory (that one first survived: the test only checked the victory was seen, not
for how long). Browser: the new `e2e/chronicle.spec.ts` on both profiles, **2 passed** (1.8 min): the Archivists'
recorded win carried on, 400 years pass, "Found age IV: The Ember Folk", the age IV briefing's chronicle goals, the
Second Great Fire, "Let the centuries pass" beside "Rest the chronicle here", the chronicle resting after four ages
with four Atlas entries and an unranked card on the title. Captures of the offer, the 400 years, the briefing, the
fire and the ending inspected on both profiles (review copy `docs/review/visual/v7-chronicle.jpg`). Before this work the full suite ran on the build PR #9 shipped
(`c73e412`/`24f1536`): **76 passed, 3 skipped, 1 failed** (44.0 min): the desktop real-time journey timed out on the
Skip button mid-catastrophe, and alone on the same build it passed (2 of 2, 1.8 min), the software-GL timing class
of K-011.
**Measured over 20 seeds** (`docs/balance/chronicle.md`, from `scripts/chronicle.ts`: both scenarios, Normal, the two
route bots, every victory carried on toward the twelfth age and never rested early). The Archivists, who build out of
every catastrophe's way, live all twelve ages on every seed of both scenarios (20/20 and 20/20), with 9.6–13.9 people
left after each later catastrophe on average. The Engineers, who hold the line with walls and reinforcement, complete the
chronicle on 8 of their 19 Greenvale victories and 14 of 20 on The Ashen Winter; the rest fall, mostly to the Fourth
Great Fire at age X (10 Greenvale lineages and 4 Ashen ones end there; the Greenvale mean is 3.2 people after it), a few
at age VII and one at age IV. The returning fires are the chronicle's killer: the floods and quakes (or ash winters)
leave the bots' villages largely standing even at ×1.9. Bots replay their first plans, so this is how fiercer returns
wear down a fixed plan, not how long a player who adapts can last.
**Two feats from the long chronicle (Phase 16's "keep a living cultural site through 5 generations").** **Five
Generations**: carry the chronicle on and keep a landmark built in the first age standing through the fifth age's
catastrophe. **The Twelfth Age**: come through the twelfth age's catastrophe with at least three people. Both are awarded
at the collapse like every feat, from the report just written; no three-age lineage can earn them, so no recorded hash
moved. A sixth recorded feat run, `fixtures/feats/long-chronicle.json` (the Archivists' victory on seed 6001 carried on,
`scripts/record-feats.ts` with `ages: 12`), earns both (Five Generations in age V: its first-age Seed Vault stands out of
every catastrophe's way) and, in age X, The Grandparents' Library: the fierce returns brought an Archive down and a later
age dug up its tablets. `tests/engine/feats.test.ts` replays it with its exact list. The Codex now counts 20.
**The Age of Spires (the long chronicle's look).** Ages IV–XII had reused Age III's slate roofs, so a valley twelve ages deep
looked three ages deep. Buildings raised in a later age now build in a fourth architecture (`era >= 3` in
`src/render/models/buildings.ts`): copper roofs gone green, a copper spire and pennant on cottages, a corner turret with a
lit slit window and a spire on stone houses, a lit lantern cupola on granaries, and a stone bell tower with a lit belfry on
Archives. The engine names those ages the **Age of Spires** (`epochSpec`), which moved only the long-chronicle feat run's
hash (its founding records name the age; re-recorded, the same feats). Captured with `scripts/showcase-spires.js` (the same
buildings raised in age III and in age IV, side by side) and inspected (`docs/3D_QUALITY_REPORT.md`, review copy
`docs/review/visual/v7-spires.jpg`): the copper and the spires tell the ages apart at play zoom; the pennants read only up
close.
**Verified (feats and spires):** typecheck, lint, **367 Vitest tests** (39 files; the long-chronicle feat run in
`tests/engine/feats.test.ts` with its exact list, the legacy test counting fourteen recorded fixtures, the spec test
naming the Age of Spires); two mutations (either new feat awarded at any later age) fail them. The full browser suite on
the long-chronicle build (`19664d0`): **78 passed, 3 skipped, 1 failed** (44.9 min; the desktop then-and-now spec waiting
in vain for a picture while a screenshot browser of mine ran beside it). On the final build: the then-and-now, Codex
(now twenty feats) and chronicle specs on both profiles passed, except that desktop then-and-now timeout once more,
alone; it then passed 6 times running (alone, and after the chronicle and Codex specs). Its cause is not found (K-011).

**Review fixes (PR #10, `fbcdada`).** An independent review of the branch found nine things, all fixed:

- **The bots planned against the wrong catastrophes in later ages.** A policy that sites its Archive clear of "the flood
  and the quake" (`avoidEpochs`) avoided their first comings at authored strength, not their next and fiercer returns.
  `avoidedAge` (`src/engine/ai/spots.ts`) now maps each to its next return at or after the current age (none past the
  twelfth). Re-measured over the same 20 seeds (`docs/balance/chronicle.md`), every lineage ended exactly as before: the
  Archivists complete 20/20 and 20/20, the Engineers 8 of 19 and 14 of 20. Only the Ashen Archivists' mean survivors
  moved, by 0.1 at three ages. The blind spot was not what wore the Engineers down; the fiercer fires are.
- **Harm could pass total.** A later age's damage was scaled after its 0–1000 scale was applied, so at age XII a fully
  exposed building without resistance could read "damage 190%" in the reasons, and the bots' loss estimate, which
  treats damage as a permille, was skewed. It is now capped at 1000: a return can at most destroy a building.
- **Five Generations** now needs a chronicle carried on, as The Twelfth Age does (a scenario with five authored ages would
  have awarded it in ordinary play).
- **Saves** refuse a long chronicle in an age before the scenario's last. A tampered save could otherwise play unjudged
  from age I.
- **Branch points are budgeted as stored.** Inside the stored list each save is escaped once more: at age XII 645,035
  characters against 571,021 raw (13% more), so the list could pass the 2 million it claimed to keep. Now it never does.
- **One model per architecture.** Ages IV–XII build the same Age of Spires models, but the model cache was keyed by age,
  so a twelve-age lineage built up to nine identical copies of each. It is now keyed by architecture (`eraOf`), as is the
  placement ghost.
- **One formula for how much fiercer an age is** (`chronicleStepPm`). Strength, harm and defences, and the briefing's
  percentage, each wrote it out.
- A later age's catastrophe cycles as `epoch % n` everywhere, and the scripts import `ROMAN` instead of copying it.

**Verified (review fixes):** typecheck, lint, **368 Vitest tests** (39 files). New or rewritten: foresight mapped to each
catastrophe's next return; the branch budget fitting exactly the newest three points, and only two at one character
less; the twelfth age's fire capped at 1000; a save beginning the chronicle in age II refused. Each of these four fails
against the code it replaces (four mutations). The long-chronicle feat run was re-recorded: its hash moved, its feats
did not. Every route trace re-recorded unchanged. Browser: `e2e/chronicle.spec.ts` on both profiles, **2 passed**
(1.6 min). A capture of the same buildings raised in age III and in age VII (ages the shared models now serve) was
inspected: copper roofs, spires, turrets and the granary's cupola, as in the age IV capture.

**Phase 18 begins: a build ready to ship, and the player's data in their own hands.** Nothing is deployed (that needs
the owner's confirmation, K-018); everything up to it is now built and checked:

- **Production headers, tested.** `vercel.json` sends a strict content security policy (`script-src 'self'`,
  `style-src 'self'`, images also from `data:` (the then-and-now pictures) and `blob:` (only what the page itself made), no objects, no framing, no
  other origin), a `Permissions-Policy` denying camera, microphone, location, payment and USB, `X-Frame-Options: DENY`,
  `Cross-Origin-Opener-Policy`, `nosniff` and `no-referrer`. `vite.config.ts` gives `vite preview` the same headers, so
  every browser test now runs under the production policy; `e2e/security.spec.ts` plays a whole age (the Great Fire,
  the debrief, the interregnum, the second founding) and downloads a backup with no violation reported, and checks the
  headers arrive.
- **A release check** (`scripts/verify-release.ts`, `npm run verify:release`, plain Node so CI runs it straight after
  the build): the page and every chunk it loads exist, no inline script or style, no source map, nothing that looks
  like a secret, at most 1.8 MB raw and 520 kB gzipped (now 1.52 MB and 433 kB), and `vercel.json` builds `dist` with
  the policy, `nosniff` and an immutable cache for the hashed assets. CI's verify job runs it.
- **Backups** (`src/game/backup.ts`, Settings, Your data). The section says plainly what the game keeps and that
  nothing is sent anywhere. **Export a backup** downloads one JSON file: the saved lineage (with its Daily Ruins date
  and branch mark), the Codex and the run cards. **Import a backup** treats the file like stored data: the lineage
  must read back whole (the save's shape and integrity checks), Codex entries and run cards are checked one by one
  (only good ones kept, the rest counted as left out), a Daily Ruins date or branch mark is kept only if it fits the
  lineage, and nothing is written until the player has seen what the file holds (and what it would replace) and
  confirmed. Feats and run cards join the browser's own (each feat keeps its first earning; cards once each, newest
  first, at most 40); the lineage replaces the saved one, and the branch points of the one it replaces go.
- **Starting over asks first.** There is room for one saved lineage, and New Lineage, Random valley, the Daily Ruins and
  an expedition used to replace it silently. Now, when it has progress (begun and not ended), the title asks "Start a
  new lineage?", naming it, with Keep it focused (Escape keeps it too) and a pointer to the backup.
- **Run cards checked more strictly.** A stored card is now dropped unless every field the title shows is well
  formed: a long chronicle's card with a number for a title would have broken the title screen, and an imported file
  is a new way for one to arrive.
- `docs/RELEASE_CHECKLIST.md`: the commands, what the release serves, the Vercel steps and smoke checks for when the
  owner confirms a deployment, the privacy statement, the twelve flows prompt 18 asks for with their evidence (10 done,
  2 partial) and the browser matrix (Chromium desktop and the iPhone profile only; no WebKit or Firefox here).
- **Fallbacks, browser-tested.** A browser without WebGL gets a page saying what is wrong and how to fix it. When the
  3D scene cannot start (its graphics context refused), the error screen now offers Export a backup, and Start fresh asks
  once more before it erases the saved lineage (`e2e/fallback.spec.ts`).
- **The 320 px top bar (K-008).** The four top-bar buttons keep 44×44 px on the narrowest phones; the gaps, the side
  margins and the timer give up the room. `e2e/layout.spec.ts` now measures every top-bar button on every phone size and
  checks that the timer's digits fit, and larger text (125% and 150%) keeps Begin reachable without sideways scrolling.
- **Ten new worlds** (`e2e/memory.spec.ts`, desktop): one canvas stays, and the heap after a forced collection goes
  10.3 → 11.5 MB, within the test's 25% bound but rising about 0.12 MB a world (K-025).

**Verified (Phase 18):** typecheck, lint, **380 Vitest tests** (41 files). New: 7 in `tests/game/backup.test.ts` (a
lineage, its branch mark, Codex and cards carried to an empty browser exactly; a Daily Ruins date kept only for that
day's valley; feats and cards joined, first earnings kept and the newest 40 cards; the replaced lineage's branch points
dropped; files that are not backups refused and unreadable parts left out; the store bringing one in; a new lineage
asking only when progress would be lost), 1 in `tests/game/robustness.test.ts` (cards with malformed shown fields
dropped) and 4 in `tests/release/` (the release check against small synthetic builds). Twelve mutations each fail a
test: eight of the backup and card rules, four of the release check. `npm run verify:release` passes. Browser, on the
final build: `e2e/backup.spec.ts`, `e2e/security.spec.ts`, `e2e/fallback.spec.ts` and the extended `e2e/layout.spec.ts`
on both profiles, `e2e/memory.spec.ts` on desktop and `e2e/journey.spec.ts` again, 30 passed (2 skipped: the phone runs of
two desktop-only tests).
Captures inspected: the confirmation, the import preview and the export note on both profiles, the no-WebGL page and the
error screen on both, and the top bar at 320×568. The first full-suite run on this work was cut short at test 39 of 90:
the preview server it used hit my tool's 30-minute limit for background jobs. Of the 38 that ran, 37 passed; the
desktop real-time journey timed out on a screenshot while I ran the typecheck and lint beside it, and alone it passed
(1.2 min).

**Phase 19 begins: an adversarial review.** A separate agent was given prompt 19, the code and
`docs/KNOWN_ISSUES.md`, but none of my conclusions, and asked for real defects with evidence. It ran nothing (a browser
suite was running) and reported ten, each with the file and line. Each was traced again in the code before it was
fixed, and each fix has a test that fails on the code it replaced; `docs/ADVERSARIAL_REVIEW.md` has the table (severity,
root cause, fix, test), the attack list as checked, and the verdict. Rules 0.4.2.

- **A damaged carrier could take more than an untouched one (P1).** The collapse counted what an Archive or hearth
  carries from the catastrophe's verdict for that building alone, which ignores an older wound: a damaged, nearly
  fireproof Archive that the fire barely touched carried its full share, while the same Archive kept out of harm's way
  carried half. One rule (`statusAfter`) now decides both what a building is after the catastrophe and what it carries,
  and `carryOf` is the one count, which the inspector reads too.
- **Ruins that fall again.** A restored Archive that fell again kept its "dug up" mark, so its new tablets could never be
  recovered. A standing building that falls is now a new ruin, to survey and dig again; a restoration still under way
  when it falls is not dug twice. A founding site that would clear an Archive never dug up says its tablets would be
  lost.
- **No decision in the last 15 seconds.** A decision could open with 15 s left and its deadline on the catastrophe's
  tick, so its free default (the seeping dam's "it weakens") was never applied. The last now opens at 44 s and each is
  settled by 59 s; a test checks every recorded lineage.
- **The inspector reads the engine.** It computed its own figures and misstated what a building carries (Writing's +2
  on a hearth, a damaged carrier at full) and what it resists (base values only, past 100%, no ash). It now reads
  `carryOf` and `effectiveResistance`, and a construction site the catastrophe would take says "Will be destroyed".
- **Every opening order listed.** Repair, reinforce and demolish orders given while planning used opening slots the
  briefing neither listed nor let you withdraw. Every order is now listed with Withdraw, Repair and Reinforce are not
  offered twice, and the list is brought into view when an order is given or the card opened: on a phone the card is
  closed while an order is placed, and opened it showed its top, the orders out of sight below the forecast.
- **The replay viewer keeps its path.** Withdraw called the engine directly, past the store's replay guard, so the
  keyboard could knock a replay off its record. It goes through the store, and a test fails if any screen calls an
  engine function that changes the campaign.
- **A save that cannot be read is set aside**, as the title says, under its own key, instead of being erased.
- **Words that match the code.** Growth needs food for half a second a person, not 6 s; a seeping dam irrigates half as
  well rather than not at all; Irrigation is a flat 25%; Clear the brush takes trees and scrub within about 4 cells;
  "10 seconds left" was never spoken and now is; the seed "0" silently started valley 6001 and is now hashed like a
  word.
- **A backup cannot launder a lost age.** Export, lose, import and play again gave a ranked result. A lineage brought
  back once begun is a branch from the age it was in, and the import says so.

**Verified (Phase 19):** typecheck, lint, **392 Vitest tests** (43 files). New: 6 in `tests/engine/adversarial.test.ts`,
6 in `tests/game/adversarial.test.ts` and two seeds in `tests/game/modes.test.ts`; the backup test now expects the
imported lineage's branch. Eleven one-line reverts of the fixes each fail a test (`docs/TEST_RESULTS.md` lists them),
and the phone briefing's new check fails on the previous build (the order measured at viewport ratio 0) and passes on
this one. Route traces and feat runs re-recorded under rules 0.4.2: every outcome, survivor count, condition, action
count and feat unchanged; only hashes moved. Browser: `e2e/plans.spec.ts` (new) with the story, ruins and backup specs
on both profiles, 14 passed; on the final build the plans and journey specs, 5 passed and 1 skipped (desktop-only).
Captures inspected: the inspector's carry and resistance lines on desktop, and the briefing listing the reinforcement
on both profiles (on the phone only after the fix). Before this work, the full suite on the Phase 18 build (`91dc6de`):
96 passed, 4 skipped, 0 failed (47.9 min). Not done: a human playtest, WebKit or a real iPhone, real-GPU frame times, a
deployment.

**Phase 19 continues: the visual gate.** `scripts/gate-shots.mjs` captures prompt 19's scenes from the built app at
1920×1080, 1366×768, 390×844 and 320×568: the title, a new lineage, a placement, and the Engineers' recorded win on seed
6001 replayed in the browser to 35 s and 3 s left in each age, the fire mid-cinematic, the first interregnum and the third
age with the interface hidden, plus the showcase close-up and the Age of Spires. Every image was opened; what they showed,
and what changed in the scene itself:

- **The catastrophe now shows itself before it strikes.** Three seconds before the Great Fire the valley was calm and
  only the interface warned. From 30 s left (`src/render/Omens.tsx`), smoke rises where the fire will start and leans
  with its wind while embers drift over the valley; rain falls before a flood; dust is thrown up over the quake's
  forecast zone (an ashfall already showed its ash). All of it comes from the engine (the age's hazard, its origin and
  wind, the forecast) and changes nothing in the game.
- **Ruins show through the history lens**, which hid them under opaque hatching: a light fill under the same outline.
- **The land past the board** had one flat green beside villages near the edge: meadow patches and bushes now.
- **Buildings sit on the land:** they take the valley's cloud shadows, walls darken toward the ground, flat walls are
  faintly mottled and roof slopes are smoother than walls.
- **Phones:** the camera's focus sits in the middle of what the interface leaves uncovered on a portrait screen
  (measured when the screen changes, never while aiming), so the title shows its village above the sheet and a 320 px
  phone sees its hearth; the phone title sheet drops the seed hint and shows Continue only when there is something to
  continue.
- **Tooling found on the way:** the capture scripts' injected styles were refused by the production CSP since Phase 18
  (their contexts now bypass it; the game never injects a style), and replayed stills showed every villager at the
  hearth (a debug-only `settleCitizens()` puts them where they were walking to).

Scores from the final captures: geometry 4, composition 4, material shading 4 (3 before the building pass), lighting 4,
foliage 4, water 3, citizen life 3, historical progression 3, HUD restraint 4, touch usability 4 — the four core
categories at 4, judged from software-GL stills only.

**Verified (visual gate):** typecheck, lint, **396 Vitest tests** (45 files; new: the omens' timing and the phone focus
row). Captures inspected as listed in `docs/ADVERSARIAL_REVIEW.md`, with no console errors in any capture run;
before-and-after copies in `docs/review/visual/v7-gate-*.jpg`. Browser, on the final build: the **full suite, 98
passed, 4 skipped, 0 failed** (45.2 min, every phone test tapping through the new framing); the new `e2e/omens.spec.ts`
(the fire's smoke and embers from 30 s left, nothing before, nothing once it strikes) passes on both profiles and fails
with the omens removed from the scene.

**After the gate.** The river reflects the sky's gradient, more strongly toward grazing angles, over a slightly deeper
channel: in stills the far reaches shine and the near water shows its depth (`v7-gate-water.jpg`; not re-scored).
**K-025 diagnosed:** heap snapshots after 2, 12, 22 and 32 new worlds (22.8 → 24.1 → 24.7 → 24.9 MB, growth per ten
worlds falling from 1.3 to 0.2 MB) put nearly all of the growth in V8's compiled code (5.2 → 7.1 MB), which levels off,
plus the browser's capped event-timing buffer; no game object accumulates per world. The villagers' distance-field cache,
which could have kept one field for every cell an idle villager ever wandered to, is now capped at 64 (it was not what
the snapshots measured).

**Later ages build their own forms.** Prompt 19 asks whether later eras are more than recoloured buildings; Ages I–III
only re-roofed. Now the Age of Bronze adds tiled porches and turns the round hut into a stone drum, and the Age of Iron
raises houses a storey (a stone ground floor under a jettied timber-framed floor, a chimney through both), gives the
stone house a second storey and the granary a loft door and hoist; the Age of Spires keeps its copper and spires on the
taller forms (`docs/3D_QUALITY_REPORT.md`, `v7-ages-forms.jpg`). Inspected in close and village captures; the probe's
showcase scene costs one more draw call and 2–3% more triangles (`docs/PERF.md`).

**Science, ecology and monuments (prompt 19's question, answered by ablation).** The Engineers (monuments and
engineering) and the Archivists (knowledge) each lose without their own mechanism (the route ablation tests). Ecology had
no route: the steward, the one ecology-minded bot, wins 7 of 100 Greenvale seeds. A tuned **Ecologists** route (two or
three fields an age off the hazard, Irrigation, Forestry, Crop Rotation and Writing, one Archive, a Seed Vault out of
harm; no levee, dam, wall, firebreak, stone house or granary) wins 100 of 100 Greenvale seeds and 40 of 40 on The Ashen
Winter. Taking its parts away shows what wins it. In The Ashen Winter it is the fields: the Ecologists seal no Granary,
and with one field an age the same plan starves (2 of 40; seed 6001: 7 starved, 28 food put by against 50 needed). On
Greenvale nothing ecological decides the verdict: one field an age wins 40 of 40 too, the ecology branch swapped for
Masonry, Bronze Tools and Hydrology wins 39 of 40 with as many survivors, and an earlier version's Groves, planted where
the forecast flood would run, changed no outcome (the route plants none). Probes of the economy say why (K-027): food
never binds outside the ash winter (every route sits at its housing cap 83–98% of the minute, and the Ecologists end an
age with a median 92 food unspent), a lumber camp cuts at full rate from about 31% cover and fells only ~2,300‰ of its
woods an age (so Forestry's lighter felling never changes its output; at stricter thresholds the Ecologists still cut as much timber without Forestry and Groves, within 2%), and the
flood follows the whole valley's forest, which no route moves by more than a few points. The Ecologists' two wins are
recorded (`fixtures/{greenvale,ashen}/ecologists.json`, existing fixtures unchanged), replayed headless and in the browser,
and the Greenvale result is pinned by a test so a rules change that makes the land matter has to face it. The balance
reports were regenerated with the Ecologists under rules 0.4.2 (every earlier policy's figures unchanged).
