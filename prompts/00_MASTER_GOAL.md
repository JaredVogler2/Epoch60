# /goal — BUILD EPOCH: THE 60-SECOND CIVILIZATION, NOT A PROTOTYPE

Act as autonomous principal game designer, lead simulation engineer, senior Three.js technical artist, gameplay programmer, mobile UX engineer, QA/balance researcher and release manager. Your responsibility is to deliver **a genuinely enjoyable, visually stunning, replayable strategy roguelite playable directly in a browser on desktop and iPhone**.

## The promise

**"You have 60 seconds to create a civilization. What survives the end becomes the next civilization's beginning."**

Every civilization gets 60 real-time active seconds, enough for roughly 6–15 meaningful choices—not dozens of repetitive taps. Crisis unfolds and civilizations rise and fall on one persistent 3D world, so strategic decisions create historic consequences. You should sometimes make a *bad* choice for your current civilization because it helps your next one, but it should be a calculated risk, not an obvious exploit. Over 8–12 epochs, players experiment, solve compounding world problems and eventually escape the collapse cycle by achieving one of several big interlocking outcomes.

## Current repository state

At creation, GitHub JaredVogler2/Epoch60 was an **empty public repository**. Bootstrap it; do not claim existing engine tests or assets. The task is to create code and real art/gameplay here.

## Actual deliverable

- Vite/React/TypeScript strict browser game with premium 3D world in stable Three.js/React Three Fiber, strong scene composition, original or appropriately licensed art, smooth camera and high-quality environment effects.
- Playable and approachable on **iPhone Safari touch viewports as small as 320px**, tablets and desktop keyboard/mouse.
- Deterministic headless game engine for a 60-second active epoch; time-step logic not bound to graphics frames.
- A strategic building/priority/technology loop with resource/people/ecology interactions, imminent disaster, collapse and **physical / technological / cultural / ecological inheritance** visible in future epochs.
- An exciting 3-epoch vertical slice, expandable into actual 8+ epoch replayable run, procedural worlds, several ages and endings, local saved sessions and daily challenges.
- Real victory/loss conditions, score, feedback, debrief, shareable seed and clear "Play Again" CTA. A game with no win/loss is not finished.
- Integrated original low-cost assets and sound (license tracked); fast Vercel static deploy.
- Tests and proof of quality, including simulations, game traces, Playwright E2E and screenshots. No invented performance numbers or fake tests.

## Fundamental decisions

### 60 real active seconds, with humane controls

Default **active** time begins only when player presses **Begin Epoch** after preview. Timer is visible in tenths or whole seconds with urgency, depletes from 60 to 0, stops on pause or tab hidden, **no game advances while offline/away**. Graphics refresh rate never changes simulation length. Between epochs there is no active timer. Optional accessibility half-speed and tactical pause modes exist, labeled Assisted Mode and stored separately in leaderboards. Avoid requiring ultra-fast precise taps. Input snapshots are processed on deterministic ticks and event sequence records. The user can pre-plan a starting plan but cannot queue an entire perfect game for free: plan slots and authority are bounded by actual unlocks.

### Persistent world, real consequences

The same terrain heightfield, climate, rivers, accessible minerals, ruins, deposits, biosphere, pollution and ancient works follow through history. Changes persist via an explicit lineage/legacy ledger, with decay, partial destruction, salvage and compounding. Ruins can be excavated; dams alter flood and irrigation, pollution persists, archives reveal research, seed banks restore fertile biomes, myths change future cultural affinity, disease/ecological scars produce drawbacks. There is no full map reset or fake inherited bonuses unrelated to world state.

### Five pillars

1. **FAST AGENCY:** the player makes important decisions in seconds, sees construction/resource effects immediately, and feels ownership of failure/success.
2. **DEEP LEGACY:** present sacrifice vs future benefit; investment tradeoffs; persistent geography and material consequences.
3. **AN EXCITING CLOCK:** countdown and pre-announced crisis build urgency, not an untelegraphed sudden dice failure.
4. **ART THAT SELLS THE FANTASY:** cinematic real 3D villages evolving through time, small human lives, delightful buildings, visible collapse and rediscovery—not flat tiles/cubes and neon dashboards.
5. **ONE MORE EPOCH:** clear debrief and tempting alternate strategy, new circumstances, fast replay, without dark patterns.

## Strict art quality

A polished miniature-diorama world viewed at 3/4 perspective (30–50° downward), with rounded terrain, meandering water, soil/rock cliffs, foliage clusters, arched roads/bridges, beautiful small houses with roof tiles/window glow/doors/props, miniature citizens moving/work/building, physically modeled eras, warm sun/ambient fill, soft shadows and tasteful particle effects. Catastrophes visibly scar the scene, and old foundations protrude as ages pass. Later eras must be **materially** different in silhouette, palette, sound and city design. A 3D plane with boxes is NOT acceptance. Photorealism isn't the target; art-directed stylized richness is.

R3F stable versions must be checked against docs: at time of planning stable R3F v9 pairs with React19; v10 is alpha. Prefer WebGL2 over experimental-only WebGPU for iPhone support. Lock dependencies and document.

## Implementation order

Read prompts/README.md then phases 01–19 **in order**. For each:
1. Inspect repository and docs/PROGRESS.md.
2. Write minimal plan/acceptance delta for phase.
3. Implement **real code** and fixtures.
4. Run typecheck/lint/unit/build plus relevant browser/e2e.
5. If browser available, launch app, visually inspect screenshots, click controls on desktop and phone viewport; fix quality failures. Otherwise explicitly flag browser verification absent.
6. Record actual commands, results and bugs in docs/PROGRESS.md and docs/KNOWN_ISSUES.md; make a coherent commit.
7. Proceed to next phase without waiting for routine design approvals.
8. If running low on context/time, write an exact continuation point and commit. Never claim unverified work as done.

Maintain docs/GAME_RULES.md (quantitative source-of-truth), docs/ARCHITECTURE.md, docs/ART_DIRECTION.md, docs/ASSETS.md, docs/BALANCE_REPORT.md, docs/PROGRESS.md, docs/PLAYTEST_LOG.md and docs/TEST_RESULTS.md as they become relevant. Do not pile documentation at the expense of game code.

## Forbidden shortcuts

- No paid LLM/inference required; simulation uses hard-coded systems/state machines.
- No cosmetic fake saves, fake random seeds, dummy "Build" buttons, mock economy counters, visual-only disasters or fixed cutscene replacing actual systemic changes.
- No unbounded numerical spam, infinite resource loop, screen-tap farming, time-based paywall or dark retention trick.
- No "complete" based on the npm build alone: ensure actual gameplay and screen rendering, including mobile.
- No actual personal user info collected. Local-only saves and scores by default; no accounts/backend required.
- If a feature is impossible in the remaining work, ship smaller **fully playable** vertical slice and disclose gaps, never blanket-mark all phases complete.

## Conditions to stop at finished release

Complete two mechanically distinct winning campaigns or validated smaller scenario traces; one credible losing path; at least one 3-epoch end-to-end browser interaction; a full seeded end-state with visible ecological/physical/tech legacies; level generation validity; polished 3D screenshots at both desktop and iPhone sizes; performance and accessibility record; actual build + replay test success; clear source URL and deployment URL **only if deployed**. If any of these fails, prioritize the defect over new features.

## Your first concrete code task

Bootstrap a working Vite+React+R3F world scene with one authored beautiful valley, timer, a real buildable structure, a 60-second simulation and an actual event→collapse→new epoch state transition. Before adding 40 buildings or biomes, make these few interactions satisfying and prove that they persist.