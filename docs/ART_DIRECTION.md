# Art direction and current state

## Intent

A handcrafted miniature diorama of a green valley, seen 3/4 from above: warm sun, soft shadows, faceted low-poly forms with painterly vertex colors,
a flowing teal river, thatched villages that visibly age into ruins and later eras. Not photoreal; art-directed richness.

## How it is built (all procedural, no external assets)

- **Terrain:** Catmull-Rom–smoothed 32×32 height grid rendered as a 129×129 vertex mesh; vertex colors from the _real_ world fields
  (fertility, forest, rock, burn scar, silt, erosion, slope, riverbank wetness) + tiled grain texture; building pads are levelled and blended in.
  Soil-strata skirt gives the diorama edge. Water is a shader on the same grid (depth → color, ripples flowing downstream, foam at shores).
- **Vegetation:** instanced pines, oaks, birches, bushes, charred snags, boulders, grass tufts, flowers, driven by forest/scar/rock fields
  (felling and fire visibly change the land; natural glades).
- **Buildings:** `GeoBuilder` flat-shaded primitives with per-facet color jitter. Three cottage silhouettes (longhouse / round hut / framed cottage),
  furrowed and fenced fields with ripening crops, log-pile lumber camp, stepped quarry with crane, workshop, portico archive, earth-mound seed vault,
  trenched firebreak, stone-ring hearth with animated flame and smoke. Construction: scaffold + clip-plane that sweeps the model up as `progress` advances.
  Ruins: foundation ring, broken wall stumps, fallen/charred beams, moss when old, mound when buried.
- **Light:** warm directional sun with soft shadow, cool hemisphere fill, Khronos Neutral tone mapping (ACES desaturated roofs).
- **Winding safety:** every primitive orients its own triangles (`orient()`), after an inverted-normal bug produced grey roofs.

## Self-assessment vs `QUALITY_GATE_VISUAL_AND_FUN.md` (honest; 1–5)

| Category             | Score      | Evidence / gap                                                                                                                                                          |
| -------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World composition    | 3.5        | Title hero and village read as intentional; map edge/backdrop still plain gradient.                                                                                     |
| Geometry depth       | 3.5        | Real roofs/doors/windows/fences/crops; houses still simple; no interiors, few props.                                                                                    |
| Materials & lighting | 3          | Consistent palette, soft shadows; no PBR texture detail, no AO, flat-ish sunlight on terrain.                                                                           |
| Vegetation           | 3.5        | Four species + bushes + glades; no wind sway; repetition visible when zoomed out.                                                                                       |
| Animated water       | 3          | Flow ripples + foam; no reflections or flood surface yet.                                                                                                               |
| Life                 | **1**      | **No citizens yet** (phase 08). Smoke and fire only.                                                                                                                    |
| Era transformation   | **1.5**    | Only Age I architecture exists; ages II/III reuse thatch models. Ruins persist and age (this is working).                                                               |
| Events & legacy      | 3          | Fire: scorched ground, snags, charred ruins, forecast overlay. Flood/quake have no visuals beyond the overlay and ruins. Collapse is a title card, not yet a cinematic. |
| Camera & input       | 3.5        | Orbit/pan/zoom + touch + keyboard + reliable picking verified in E2E; no inertia tuning pass.                                                                           |
| HUD                  | 4          | World stays visible; compact top bar; usable at 390 px. 320 px layout not yet captured.                                                                                 |
| Phone performance    | unverified | No device measurement.                                                                                                                                                  |

**Verdict:** a convincing vertical-slice look for Age I, _not_ yet release quality. The gate's rejection rule is not triggered (it is a real 3D diorama with
real placement and consequences), but "Life" and "Era transformation" are below the minimum 4 and block the art gate until phases 08/10/14 land.

Review screenshots: `docs/review/` (JPEG copies; raw PNGs are produced by `npm run test:e2e` into the git-ignored `docs/screenshots/`).
