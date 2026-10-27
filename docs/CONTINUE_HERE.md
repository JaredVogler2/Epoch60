# CONTINUE HERE

**Branch:** `claude/determined-wright-c0aptv` · **PR:** https://github.com/JaredVogler2/Epoch60/pull/3 (PRs #1 and #2 were merged; #2 merged a minute after it opened, so later commits needed a new PR) · Last verified commit: see `git log -1`.

## State

The 3-epoch loop is **playable in the browser and winnable two different ways on both scenarios** (Chromium-verified): title → plan → build → 60 s → collapse cinematic → debrief → interregnum
(ruins, survey/excavate, sites, traditions) → next age → … → ending → Play again. Ages change the architecture (thatch → tile → slate); 17 buildings, 9 techs and **four disasters** (fire, flood,
quake, ashfall) have tested effects; seven state-derived story decisions appear as a deadline chip; two scenarios (Greenvale, The Ashen Winter) and three difficulty tiers; seed links, Daily Ruins and local
run cards; procedural audio with mute; keyboard-only placement and a live announcer; an adaptive DPR governor. Executed winning routes (Engineers, Archivists) and credible losses are recorded in
`fixtures/` and replayed headless (`tests/engine/routes.test.ts`) and in the browser (`e2e/victory.spec.ts`, hash-identical). **208 unit tests; Playwright 44 passed / 2 skipped on desktop 1366×768 and an
iPhone-13 touch profile.** Balance: `docs/BALANCE_REPORT.md` and `docs/balance/` (Normal is easy for competent play; Hard separates the routes — K-003, K-017).

## Pre-push gate (mandatory, no pipes)

`npm run typecheck && npm run lint && npm test && npm run build` — then `npx playwright test` for UI changes (≈ 11 min; do not run heavy jobs beside it). After any rules/content/bot change:
`npx vite-node scripts/record-traces.ts` and **read the diff of `fixtures/greenvale-traces.md`** (a route that stopped winning must be understood, not silently re-recorded).

## Next exact steps (highest value first)

1. **Phase 19 — independent adversarial review.** The brief is in the session scratchpad (`review-brief.md`; regenerate from `prompts/19_FINAL_ADVERSARIAL_REVIEW.md` if gone). Run it on a fresh agent with the
   code, not with conclusions, and fix what it proves (it has not been run yet).
2. **Phase 17 remainder:** landscape phones, ≤ 360 px touch targets (K-008), a manual screen-reader pass (K-016), WebKit when available (`EPOCH_WEBKIT=1`), real-device frame times (K-009).
3. **Phase 13:** 8–12-epoch campaigns, ≥ 12 modifiers, expeditions, sandbox, replay viewer (K-004). **Phase 16:** meta-progression. **Phase 14 polish:** citizen outfits per age, Age III skyline, flood-edge and quake
   fracture geometry, then-vs-now slider, more story decisions.
4. **Phase 15 follow-ups:** make Normal harder or default to a harder tier after a human playtest; give the Hard Ashen Engineers a second landmark (K-017).
5. **Phase 18 — deployment** only with the owner's explicit confirmation (nothing is deployed; K-018). A human playtest (K-014) and listening to the audio (K-015) are the biggest unmeasured things.

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
