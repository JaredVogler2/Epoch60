# EPOCH60 — Stepwise Claude Code Opus 5.5 Max execution guide

**Purpose:** Execute a very large 3D game build through bounded, independently testable phases. Protect verified work from session/context/credit exhaustion. The goal is a finished fun game, not many long status reports. This guide supplements [00_MASTER_GOAL.md](00_MASTER_GOAL.md), [AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md](AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md) and [QUALITY_GATE_VISUAL_AND_FUN.md](QUALITY_GATE_VISUAL_AND_FUN.md).

## The most reliable way to execute

**One numbered prompt per Claude Code session or work unit** (more only if scope truly small). Preserve completion evidence in git after each. Run these steps at session start:

1. Read repository files: README.md, prompts/00_MASTER_GOAL.md, prompts/README.md, prompts/CLAUDE_CODE_STEPWISE_RUNBOOK.md, prompts/QUALITY_GATE_VISUAL_AND_FUN.md and docs/PROGRESS.md if present.
2. Inspect code, branch, git status, failing checks and last relevant commits.
3. Find the next numbered phase that is not VERIFIED according to its acceptance criteria. Do not trust a checkbox without matching actual source/tests/browser evidence.
4. Complete ONLY a small, coherent engineering increment (e.g. deterministic 600-tick run and pause, one fully modeled farm, one real collapse). If there is remaining time, do another increment within same phase.
5. Ensure runnable app + tests. Capture actual screenshots when implementing graphics/UX.
6. Commit work on the appropriate branch. Update docs/PROGRESS.md and docs/CONTINUE_HERE.md.
7. Output brief accomplishment, verification commands/results, commit SHA, unresolved defects and exact next increment. On subsequent session, repeat.

**Never erase working files or recreate project when code already exists.** Preserve uncommitted user changes. Never convert an unfinished implementation into a claimed success simply because npm build passes.

## Single-session reusable /goal (paste repeatedly)

~~~text
/goal Continue the EPOCH60 build from the latest verified git state. Read prompts/00_MASTER_GOAL.md, prompts/CLAUDE_CODE_STEPWISE_RUNBOOK.md, prompts/QUALITY_GATE_VISUAL_AND_FUN.md, docs/PROGRESS.md and docs/CONTINUE_HERE.md if present. Determine the next incomplete numbered phase (01–19), read its prompt, implement one substantial testable subset of that phase as working code, run real build/typecheck/unit/browser checks appropriate to the change, visually inspect real 3D output when applicable, update progress and continuation notes, commit verified work, and stop at a clean working checkpoint rather than risk a large uncommitted context overrun. If the phase acceptance gates are all met, mark VERIFIED and move to the next phase in the following checkpoint. Work autonomously; do not generate a plan without implementing code.
~~~

## When to change sessions

Use a fresh Claude Code session when:
- a numbered phase was verified and committed;
- a significant module boundary is reached (engine→world graphics→UX→gameplay);
- an architectural decision/document becomes long enough to crowd context;
- graphics need visual QA and a fresh independent review;
- the run is approaching context/credit exhaustion or test pipeline is repeatedly failing.

Before resetting context, ALWAYS write and commit docs/CONTINUE_HERE.md with:
- current objective and next 1–3 exact code changes;
- files added/modified and relevant architecture hooks;
- last successful command and its output summary;
- known failing commands and reproducible issue;
- exact seed/camera/browser used for screenshot;
- commit SHA, branch, uncommitted work status;
- next phase gate still unverified.

## Five build milestones

### Milestone A — Engine can play one timed civilization (phases 01–04)

Target: deterministic simulator, visible 3D village starter scene, legal real building placement, timer 60 active seconds, hard pause/background freeze, one deterministic catastrophe, save/restart. This must be interactive in a browser, even if art/assets incomplete. Code and test gates: same seed+action-tick log yields exact same world hash, 600 ticks not 601, actual GUI action wired.

### Milestone B — World looks beautiful on desktop and iPhone (phases 05–07)

Target: stylized sculpted valley with textured banks and beautiful water, richly modeled cottage/farm/bridge/trees, sun/shadows, smooth orbit/pan/zoom, excellent phone-sized touch. Must compare real screenshots, not polished concept art. User's earlier criticism of flat BeliefEngine visuals is the cautionary failure example: DO NOT accept a green tiled board with tiny box buildings. Tests: select place/render entity, scene responds, viewport works at 320, 390, 1366 widths, FPS measured honestly.

### Milestone C — A REAL three-epoch game worth replaying (phases 08–12)

Target: building production, visible citizens, ecology, real catastrophe scars, archaeological exploration, meaningful technology/era transformation and complete three-epoch beginning-to-end victory/defeat. **Freeze expansion if this isn't fun and playable**; at least 2 verifiable successful strategies and one credible failure. Gameplay end-to-end browser-tested and saved lineage replays exactly.

### Milestone D — Rich content & replayability (phases 13–16)

Target: 8–12 epoch capstone (or verified leaner equivalent), distinct modes and world seeds, attractive animations/audio, 4+ gameplay-distinct disasters and multiple technological eras, objective balance tests and long-term non-predatory discovery. Run scripted agents on 1,000+ worlds when feasible and report **actual**, not imagined, outcomes. New seeds should change strategy, not colors.

### Milestone E — Production-grade browser game (phases 17–19)

Target: mobile Safari-compatible interactions, adaptive WebGL2 effects, accessibility and pause, stable local saves, complete Playwright desktop/phone journeys, deployed-ready Vercel build and actual deployment smoke if authorized/available, visual/art-director audit and severe fixes. No "complete" if no browser was tested.

