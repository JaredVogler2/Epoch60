# 3D quality report

Every statement here comes from a capture that was actually inspected (`scripts/visual-shots.mjs`, `scripts/building-shots.mjs`) or a
measurement that was actually run (`scripts/perf-probe.mjs`). Captures are produced by Chromium with **SwiftShader, a CPU rasteriser**:
they show composition, colour, geometry, lighting and UI faithfully, but **say nothing about frame rate on a real GPU or an iPhone**.
Review copies live in `docs/review/visual/` (raw PNGs in the git-ignored `docs/screenshots/visual/<iteration>/`).

## Iteration log

### Baseline (before session 4) — `v0-*`

Inspected at 1366×768, 390×844 and 844×390 (title, fresh valley, placement, built village, mid-collapse):

- Faceted low-poly trees with per-facet brightness noise, one green; no tall silhouettes, no autumn.
- Forest and field boundaries follow the 34×34 cell grid (diamond stair-steps); muddy brown forest floor; a dark smeared band along the river.
- Sun behind the camera → front-lit, flat relief. Grey void at the board corners. Untextured grey slabs for dam, bridge, wall and archive.
- Smoke built from faceted grey stones (6 draw calls per chimney). Forecast drawn as blocky white/purple squares.
- **UI defects:** the phone title overflowed horizontally (the seed input could not shrink, "Random valley" clipped) and covered ~90% of the
  valley; on an 844×390 phone the build tray sat on top of the Begin button (fixed earlier this session).

### Iteration 1 — `v1-*`

Changes: shared atmosphere (clouds, wind, painted ground), sky dome + haze, sun to the front-left, new smooth-shaded tree species with
autumn accents, organic terrain sampling and palette, pebble banks, masonry primitive and age roof palettes, instanced soft smoke,
smooth forecast field with a contour line, phone title bottom sheet.

Inspection notes (what was still wrong and what was done about it):

| Seen in the capture                                                  | Fix                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Back light put every camera-facing wall in shadow (near-black walls) | Key light moved to the front-left; walls lit, shadows fall right |
| Smoke puffs read as glossy bubbles with hard silhouettes             | Opacity falls off toward the silhouette (view-space normal)      |
| Tile roofs showed bright see-through seams between courses           | Courses painted with a darker lower band; no stepped gaps        |
| Cypress crowns looked like dark blades                               | Rounded poplar profile, lighter hue                              |
| AgX looked washed-out (lavender rocks), ACES crushed the forest      | Kept Neutral tone mapping                                        |
| Water foam covered wide shallow stretches                            | Thinner foam band, sparser breakup                               |
| Quake forecast tinted the whole river lavender                       | Fill halved, contour kept                                        |

### Iteration 2 — `v2-*` (captures `iter-b`, `iter-b2`, `iter-c`, `iter-c2`)

Changes: the valley continues past the board (outskirts: hills, forest and the river fading into haze), bird flocks, high-tier
tilt-shift and grade, CSS vignette, a travelling fire wall with smoke columns and a warm light, quake dust, per-farm crop colours,
WebGL context-loss recovery, the governor shedding post-processing under strain, and the collapse fronts and forecast rebuilt as
smooth draped fields.

Inspection notes:

| Seen in the capture                                                                 | Fix                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grey void past the board corners when the camera looks across the valley            | Outskirts ring: rolling hills, forest and the river continue and dissolve into the haze                                                                  |
| Flood drawn as translucent cell-sized tiles with a checkerboard ripple              | One smooth water surface that rises out of the ground; its shoreline is where it meets the land; the river swells first; silty colour, broken shore foam |
| First smooth flood: a wide, snow-white foam band along gentle shores                | Narrower, broken foam at a lower strength                                                                                                                |
| Quake drawn as white squares plus diagonal hatching over the whole hillside         | Soft shock ring travelling out from the epicentre, dust puffs, short fissures only where shaking is strong                                               |
| First fissures read as pale map contour lines (dust colour bleeding into the lines) | Fissures composited dark over the dust and broken into short runs                                                                                        |
| Ash blanket showed pixel-block noise and stepped cell edges                         | Smooth noise, blurred footprint, lit by the sun and cloud shadows, a little greyer                                                                       |
| Quake forecast contour smeared into a wide purple band over the river               | Contour drawn on the zone's edge (smoothed footprint) at a constant pixel width — built; checked in iteration 3                                          |

Scores for the collapse moments after the fixes (1–5, judged on 1366×768 captures; flood and quake at two moments of the cinematic,
`COLLAPSE_T` 0.2 and 0.45, fire and ash at 0.45): fire 4, flood 4, quake 4, ash 4. The reasons a 5 is not claimed: the flood surface hides most of the flooded forest floor
detail, the quake fissures are subtle at mid-zoom, and the burning-building flames are large stylised teardrops.

