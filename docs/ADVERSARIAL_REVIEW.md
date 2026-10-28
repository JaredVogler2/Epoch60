# Adversarial review (Phase 19)

Prompt 19 asks for seven skeptical testers, real defects with evidence, fixes with regression tests and a truthful
verdict. This file records what was done in session 7, what was found, what was fixed and what remains unverified.
It is not a summary of strengths.

## How the review was done

- **An independent reviewer.** A separate agent, given the prompt-19 brief, the code and `docs/KNOWN_ISSUES.md` but
  none of my conclusions, read the engine, the browser-side state and the interface (read-only: it ran nothing while a
  browser suite was running) and reported ten defects with file:line paths, and the attack-list items it found sound
  with the code that makes them so. Every finding below was re-traced in the code before it was fixed; none was
  taken on trust.
- **Automated play, not a human.** No person played in this review. Items that need one (fun, readability, whether
  a player wants another try) are marked UNVERIFIED below, not guessed.

## What was found, and what was done

| #   | Sev. | Finding                                                                                                                                                                                                                                                                                                        | Root cause                                                                                                                                                             | Fix                                                                                                                                                              | Regression test                                                                                                                |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | P1   | A damaged Archive or hearth that the catastrophe barely touched carried its full share of technologies (more than if untouched), so on Hard keeping the Archive out of harm's way could lose the game.                                                                                                         | The retention count read the hazard's verdict for the building alone (`classify(damage)`), which ignores an older wound; the structure loop kept the building damaged. | One rule, `statusAfter`, for the village and for what its carriers take; `carryOf` is the one count, shared with the inspector. Rules 0.4.2.                     | `tests/engine/adversarial.test.ts`: a damaged, near-fireproof Archive in the fire's path carries what its final status allows  |
| 2   | P2   | A restored Archive that fell again could never be dug up (its new tablets lost); founding a hearth over an un-dug Archive cleared it without a word.                                                                                                                                                           | `excavated` was never reset; the founding site card did not look under its pad.                                                                                        | A standing building that falls is a new ruin (survey and dig again); a site that clears an un-dug Archive says so.                                               | the same file (dig again; a restoration site that falls is not dug twice); `tests/game/adversarial.test.ts` (the site warning) |
| 3   | P2   | A decision opened at tick 450 never resolved: its free default (for the seeping dam: "it weakens") was never applied.                                                                                                                                                                                          | Opening was allowed at exactly 15 s left; its deadline was the tick the catastrophe takes.                                                                             | Nothing opens in the last 15 s (the latest at 44 s, settled by 59 s).                                                                                            | engine test at ticks 440 and 450; every recorded lineage's decisions opened before 45 s and were settled                       |
| 4   | P2   | The inspector misstated what a building carries (Writing's +2 on a hearth; a damaged carrier at full), its resistances (base only, over 100%, no ash) and called a construction site that would be lost "damaged".                                                                                             | The panel computed its own numbers.                                                                                                                                    | It reads `carryOf` and `effectiveResistance` (every bonus, tradition, wall, the cap and the age's severity), shows ash, and says "Will be destroyed" for a site. | `carryOf` values in the engine test                                                                                            |
| 5   | P2   | Repair, reinforce and demolish orders given while planning used opening slots the briefing did not list or let you withdraw.                                                                                                                                                                                   | The briefing listed builds and research only.                                                                                                                          | Every opening order is listed with Withdraw; Repair and Reinforce are not offered twice while one is waiting.                                                    | `e2e/plans.spec.ts`                                                                                                            |
| 6   | P2   | The replay viewer could be thrown off its recorded path from the keyboard (Withdraw plan during a replayed planning phase).                                                                                                                                                                                    | The button called the engine directly, past the store's replay guard.                                                                                                  | It goes through `store.dispatch`.                                                                                                                                | `tests/game/adversarial.test.ts`: no screen calls an engine function that changes the campaign                                 |
| 7   | P2   | Continue erased a save it could not read while saying it was "set aside".                                                                                                                                                                                                                                      | `abandonSave` cleared it.                                                                                                                                              | It is set aside under its own key, then cleared.                                                                                                                 | the same file                                                                                                                  |
| 8   | P2   | GAME_RULES said growth needs 6 s of food in store; the engine needs half a second's.                                                                                                                                                                                                                           | Documentation drift.                                                                                                                                                   | The rules now say what the engine does (the measured balance is the engine's).                                                                                   | —                                                                                                                              |
| 9   | P2   | Texts claimed what the engine does not: a seeping dam "loses its irrigation" (it keeps half), Irrigation is "most of all on dry soil" (flat +25%), Clear the brush "strips grass within 3 cells" (trees and scrub, about 4), "10 seconds left" was never announced, and seed "0" silently started valley 6001. | Text written to intent, not to the code.                                                                                                                               | Each text matches the code; the announcer speaks 10 s between the second and last warnings; out-of-range numbers are hashed like words.                          | announcer timing and seed tests                                                                                                |
| 10  | P2   | A backup could retry a lost age with a ranked result (export, lose, import, play again), against "branches are never ranked".                                                                                                                                                                                  | Import restored a branch mark only if one existed.                                                                                                                     | A lineage brought back from a backup once begun is a branch from the age it was in; the import says so.                                                          | `tests/game/adversarial.test.ts`                                                                                               |

