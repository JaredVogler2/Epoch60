# EPOCH: THE 60-SECOND CIVILIZATION — Claude Code build program

> **Build a civilization in 60 seconds. Lose it. Inherit everything.**
>
> This is an **implementation program**, not a game-design essay. Claude Code Opus 5.5 Max must build and ship a *real*, gorgeous, interactive, replayable 3D browser game from this repository. The scene has to be playable on desktop and iPhone-sized touch screens, including Safari/iOS.

## Start here — exact Claude Code prompt

~~~text
/goal Read prompts/00_MASTER_GOAL.md and prompts/README.md in full. Execute the numbered implementation prompts in prompts/01 through prompts/19 sequentially, making actual code changes and committing each verified milestone in this Epoch60 repository. Build EPOCH: THE 60-SECOND CIVILIZATION as a premium original 3D desktop/iPhone browser strategy roguelite. A 60-second live civilization must be genuinely fun; it collapses, leaves tangible persistent physical/social/technological legacies, and the next civilization emerges upon its ruins. Preserve a headless deterministic simulation with seeded replays, beautiful highly interactive Three.js 3D world, clear touch-first UI, build/tech/crisis decisions, evocative collapse and era transitions, story mode, seeded expeditions, responsive performance, and comprehensive real playtests. Do not stop at documentation, a landing page, primitive boxes or visual mockups. Prioritize the playable 3-epoch vertical slice, then expand only after its gameplay and visuals pass acceptance gates. Verify tests, browser screenshots, complete runs, and iPhone-sized Playwright interaction. Work autonomously; record truthful results and blockers in docs/PROGRESS.md. Continue through release and final adversarial review.
~~~

## Ordered phases

| # | File | Actual acceptance milestone |
|---|---|---|
| 00 | [00_MASTER_GOAL.md](00_MASTER_GOAL.md) | Binding scope, workflow, no-fake-completion contract |
| 01 | [01_GAME_DESIGN_BIBLE.md](01_GAME_DESIGN_BIBLE.md) | Rules, player fantasy, age transitions, meaningful 60s loop |
| 02 | [02_ECONOMY_ACTIONS_TECH.md](02_ECONOMY_ACTIONS_TECH.md) | Build actions, opportunity costs, resources, technology, legacy |
| 03 | [03_ARCHITECTURE_BOOTSTRAP.md](03_ARCHITECTURE_BOOTSTRAP.md) | Real runnable app, deterministic engine interfaces and tests |
| 04 | [04_TIME_ENGINE_AND_EPOCHS.md](04_TIME_ENGINE_AND_EPOCHS.md) | Real-time deterministic 60s simulation, transitions and replays |
| 05 | [05_TERRAIN_ECOLOGY_AND_WORLD.md](05_TERRAIN_ECOLOGY_AND_WORLD.md) | Elevation, waterways, biome, resource deposits, persistent impact |
| 06 | [06_PREMIUM_3D_WORLD.md](06_PREMIUM_3D_WORLD.md) | Beautiful sculpted 3D diorama, camera, water, architecture |
| 07 | [07_DESKTOP_IPHONE_UIUX.md](07_DESKTOP_IPHONE_UIUX.md) | Keyboard/mouse and actual phone-first tap/drag/build controls |
| 08 | [08_CONSTRUCTION_AND_CITY_LIFE.md](08_CONSTRUCTION_AND_CITY_LIFE.md) | Structures, citizens, paths, construction visuals, agency |
| 09 | [09_COLLAPSE_AND_INHERITANCE.md](09_COLLAPSE_AND_INHERITANCE.md) | Memorable apocalypse + excavatable legacies and next epoch |
| 10 | [10_AGE_PROGRESSION_AND_TECHNOLOGY.md](10_AGE_PROGRESSION_AND_TECHNOLOGY.md) | Distinct ages, branching strategies and technological futures |
| 11 | [11_DISASTERS_EVENTS_AND_AGENCY.md](11_DISASTERS_EVENTS_AND_AGENCY.md) | Escalating hazards, meaningful counterplay and emergent events |
| 12 | [12_PLAYABLE_THREE_EPOCH_SLICE.md](12_PLAYABLE_THREE_EPOCH_SLICE.md) | Complete, tested 3-epoch beginning-to-end gameplay |
| 13 | [13_MODES_SCENARIOS_AND_SEEDS.md](13_MODES_SCENARIOS_AND_SEEDS.md) | Campaign, expeditions, daily challenge, varied starting positions |
| 14 | [14_VISUAL_POLISH_ANIMATION_AUDIO.md](14_VISUAL_POLISH_ANIMATION_AUDIO.md) | AAA-inspired *stylized* art direction, world transformations, audio |
| 15 | [15_SIMULATION_BOTS_BALANCE.md](15_SIMULATION_BOTS_BALANCE.md) | Seed tournaments, multiple strategies, exploits, fun diagnostics |
| 16 | [16_META_REPLAYABILITY_AND_RETENTION.md](16_META_REPLAYABILITY_AND_RETENTION.md) | Purposeful unlocks, discovery, personal bests and rich debrief |
| 17 | [17_MOBILE_ACCESSIBILITY_PERFORMANCE.md](17_MOBILE_ACCESSIBILITY_PERFORMANCE.md) | iPhone Safari readiness, responsive touch, adaptive GPU quality |
| 18 | [18_TESTING_DEPLOYMENT_SECURITY.md](18_TESTING_DEPLOYMENT_SECURITY.md) | E2E, crash/replay tests, Vercel build and real deploy prep |
| 19 | [19_FINAL_ADVERSARIAL_REVIEW.md](19_FINAL_ADVERSARIAL_REVIEW.md) | Rigorous visual and game-feel review; fixes; verified release |