### Iteration 3 — every required viewport (captures `iter3a` first pass, `iter3` after the fixes)

Scenes: title, fresh valley (start), placement, built village (Age III, mid-epoch), mid-collapse (fire) at 1920×1080, 1440×900, 1366×768,
390×844, 393×852, 844×390, 360×740 and 667×375; close-ups at 1366×768 and 390×844. The first pass (`iter3a`, 14 captures before it was stopped)
found these, all fixed and re-checked on 1366×768 captures before the full set was retaken:

| Seen in the capture                                                                                                            | Fix                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The whole quake forecast zone filled with dense purple speckle (village); orange speckled patches in the fire forecast (start) | The new contour used `smoothstep(0, fwidth(cover)·1.6, …)`; `fwidth` is exactly 0 where the footprint is flat, and GLSL leaves `smoothstep` undefined when its edges meet. The width is floored (also in the quake fissures) |
| The fire forecast's footprint is patchy (a fire spreads only through forest), so its contour broke into islands                | Footprint closed (3×3 dilate, then erode) and blurred twice before the contour is drawn                                                                                                                                      |
| "EPOCH" wider than the title card at ≥ 1366 px (letters touching the border)                                                   | 5 rem cap and tighter letter-spacing                                                                                                                                                                                         |
| Seed placeholder "6001 or any words" clipped                                                                                   | "e.g. 6001"; the hint moved into the note under the field                                                                                                                                                                    |
| Hillside boulders were 20-face flat-shaded icosahedra — an asset-pack look beside the painted crowns                           | One subdivision and normals half face / half ellipsoid: soft, mossy stones                                                                                                                                                   |

The full set (`iter3`, 42 captures) then found three layout defects on phones, fixed and recaptured at every affected size:

| Seen in the capture                                                                                              | Fix                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Collapse banner ("The Great Fire · Skip") lay on top of the resource chips at 390, 393, 360, 844×390 and 667×375 | Below 1100 px wide (or 520 px tall) the banner sits at the bottom during the cinematic, where Skip is under the thumb |
| Timer line "Earthquake · 2 at risk" wrapped onto two lines in phone-sized timers                                 | With a risk count, the hazard name is visually hidden (kept for screen readers); the icon names it                    |
| "How to play" wrapped inside its button on the 667×375 title                                                     | One line, tighter padding in the landscape title                                                                      |

Measured afterwards with the iPhone profile (`pointer: coarse`): no control under 44×44 px on the title, HUD, inspector or research panel at
390 and 360 px wide (the 360 px top bar used to drop to 40 px; it now does so only below 341 px), and no horizontal overflow. The perf probe
then showed the decorative valley beyond the board dominating the triangle count, so it now uses far-detail trees (56–160 triangles instead
of 240–344; see `docs/PERF.md`); a 1920×1080 recapture shows no visible loss in the hazy distance.

**Scores (1–5, iteration 3, judged on the inspected captures):**

| Criterion (from the standard) | Score | Basis and what keeps it from a 5                                                                                                                         |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Art direction & cohesion      | 4     | One painterly palette across ages, tiers and the glass UI. Buildings are still simple procedural forms beside a lusher forest.                           |
| Geometry & materials          | 4     | Smooth crowns, masonry, roof palettes, soft stones. No texture detail on walls; citizens are tiny and blocky.                                            |
| Lighting & depth              | 4     | Front-left sun, soft shadows, haze, tilt-shift on high. No ambient occlusion; contact shading comes only from the shadow map.                            |
| Environmental richness        | 4     | Mixed forest with autumn accents, flowing river and banks, fields, smoke, birds, the valley continuing into haze.                                        |
| Interaction quality           | 4     | Placement ghost, suggested sites, a compact placement bar, at-risk pads, a clean forecast outline. The completion bounce is not visible in stills.       |
| Camera                        | 4     | 3/4 diorama framing at every size; the title slowly turns the valley. Quake shake not inspectable in stills.                                             |
| Mobile appearance             | 4     | Every phone size usable with no overlaps after the fixes. The title card covers most of a 360×740 screen.                                                |
| Animation & liveliness        | —     | Not scored: only stills were inspected (two moments of each cinematic). Wind, clouds, smoke, birds and water motion exist but were not judged as motion. |
| Performance & fluidity        | —     | Not scored: no real GPU or iPhone was available. Scene cost is measured (`docs/PERF.md`); SwiftShader frame rates mean nothing for devices.              |

Captures: `docs/screenshots/visual/iter3/` (git-ignored); compressed review copies in `docs/review/visual/v3-*`.

### After iteration 3 — the desktop hover affordance (`v3-hover-1366.jpg`)

