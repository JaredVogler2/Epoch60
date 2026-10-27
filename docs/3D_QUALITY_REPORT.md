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
