# CONTINUE HERE

**Branch:** `claude/determined-wright-c0aptv` · **PR:** the open PR for this branch (#12, the Phase 19 review fixes; PRs #1–#11 were merged, often within minutes of CI going green; each time the branch was brought up to `main` without rewriting pushed history, because force-pushes are refused here, and a new PR opened) · Last verified commit: see `git log -1`.

## State

The 3-epoch loop is **playable in the browser and winnable two different ways on both scenarios** (Chromium-verified): title → plan → build → 60 s → collapse cinematic →
debrief → interregnum (ruins, survey/excavate, sites, traditions) → next age → … → ending → Play again. Session 4 rebuilt the look to a painterly diorama (shared
atmosphere, sky and haze, smooth tree species with autumn accents, masonry, the valley continuing past the board, birds, instanced smoke, high-tier tilt-shift and grade)
and the collapse visuals (smooth flood / quake / ash fronts, a travelling fire wall), added WebGL context-loss recovery, an error boundary, validated storage, modal focus,
and fixed what a second independent review proved (unreachable traditions, repair/hearth/queue bugs, stale forecast, finished-run re-save, Daily tag, Assisted ranking,
exact arithmetic in hashed state) with mutation-checked behavioural tests. Visual iteration 3 covered every required viewport (scores 4/5 on the seven criteria
judged from stills); desktop hover highlights buildings. Session 5 (rules 0.4.0) made Normal need two separate preparations: an Archive carries the
knowledge but is no longer a landmark, so a win also needs a Hearth a later society kept, a Seed Vault, a Dam or a Bridge — and the planning card says
so. Session 6 began Phase 16: **18 feats** (20 since session 7's long chronicle) awarded by the engine at the moment they happen (`src/engine/legacy/feats.ts`, kept in
`lineage.feats`, so replays earn exactly the same ones), each earned by at least one recorded run (`fixtures/feats.md`); a device-local
**Codex** on the title; and on the ending an **Atlas of Ages** (one entry per age) plus two or three **ideas for the next lineage** drawn
from what the run lacked. Pressing a ruin tells its age, purpose, how it fell and what clearing or restoring does now; a lineage can replay an age
from its founding as an unranked branch; a **history lens** on the map (always on between ages, `H` or a button while planning) shows each
age's buildings and ruins, where each catastrophe reached (from its report) and the eroded ground; the ending's **legacy** counts only what
lasted (people, knowledge, works, feats), and since rules 0.4.1 the debrief's livelihood counts standing works, so clearing and rebuilding
farms nothing; **then and now** pictures of each age, from one viewpoint, compare as a slider between ages and pair up in the Atlas
(session memory only); a **chronicle of works** on the ending retells the most storied buildings' lives from their recorded events. A code review of
that work found nine real defects (run cards stamped with the current rules, two feats checked too loosely or too rarely, a worn building lightly
struck counted as damaged and mended, unknown feats able to crash the ending, a building under construction called a ruin), all fixed with
mutation-checked tests (`docs/PROGRESS.md`, session 6). **Session 7** adds **challenges**, Phase 13's world modifiers as Phase 16's
challenge mutators: twelve in the engine (`src/engine/content/modifiers.ts`, `world/modify.ts`; absent from standard lineages, so no
recorded hash moved), opened on the title by Codex feats (`src/game/challenges.ts`), carried by share links, run cards and branch
points, ranked only against the same set, listed on the briefing and the ending; an expedition draws one to three of the open ones
for a random valley; `scripts/challenges.ts` measures each with the bots (`docs/balance/challenges.md`). A finished lineage can be
**watched again** from the ending: replayed through the clock at 1–4×, ending in exactly its recorded state hash. A victory
can be **carried on** as **the long chronicle** (endless play after the capstone, bounded at twelve ages;
`src/engine/legacy/endless.ts`, `epochSpec` in `content/scenario.ts`): each later age brings back one of the scenario's
catastrophes, 10% fiercer per age in reach, harm and every building's resistance; later ages are not judged, the chronicle
ends when fewer than three survive or after age XII, or is rested at a debrief, and gets its own unranked card. Over 20 seeds
the Archivists live all twelve ages every time and the Engineers fall on about half (`docs/balance/chronicle.md`, K-024). A code review of PR #10 found nine things (the bots' foresight aimed at first comings, uncapped harm, a feat and saves checked too loosely, the branch budget undercounting stored size, duplicated models and formulas), all fixed with mutation-checked tests; the re-measured chronicle ended every lineage as before. **Phase 18** began in session 7: the build is deploy-ready and checked (`docs/RELEASE_CHECKLIST.md`): `vercel.json` sends a strict content security policy and other headers, `vite preview` sends the same ones so every browser test runs under them, and `npm run verify:release` checks the built `dist` in CI (whole, within its size budget, headers in place); Settings, Your data exports the saved lineage, Codex and run cards as one file and imports one back after checking it like stored data; a new lineage over a saved one with progress asks first. Nothing is deployed (K-018). **Phase 19** began in session 7: an independent adversarial review found ten real defects (a damaged Archive carrying more than an untouched one, ruins that could not be dug twice, decisions whose default never applied, an inspector with its own arithmetic, unlisted opening orders, a replay knocked off its path, an unreadable save erased, texts the code contradicted, a backup laundering a lost age); all are fixed with tests that fail on the old code (rules 0.4.2), and `docs/ADVERSARIAL_REVIEW.md` holds the table, the attack list, a manual QA runbook and the verdict (not a pass). Scores per capture iteration: `docs/3D_QUALITY_REPORT.md`; what is still open: `docs/KNOWN_ISSUES.md`.

## Pre-push gate (mandatory, no pipes)

`npm run typecheck && npm run lint && npm test && npm run build && npm run verify:release` — then `npx playwright test` for UI changes (≈ 21 min for 70+ cases; do not run heavy jobs beside it). After any rules/content/bot/feat change:
`npx vite-node scripts/record-traces.ts` and **read the diff of `fixtures/greenvale-traces.md`** (a route that stopped winning must be understood, not silently re-recorded),
then `npx vite-node scripts/record-feats.ts` (it fails if a feat run stops earning its feat) and update the expected lists in `tests/engine/feats.test.ts`
from `fixtures/feats.md` — any state change moves every recorded hash, so both scripts must run.

## Next exact steps (highest value first)

0. **Phase 19 visual gate on the final build** (if `docs/ADVERSARIAL_REVIEW.md` still says it is not run): canonical captures
   with `scripts/visual-shots.mjs` (seed 6001, fixed cameras; add the crisis, archaeology, Age of Spires and 320×568
   scenes), inspect every image, score the ten categories prompt 19 names, fix what scores under 4 in the meshes and
   lighting, then record the scores and the verdict.
1. **Game depth, next layer (K-003, K-019).** Normal now needs an Archive _and_ a landmark, but a player who knows both moves still wins Greenvale/Normal
   easily (`npx vite-node scripts/recipes.ts`); fire-born traditions guard against a hazard that never returns. Candidates: let the landmark's type matter
   (a Dam or Bridge counting for more), let later ages carry fire risk, or give the fire lessons a lasting upside — after a human playtest — then re-run
   `scripts/sim.ts`, `scripts/recipes.ts` and the traces.
2. **Real devices.** WebKit when available (`EPOCH_WEBKIT=1`), a physical iPhone and a real-GPU desktop for frame times (K-001, K-009); the frame-time governor and
   the stall guard are tuned on software GL only.
3. **Phase 17 remainder:** a manual screen-reader pass (K-016).
4. **Phase 16 remainder (K-022):** other variety unlocks (terrain packs, real-art building skins); the long chronicle's
   later ages have their own architecture (the Age of Spires) but reuse the catastrophes and buildings (K-024); K-023 (the land keeps no lasting mark of its use, so the legacy has no land part);
   K-020 (knowledge is almost never lost, so the rediscovery and tablet rules sleep).
5. **Phase 13 / 14:** authored 8–12-epoch scenarios (expeditions' variable epoch target needs them; the long chronicle
   already lets a won lineage live twelve ages), sandbox (K-004); a recurring fire season challenge would also answer K-019; villager personas and interiors, Age III skyline, more
   story decisions.
6. **Phase 18 remainder:** deployment only with the owner's explicit confirmation (nothing is deployed; K-018; the steps and smoke checks are in
   `docs/RELEASE_CHECKLIST.md`); Firefox and WebKit runs where a build of them exists; font scale and safe areas, the no-WebGL fallback in a browser
   test, memory over ten new worlds (the checklist's flow table says what is partial). A human playtest (K-014) and listening to the audio (K-015)
   are the biggest unmeasured things.

The session-4 visual process (standard, plan, quality report with per-iteration scores) is in `docs/3D_*.md`; `scripts/visual-shots.mjs <tag> --set full` repeats
every capture (`COLLAPSE_T=0.2` freezes a collapse earlier), and `scripts/perf-probe.mjs` measures the scene cost per tier.

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
- Playwright reuses any server already listening on port 4173 (`reuseExistingServer`). For a mutation check, run `fuser -k 4173/tcp`, build the
  mutated code and start `npx vite preview --host 127.0.0.1 --port 4173` yourself, or the test may run against a stale build and pass.
- PRs #1–#5 are merged. Check `git rev-list --left-right --count origin/main...HEAD` before trusting that your branch has an open PR. If its PR was merged and `main` contains the
  branch's pushed head (PRs here are merged with a merge commit), rebase only the unpushed commits onto `origin/main` — the push is then a fast-forward; otherwise merge `main` into
  the branch. Never force-push (it was refused in this environment). Then open a new PR.