The same close view captured with the mouse away from and over a building (1366×768, high tier), on the fresh valley's hearth and on
the showcase village's stone house:

| Seen in the capture                                                                                           | Fix                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| The first version (warm emissive +0.07) was invisible on the hearth's pale stones: only the cursor changed    | A faint, steady pale outline under the hovered building, in the selection ring's decal style  |
| Raising the emissive to +0.1 washed the stone house out: the red roof turned flat salmon and lost its shading | No added light; the building's colour is multiplied by 1.15, which keeps shadows and contrast |

The final pair shows the outline at the house's base and the roof still saturated. A browser test checks the highlight and the cursor,
including the case where the camera moves under a resting mouse; deliberately removing the camera re-pick, or the throttle's trailing
pick, makes it fail.

### Session 5 — villagers by job and age (`v5-villagers.jpg`)

| Seen in the capture                                                                      | Fix                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Jobs told apart only by tunic colour; every working villager carried the same tool shape | A hat or cap per job (straw, felt, leather, red and dark hoods) and a tool per job (hoe, mallet, axe, pick, tablet) |
| The same outfit in every age                                                             | Undyed linen in the first age, dyed cloth in the second, deeper wool and dark trousers in the third                 |
| 21 idle villagers knotted around one hearth in the Age III village                       | Idle people spread wider as there are more of them                                                                  |

Captured before and after at Age I and Age III, from 2.4, 6.5, 10 and 15 cells: the jobs read clearly up close and as coloured hats at
play zoom; at the default distance villagers are still a few pixels tall, and they remain simple low-poly figures — this addresses the
"citizens are tiny and blocky" note under Geometry & materials without changing its score (4). Cost: five more draw calls
(`docs/PERF.md`).

### Session 7 — the Age of Spires (`v7-spires.jpg`)

The long chronicle's later ages (IV–XII) reused Age III's slate roofs and buildings, so a valley twelve ages deep looked
three ages deep (K-024). Buildings raised in age IV or later now build in a fourth architecture, the **Age of Spires**
(`era >= 3` in `src/render/models/buildings.ts`; the engine names the age to match):

| Building    | Age III (slate)                     | Age of Spires                                                              |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Every roof  | slate blue-grey and teal            | copper gone green (three shades, varied per house)                         |
| Cottages    | slate gables and cones, a bare pole | a copper spire with a gold finial on the ridge or cone, a pennant          |
| Stone house | slate gable and chimney             | a corner turret away from the chimney, lit slit window, copper spire, flag |
| Granary     | slate cone and pole                 | a lit lantern cupola under a copper spire                                  |
| Archive     | teal hip roof and portico           | the same hall with a stone bell tower: lit belfry and copper spire         |

Captured with `scripts/showcase-spires.js` (the same cottages, stone houses, granary and Archive raised in age III and in
age IV, side by side, seed 6001) at 19 and 27 cells: the copper roofs and the spires tell the two ages apart at play zoom; the
pennants read only up close. Age III's teal slate (`#5aa3a8`) and the lightest copper (`#73b98a`) are near neighbours.

### Session 7 — the Phase 19 visual gate (`v7-gate-*.jpg`)

Prompt 19's canonical scenes, captured by `scripts/gate-shots.mjs` from the built app (software GL, high tier) at
1920×1080, 1366×768, 390×844 and 320×568: the title, a new lineage at 60 s, a placement, and the Engineers' recorded win on
seed 6001 replayed in the browser to 35 s and 3 s left in each age, the Great Fire mid-cinematic, the first interregnum and
the third age with the interface hidden; plus the showcase close-up and the Age of Spires. Every image was inspected; the
full account (method, before and after, scores) is in `docs/ADVERSARIAL_REVIEW.md`, "Visual gate".

| Seen in the capture                                                           | Fix                                                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A calm valley 3 s before the catastrophe; only the interface warned           | Omens from 30 s left: smoke and embers from the fire's origin, rain before a flood, dust over the quake's forecast zone |
| The history lens's pads hid the ruins between ages                            | A light fill under the outline: the rubble shows through                                                                |
| The land past the board one flat bright green beside a later village          | Meadow patches a few cells across and bushes near the board                                                             |
| Walls without ground contact, one finish for every building, no cloud shade   | Contact shading at wall bases, faint mottling, smoother roof slopes, the valley's cloud shadows                         |
| The phone title sheet over the valley; the 320 px village behind the briefing | The camera's focus in the middle of the uncovered part of a portrait screen; a shorter phone title sheet                |

**Scores (1–5, judged on the final captures):** geometry 4, scene composition 4, material shading 4 (3 before this pass),
lighting 4, foliage 4, water 3, citizen life 3, historical progression 3, HUD restraint 4, touch usability 4. Motion,
real GPUs and phones remain unjudged (K-009).
