# Cross-phase supplement — HARD acceptance gate for premium 3D and satisfying 60-second play

This supplemental checklist is binding when implementing phases 03, 06–09, 12, 14, 15, 17–19. It exists because coding agents often produce feature-complete but visually disappointing **green grids with boxes**, or pretty animated prototypes with no strategic urgency. Neither is EPOCH.

## Freeze visual test references

Use an authored canonical world seed such as 6001 (choose and document exact value), fixed camera pose, clock at 00:60 / 00:35 / 00:03, then successor epoch 2 and epoch 3. Capture ACTUAL browser-rendered screenshots in Chromium, mobile WebKit and one phone profile when possible. Record game commit, seed, dimensions, camera, graphics tier, device pixel ratio and time tick. Store screenshots at a stable test-artifact path (and optionally checked-in compressed review samples). Never substitute AI concept art for runtime evidence.

### Nine required images / interaction scenes

1. Title hero: premium atmospheric valley, river, richly built settlement, appealing color and light, prominent Start.
2. Stone/agrarian era close-up: distinguish 3 house silhouettes, at least one detailed roof/window/door and path, 3 tree types, 3 moving inhabitants, textured terrain, water.
3. Early build selection: ghost model snapped to terrain, visible footprint, price, actual valid and invalid placement signaling, no covering central map.
4. Mid-epoch production at 35 seconds: people visibly working, farms productive, UI contains time/population/food and meaningful current decision. No static mock counters.
5. Crisis final 3 seconds: visible threat, damaged world, urgent but accessible choice and understandable warning.
6. Collapse sequence: environment changes according to actual disaster cause; ruins persist, not generic vignette.
7. Era successor: SAME geography, at least 3 recognizable surviving/ruined prior buildings, visibly altered ecology and new era construction, archaeology.
8. Industrial/future epoch hero: architecture/materials/scale unmistakably different from primitive era, same identifiable river/landmarks underneath.
9. iPhone portrait 390x844 and 320x568: map remains dimensional and interactive; timer, build tray and next-action visible; no clipped/hidden controls.

## Art-director evaluation rubric (1–5 each; minimum 4 for core categories, evaluated honestly)

- World composition: bridge/river/settlement/countryside arranged intentionally, scene beautiful before interaction.
- Geometry depth: hills and riverbanks sculpted; buildings feature actual pitched roofs, window insets, doors, posts, chimney and ground contact. Not a plane and cubes.
- Materials and lighting: consistent painterly PBR palette, filmic exposure, soft cast/contact shadows, roof texture and distinct surface roughness; sunlight conveys form.
- Vegetation: designed varied tree canopies and shrubs/flowers/grasses, not repetitive cones, avoid obvious clone rotations.
- Animated water: flowing material, shore edges, shallow/deep variation, state-linked flooding.
- Life: villagers distinguishable by job/persona, purposeful animations along feasible roads, no walking over water.
- Era transformation: early/copper/medieval/industrial/future shapes visually change, but old foundations and damage remain identifiable.
- Events & legacy: fires, water, collapse, vegetation regrowth and archive preservation are physically legible and accurately engine driven.
- Camera and input: genuinely rotatable/zoomable 3D, smooth but bounded; click/tap reliably picks world entities.
- HUD: world occupies most of display; timer and action affordances apparent, no spreadsheet wall of cards.
- Phone performance: visually attractive even reduced quality, stable controls and sensible loading time.

Failures must be evidenced with screenshot, code root-cause and required fix. Do not inflate grades by using marketing adjectives. If automated browser lacks GPU, mark visual assessment UNVERIFIED and run available structural/E2E tests; leave instructions for a real visual inspection.

## Gameplay acceptance — one minute must have decisions

At default settings:
- First real action achievable within 5–10 seconds after Begin, not 40 seconds of reading.
- 6–15 meaningful strategic choices typical successful run; each changes a resource, spatial world or future inheritance.
- By 10s: build/assign/research clear; by 25s: evidence of production; by 40s: threat/research/legacy tradeoff; last 10s: recognizable final decision.
- Success should depend on **different strategies**, not click speed or one dominant building. No-op and random-tap policies normally underperform thoughtful strategy in seeded bot tournaments.
- Player never loses active time while loading a modal, transitioning scenes or tab background; if a menu opens during active play, it is minimal or soft-pauses in assisted mode with scoring distinction.
- Typical new user can identify at least one near-term objective and one long-term legacy opportunity without reading a 5-page manual.
- Loss explains a concrete alternative action: archive lacked protection, riverside farm flooded, quarry depleted future ore, forest restoration too late.
- Collapsing the first epoch must NOT erase everything; at least two persisted altered site states and one changed resource condition observable next age.
- Same seed + exact time-stamped actions = identical game state; scene FPS doesn't influence outcome.

## Minimum interactive verification path

Fresh browser open -> Start New -> select first objective -> Begin 60s -> choose Farm -> preview tile -> place -> see cost/food change -> build Cottage/Archive -> technology decision -> receive disaster warning -> respond -> reach 0 -> watch/skip collapse -> inspect persistent surviving ruin and changed terrain -> start next society -> reuse/salvage ruined site -> do another 60s -> progress tech -> repeat to third -> achieve winning or losing end. At least one E2E browser test + deterministic scripted 3-epoch trace must verify this.

## Optimization cannot remove quality

A midrange iPhone graphics tier may reduce shadow resolution, foliage instance density, texture sizes and particles, but must retain *three-dimensional* houses, sculpted land, animated river, citizens and real meaningful effects. A 2D bitmap fallback may be an optional compatibility mode, never default. Do not claim top-tier 60fps without measured hardware and profiler evidence.

## Final rejection rule

If the app has a blank 3D world behind a sophisticated HUD, a flat green tile grid with tiny house icons, generic cubes with glow, a civilization timer with no history, or a glamorous demo lacking real placement and consequences, **REJECT AND REWORK**. This applies even if npm build/test passes.