## Technical standard

Default: TypeScript + Vite + React 19 + **@react-three/fiber stable compatible major** / Three.js / Drei using broadly compatible WebGL2; confirm actual stable versions before installing. As of the design research, React Three Fiber v10 was alpha and the documented stable pairing for React 19 was R3F v9: https://r3f.docs.pmnd.rs/getting-started/introduction . Do not blindly install prereleases. Use pure deterministic TS headless simulation beneath a read-only 3D renderer; Vitest, Playwright, Vercel static hosting. Add a backend only if a product need explicitly requires it; **no account, paid API or LLM required** for single-player.

## Visual north star — DO NOT IGNORE

High-quality **playable** 3D miniature world with dramatic evolution: beautiful warm trees and thatched villages, rivers with moving reflections, medieval fortified stone and tile roofs, industrial brick and smoke, modern glass and transit, imaginative luminous future megastructures, ruins layered into terrain, orbiting effects and catastrophes. Sculpted land, authored buildings, decorative environmental storytelling, lively human characters and accessible interactive depth. Coherent colors/materials, soft cast shadows and responsive camera. **Flat 2D map, checkerboard, colored cubes and heavy spreadsheet HUD are unacceptable.**

## Core loop

1. **Preview inheritance (unlimited planning between epochs):** inspect remaining physical/societal legacy and incoming disaster/conditions.
2. **60-second live epoch:** place/demolish buildings, assign priorities, direct research, capture resources, respond to hazards and invest in legacy **while a clearly visible clock counts down 60 active seconds**.
3. **Cataclysm:** animated but skippable collapse caused by a known pressure and final disaster; structures/population/knowledge/land transform causally.
4. **Archaeology / inheritance:** reveal ruins, institutions, technology echoes, terrain damage, preserved vaults and unexpected cultural beliefs with context.
5. **Rise again:** next society starts thousands of years later on the *same* evolved map. Different ages, technologies and choices compound, sometimes negatively.
6. **Meta-goal:** find a civilization able to **break the collapse cycle** in finite epochs, with alternate ends, personal scores, seeded daily challenges and experimentation.

Design requirement: a 60s timer must generate tension without punishing touch players. The *planning phase* is unmetered, and pause/accessibility half-speed modes exist; tracked competitive scores are separated by settings. Don't slow entire default game into long waiting or hide key actions behind cumbersome menus.

## Always finish a milestone in working state

Phase workflow: inspect actual repo → implement real code → compile/typecheck/unit → browser interaction/screenshots (if available) → record results in docs/PROGRESS.md → fix critical defects → commit → next. Tests/visuals absent = mark UNVERIFIED, not pass. At minimum maintain a passing build and playable partial vertical slice while adding systems. No "implemented" for a simulated screenshot, no dummy button actions, no RNG claims without test logs.

## Initial release gates

- A whole run: title → learn → live 60s → clear cataclysm → inherit → another live epoch → achieve victory/defeat → immediately replay.
- **3-epoch vertical slice** with meaningful changed world & alternate strategies, then **≥8-epoch campaign arc** for release (tunable via testing).
- At least 3 different generated world starts, 4+ distinct disaster classes and 4+ civilization technology/visual eras by release; scope intelligently but never fake feature counts.
- Two verified winning playstyles for introductory scenario, one credible loss; action traces recorded and reproducible.
- iPhone-width game is controllable, legible and performant with real touch/canvas picking + DOM action alternatives.
- Richly modeled volumetric 3D, no placeholder geometry in release, real escalating era visuals and collapse aftermath.
- Stable deterministic simulation independent of frame rate, pause, orientation and render quality.
- Same seed/input schedule → same engine hash and same inherited world; no background tab losing a civilization.
- Daily/expedition modes do not require server; optional shareable versioned seeds.
- Bots show no-op/one-button spam underperform thoughtful strategies; no irreversible design traps disguised as challenge.

## Avoid

Grandiose design documentation without implementation, meaningless resource meters, 60s of tap-spam, auto-win by building one immortal vault, linear tech tree where best choice always obvious, "ruins" as temporary cosmetics, randomly generated worlds without solvability checks, asset packs that visually clash, dead menus, WebGL blank screens on iPhone, intrusive ads, push notifications or pay-to-win. **The game should reward curiosity and mastery, not exploit compulsive behavior.**
## Cross-phase binding supplements

Before implementing code, read [QUALITY_GATE_VISUAL_AND_FUN.md](QUALITY_GATE_VISUAL_AND_FUN.md) and [AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md](AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md). Apply them throughout phases 01–19. The art/interaction scorecard and verified working-state commit protocol are mandatory and override any lower-quality implicit shortcut. Do not call a static 3D scene or graphical mockup a playable game.