Findings 6 and 10 were introduced by code written this session (the replay viewer and the backups); the others predate
it.

One more came from looking at the browser captures of finding 5's fix, not from the reviewer:

| #   | Sev. | Finding                                                                                                                                                                                                                                  | Root cause                                                                                                      | Fix                                                                           | Regression test                                                                                  |
| --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 11  | P2   | On a phone the opening orders were out of sight: the briefing is closed while an order is placed, and opened it showed its top, the orders below the forecast (Playwright measured the order at viewport ratio 0 on the iPhone profile). | The list was brought into view only when an order was added, which on a phone happens while the card is closed. | It is also brought into view when the card is opened on orders already given. | `e2e/plans.spec.ts`: the order is in the viewport on both profiles (fails on the previous build) |

Before and after: `docs/review/visual/v7-plans-iphone.jpg` (after; the before state is the failing assertion above, the
capture of it was overwritten by the passing run) and `docs/review/visual/v7-inspector-desktop.jpg` (the inspector
reading the engine: carries one technology, every resistance).

## The attack list (prompt 19), checked

Sound, with the code that makes it so (the reviewer's reading, and the existing tests that hold it):

- **Pause while placing / background tab / suspend:** the pause card is modal; orders take effect only at tick
  boundaries; visibility and page-hide pause the clock; a frame gap over 2.5 s pauses; at most 6 ticks run per frame
  and unspent time is capped at one tick (`src/game/clock.ts`; `e2e/persistence.spec.ts`).
- **Save-scumming the catastrophe:** nothing to scum: the hazard is a pure function of the state (`resolveHazard`), the
  forecast is the resolution, and the campaign's random stream is read only by the bots.
- **Resource creation:** build-cancel refunds at most 70% of the unfinished share; demolish at most 20%; repairs never
  refund; every debit is re-checked when it applies (`tests/engine/fuzz.test.ts`: build-cancel and build-demolish loops
  are strictly lossy).
- **Footprints:** occupancy, queued footprints and kind limits are checked when ordered and again when applied.
- **Quarry and knowledge:** a quarry yields only while its deposit has rock, and rock never regrows; knowledge is capped
  at 900 and reset at each founding; technologies are de-duplicated.
- **Archaeology:** two surveys and one dig per interregnum, an excavated flag, salvage zeroed by a dig (and since
  finding 2, a restoration that falls is not dug twice).
- **Decisions:** a second answer is refused; only the player's choice is ever charged.
- **Hostile storage and links:** saves (shape and integrity), settings, run cards, the Codex, branch points, backups
  and share links are each validated field by field; prototype keys are refused.
- **Collapse exactly once:** `collapseResolved`, reset only at a founding (`tests/engine/time.test.ts`: 600 ticks, not
  601, one collapse).
- **Determinism:** no `Math.random` or `Date` in the engine (lint), integer arithmetic, id tie-breaks, no `Math.pow`,
  a key-sorted state hash; every recorded lineage replays to its hash headless and in the browser.
- **No-op or one-button dominance:** doing nothing loses; one well-sited Archive alone loses since rules 0.4.0
  (`scripts/recipes.ts`); see `docs/BALANCE_REPORT.md`.
- **Lost WebGL, remounts, orientation:** `e2e/graphics.spec.ts`, `e2e/persistence.spec.ts` (one canvas),
  `e2e/layout.spec.ts` (landscape phones), `e2e/fallback.spec.ts`.

## Gameplay audit (automated)

Decisions in the recorded lineages (seed 6001, Normal), counted from their transcripts: planning orders, orders during
the minute, and choices after it.

| Lineage                            | Age I                        | Age II | Age III |
| ---------------------------------- | ---------------------------- | ------ | ------- |
| Greenvale, Engineers (won)         | 5 planning, 10 in the minute | 5, 6   | 5, 2    |
| Greenvale, Archivists (won)        | 5, 12                        | 4, 9   | 5, 9    |
| The Ashen Winter, Engineers (won)  | 5, 10                        | 5, 6   | 5, 2    |
| The Ashen Winter, Archivists (won) | 5, 12                        | 4, 6   | 5, 9    |
| Greenvale, builder (lost)          | 5, 4                         | 4, 3   | 5, 6    |

Scripted bots make 7–17 decisions an age, the winning ones more; prompt 19's "6–15 meaningful choices" is met by the
bots' own plans, but whether a person's minute feels full or idle is **UNVERIFIED** (no human playtest, K-014).

## Verification

- `npm run typecheck`, `npm run lint`: clean. `npm test`: 392 tests in 43 files pass (12 new for these findings, and the
  seed and backup tests changed with them).
- Eleven one-line reverts of the fixes each make a test fail (listed in `docs/TEST_RESULTS.md`); the phone briefing's
  check fails on the build before its fix.
- Rules 0.4.2: every route trace and feat run re-recorded and its diff read. Every outcome, survivor count, condition,
  action count and feat is unchanged; only the hashes moved (`fixtures/greenvale-traces.md`, `fixtures/feats.md`).
- Browser (Chromium with software GL, desktop 1366×768 and the iPhone 13 profile, under the production headers): the new
  `e2e/plans.spec.ts` with the story, ruins and backup specs, 14 passed; on the final build, plans and journey, 5 passed
  and 1 skipped (desktop-only). The full suite runs in CI on the pull request.

## Visual gate

Not yet run on this build: the canonical captures (seed 6001, fixed cameras) and their scores are the next step, and
this section will hold them. Until then the last scored set is session 4's, 4/5 on the seven criteria judged from stills
(`docs/3D_QUALITY_REPORT.md`).

## Manual QA runbook (what automation here cannot do)

Each of these is UNVERIFIED until a person does it; record the device, browser version, build SHA and what was seen.

1. **A real iPhone (Safari), portrait and landscape.** Open the build, start a lineage, place a Farm by tapping the map,
   pinch and drag the camera, begin, answer a decision, pause, lock the phone for a minute and return (the clock must
   still be paused), rotate during placement, play to the second age. Note anything under the thumb that is hard to
   reach, any text clipped by the notch or home bar, and how long the first load takes on cellular.
2. **A desktop with a real GPU.** `?quality=high`, a full age: watch the river, smoke, villagers and the collapse
   cinematic for stutter; `window.__epoch.perf` (with `?debug`) gives frame times to record in `docs/PERF.md`.
3. **A human playtest**, someone who has not seen the game: time to the first order after Begin, how many decisions
   they make in the minute, whether they can say what they inherited (three things), and whether they want another try
   after a loss. Do not coach.
4. **A screen reader** (VoiceOver on the iPhone, NVDA on Windows): the briefing, the tray, placement by the next-site
   button and arrows, the announcer through a whole minute.
5. **The audio**, on speakers and headphones: levels, the warning cues, nothing harsh.
6. **The deployment**, only after the owner confirms it: the steps and smoke checks in `docs/RELEASE_CHECKLIST.md`.

## Verdict

**Not a pass.** Prompt 19's release conditions, one by one:

| Condition                                                      | State                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The 60-second timer is exact                                   | Met: 600 ticks, frame-rate independent, frozen while hidden or paused (engine and browser tests)                                                                                                                          |
| Start, collapse, inheritance, the next age and the ending work | Met in Chromium: `e2e/campaign.spec.ts` places, begins, skips and founds through the interface to an ending, and the four recorded wins play through the browser's store to the victory screen with their recorded hashes |
| 3D beauty verified                                             | Partly: stills under software GL scored 4/5 in session 4; the final-build gate is not yet run; motion and a real GPU unseen                                                                                               |
| A three-age human-like flow                                    | Automated only: those specs fast-forward the minute (`e2e/journey.spec.ts` lets the real clock run a few seconds, then pauses it); no browser test plays a whole minute in real time, and no person has played (K-014)    |
| Seeded replay and saves consistent                             | Met: every recorded lineage replays to its hash headless and in the browser; saves at ticks 1, 300 and 599                                                                                                                |
| Real iPhone-like interactions                                  | Not met: Chromium's iPhone 13 emulation only; no WebKit, no device (K-001)                                                                                                                                                |
| Performance reported with device context                       | Not met for real devices: software GL figures only (`docs/PERF.md`, K-009)                                                                                                                                                |
| The production build works                                     | Met: the built app under the production headers in every browser test, `npm run verify:release`                                                                                                                           |
| Deployment status truthful                                     | Not deployed; it waits on the owner's confirmation (K-018)                                                                                                                                                                |
