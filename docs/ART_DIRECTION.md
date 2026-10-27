# Art direction and current state

> **Superseded for session 4 onward by [`3D_VISUAL_STANDARD.md`](3D_VISUAL_STANDARD.md)** (the binding art direction and quality bar),
> [`3D_IMPLEMENTATION_PLAN.md`](3D_IMPLEMENTATION_PLAN.md) and the capture-by-capture log in [`3D_QUALITY_REPORT.md`](3D_QUALITY_REPORT.md).
> The text below describes the pre-session-4 renderer and is kept as history: its faceted low-poly look, a sun placed behind the camera (front-lit, flat
> relief) and per-chimney smoke meshes have since been replaced.

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

| Category             | Score      | Evidence / gap                                                                                                                                                                                                                                              |
| -------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World composition    | 3.5        | Title hero and village read as intentional; map edge/backdrop still plain gradient.                                                                                                                                                                         |
| Geometry depth       | 3.5        | Real roofs/doors/windows/fences/crops; houses still simple; no interiors, few props.                                                                                                                                                                        |
| Materials & lighting | 3          | Consistent palette, soft shadows; no PBR texture detail, no AO, flat-ish sunlight on terrain.                                                                                                                                                               |
| Vegetation           | 3.5        | Four species + bushes + glades; no wind sway; repetition visible when zoomed out.                                                                                                                                                                           |
| Animated water       | 3          | Flow ripples + foam; no reflections or flood surface yet.                                                                                                                                                                                                   |
| Life                 | 3          | Instanced citizens driven by the engine's labor allocation (walk/work/idle, deaths in the collapse), smoke, flames, ripening crops; no personas, outfits by age or interiors.                                                                               |
| Era transformation   | **2.5**    | Cottages and stone houses are re-roofed by the age they were raised in (thatch → fired tile → slate); stone houses, forge, dam, bridge, levee, retaining wall exist; no distinct Age III skyline or industrial district yet. Ruins persist and age.         |
| Events & legacy      | 3.5        | Read-only cinematics for fire (front, embers, char), flood (rising surface) and quake (shockwave, camera shake); scorched ground, snags, charred and mossy ruins; story decisions with measured outcomes. Flood front edge is jagged; no fracture geometry. |
| Camera & input       | 3.5        | Orbit/pan/zoom + touch + keyboard + reliable picking verified in E2E; no inertia tuning pass.                                                                                                                                                               |
| HUD                  | 4          | World stays visible; compact top bar; usable at 390 px. (Phones down to 320×568 and landscape 667×375 are now covered: see the 3D quality report.)                                                                                                          |
| Phone performance    | unverified | No device measurement.                                                                                                                                                                                                                                      |

**Verdict:** a convincing vertical-slice look for Ages I–II with a first Age III roofline, _not_ yet release quality. The gate's rejection rule is not triggered
(it is a real 3D diorama with real placement and consequences), but "Life", "Era transformation" and "Events & legacy" are still below the minimum 4, so the art
gate is **not met**; phase 14 owns the remaining work (citizen outfits per age, industrial/Age III skyline, fracture and flood-edge geometry, audio).

Age comparison and new works: `docs/review/ages-overview.jpg`, `ages-dam-bridge.jpg`, `ages-forge-houses.jpg`; story chip: `story-chip-desktop.jpg`, `story-chip-iphone.jpg`.
Review screenshots: `docs/review/` (JPEG copies; raw PNGs are produced by `npm run test:e2e` into the git-ignored `docs/screenshots/`).
