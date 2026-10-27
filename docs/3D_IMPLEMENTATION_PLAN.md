# 3D implementation plan (session 4)

Living document: each step is ticked only when it is built **and** checked on a real capture (`scripts/visual-shots.mjs`).
Gameplay, the deterministic engine, saves, replays and every existing test must keep passing; rendering stays read-only.

## Audit (what exists, what holds it back)

| Area       | Before                                                                                      | Problem seen in captures                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline   | R3F 9 / three 0.186, WebGL2, Neutral tone mapping, PCF shadows, transparent canvas over CSS | No post, no sky; sun placed behind the camera → front-lit, flat relief                                                            |
| Terrain    | 137² vertex grid, vertex colours from world fields + a grain texture                        | Forest/field boundaries follow the cell grid (diamond stair-steps); muddy brown forest floor; a dark smeared halo along the river |
| Foliage    | 8 instanced kinds from `GeoBuilder` (flat-shaded, per-facet jitter)                         | Faceted "asset-pack" look, one green, no autumn, no tall silhouettes, no wind                                                     |
| Buildings  | 17 procedural models, era roofs                                                             | Strong facet jitter; few windows; archive/dam/wall/bridge read as grey slabs                                                      |
| Water      | grid shader with ripples and foam                                                           | Over-saturated cyan, soft blur at banks                                                                                           |
| Life       | citizens, per-building smoke meshes (6 draws each), flames                                  | No wind, birds or clouds; smoke costs many draw calls                                                                             |
| Backdrop   | CSS gradient behind a transparent canvas                                                    | Grey void visible at board corners                                                                                                |
| Overlays   | forecast and collapse fronts drawn per cell                                                 | Blocky white squares; flood as translucent cell tiles; quake as white squares and hatching                                        |
| Tiers      | `quality.ts` (dpr, shadow map, density), DPR governor                                       | No post/atmosphere switches, no tier step-down                                                                                    |
| Robustness | page visibility handled by the clock                                                        | No WebGL context-loss handling                                                                                                    |

## Steps

1. [x] **Harness** — `scripts/visual-shots.mjs`: title / fresh valley / placement / built village / mid-collapse at 1366×768, 390×844, 844×390
       (core) and all seven required viewports (full). Baseline captured before any change.
2. [x] **Foundation** — sun moved to the front-left (a back-left sun was tried first and put every camera-facing wall in shadow), hemisphere fill, soft shadows fitted to the board, tone-mapping choice by inspection, sky dome +
       distance haze matching the backdrop, opaque canvas, shared atmosphere uniforms (time, wind, cloud shadows) for every material.
3. [x] **Terrain** — noise-warped sampling of world fields (organic edges), new palette, light pebble banks instead of the dark halo,
       painterly brush noise and cloud shadows in the shader.
4. [x] **Trees** — smooth-normal species: round broadleaf, tall cypress/poplar, conifer, birch, bush; per-instance hue, with autumn colour on 14 % of broadleaves, 25 % of birches and 8 % of shrubs;
       wind in the vertex shader; density so forests read as continuous canopies.
5. [x] **Buildings** — low facet noise, windows/frames/doors/chimneys, roof colour variety per age, coursed masonry for archive, dam, walls,
       bridge and stone houses.
6. [x] **Water & overlays** — palette, flow, bank foam; soft-edged animated forecast hatching; collapse fronts (fire, flood, quake, ash)
       drawn as smooth draped fields instead of cell squares.
7. [x] **Life** — one instanced smoke system for all chimneys; bird flocks; cloud shadows; reduced-motion honoured.
8. [x] **Post (high tier)** — composer with MSAA, gentle tilt-shift, grade; CSS vignette on all tiers; single tone-mapping step.
9. [x] **Tiers & robustness** — centralised tier table incl. post/atmosphere switches, software-renderer detection, governor step-down,
       context loss/restore, resize/orientation.
10. [x] **Verification** — three or more capture → inspect → fix iterations recorded in `docs/3D_QUALITY_REPORT.md`; perf probe; full unit + e2e
        suites; review copies in `docs/review/`.

## Constraints and honest limits

- Only Chromium with SwiftShader (a CPU rasteriser) is available here: captures show composition, colour and geometry; frame rates measured
  here are not GPU or iPhone performance. Draw calls, triangles and heap are real.
- No external art assets are downloaded; everything is procedural or vertex-painted, so nothing needs licence attribution.
- Every visual change must leave the engine hash-identical (rendering never writes campaign state).