## Per-phase checkpoints and minimal evidence

| Phase | First increment | Verified exit evidence |
|---|---|---|
| 01 | Exact rules, finite win/lose, content schemas | Rules fixtures executable and consistent |
| 02 | 3–5 real buildings with costs & economic effects | Production and conservation tests |
| 03 | Vite/R3F app + scene, seed and menu | Browser action + npm ci/typecheck/build |
| 04 | 600-tick controller/hidden/pause | Deterministic clock/replay tests |
| 05 | Heightfield river, soil, forest, ruin cells | Ecological differential + screenshots |
| 06 | Detailed hero village corner, sun, shadow and water | Actual screenshots + selection/camera |
| 07 | Mobile and desktop build/camera control | Playwright touch+keyboard end-to-end |
| 08 | Farm, workshop, workers, construction animations | 3D state matches production |
| 09 | Catastrophe scars + archaeology | Epoch2 real world delta + inheritance tests |
| 10 | Age branches and architecture variants | 4+ visible ages + unlock prerequisites |
| 11 | Fire, flood, quake, toxic winter | Same-seed mitigated/unmitigated comparison |
| 12 | Greenvale 3-epoch end-to-end | 2 winning routes, loss and browser journey |
| 13 | Story, expeditions and daily | Seed versioning and 1,000 generation validations |
| 14 | Ambient audio and era transition art | Real screenshots and animated effects |
| 15 | Headless bot harness and exploit probes | Reproducible balance report + fixes |
| 16 | Atlas of Ages, endings, challenge variants | Achievements reachable, local persistence |
| 17 | Mobile GPU tiers & accessibility | WebKit tests + verified input/perf evidence |
| 18 | Release E2E, deployment config | Fresh install/build/tests; live smoke if deployed |
| 19 | Adversarial final review | Serious defects fixed, screenshots/trace evidence |

## What not to skip on short contexts

If the coding agent must choose between 10 unimplemented claims and 1 working complete pathway, choose the working pathway. If scene appearance lags behind design goals, spend a session on real 3D material/asset work BEFORE adding more backend logic. If the timer feels like a tapping contest, adjust interaction friction / preplanning BEFORE increasing resource systems. If phase12 gameplay isn't genuinely rewarding, DO NOT claim achievement because 20 prompts were read.

## Exact short /goal prompts for pivotal milestones

### Bootstrap (first Claude Code session)
~~~text
/goal In this Epoch60 repo, read prompts/00_MASTER_GOAL.md, prompts/01_GAME_DESIGN_BIBLE.md, prompts/02_ECONOMY_ACTIONS_TECH.md, prompts/03_ARCHITECTURE_BOOTSTRAP.md and prompts/AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md. Begin real implementation by creating a runnable game scaffold, authoritative deterministic sim, gorgeous starter WebGL2/R3F valley scene, a real 60-second clock and one working Build interaction. Make the smallest playable end-to-end path with a real collapse and Next Epoch. Commit working source/tests and record truthful progress; don't expand content yet.
~~~

### Gorgeous 3D (dedicated art session)
~~~text
/goal Read prompts/06_PREMIUM_3D_WORLD.md plus prompts/QUALITY_GATE_VISUAL_AND_FUN.md. Evaluate actual runtime screenshots against a premium miniature civilization game: sculpted land, curving flowing river, roofs with modeling detail, multiple tree types, citizens, believable warm sunlight/shadows and controllable camera. Replace primitive green-grid/box placeholders with real geometry/material and authored or correctly licensed assets. Keep all gameplay working. Iterate actual browser screenshots until visual scorecard gates meet pass; commit and document measured rendering performance. Do not solve this by generating a static concept image.
~~~

### Complete three generations (main gameplay session)
~~~text
/goal Read prompts/08_CONSTRUCTION_AND_CITY_LIFE.md, 09_COLLAPSE_AND_INHERITANCE.md, 10_AGE_PROGRESSION_AND_TECHNOLOGY.md, 11_DISASTERS_EVENTS_AND_AGENCY.md, and 12_PLAYABLE_THREE_EPOCH_SLICE.md. Work on the NEXT unverified dependency until Greenvale is a real playable three-epoch game: 60s active gameplay, destructive catastrophe, persistent ruins/ecology/knowledge, actual archaeological decision, later era, eventual win/loss, replay. Create verified deterministic two-win/one-loss traces, desktop and iPhone Playwright flows, screenshots and commits. Do not add new modes until vertical slice is truly fun and mechanically complete.
~~~

### Final production (once gameplay passes)
~~~text
/goal Read prompts/17_MOBILE_ACCESSIBILITY_PERFORMANCE.md, 18_TESTING_DEPLOYMENT_SECURITY.md and 19_FINAL_ADVERSARIAL_REVIEW.md. Perform a strict release audit on actual browser game. Test an entire 3-epoch game, iPhone-sized WebKit input, pause/resume, versioned saves, determinism, 3D visual fidelity/performance and every win/loss/replay path. Fix blockers and the five worst meaningful issues. Prepare or verify Vercel deployment if access exists, never invent deployment/test success. Commit tested changes, exact screenshots/test results and final release status.
~~~

## User-facing completion standards

Don't report a finished game until **source exists**, player actions affect actual simulation, the collapse and next civilization are genuinely inherited, a complete end is reachable, visual tests show a pleasing real 3D diorama, desktop/iPhone-sized interaction works, and the build is tested. If only prompts are committed, say exactly that.
