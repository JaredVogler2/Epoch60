# EPOCH60 — 3D visual standard

Status: **adopted in session 4** (supersedes the "faceted low-poly" intent in `ART_DIRECTION.md`, which stays as the history of what was built before).
Reference supplied by the owner: a cozy painterly village builder seen from a high three-quarter view — dense mixed forest with autumn accents, patchwork
fields, colourful pitched roofs, chimney smoke, dirt lanes, soft warm light. We do not copy any asset or layout from it; we adopt its _qualities_.

## 1. Identity in one sentence

**A hand-painted miniature valley on a tabletop, lit by a late-morning sun: soft rounded forest, warm earth, colourful roofs that change with the ages,
and a world that keeps moving — smoke, wind, water, people, clouds — until the minute ends and the catastrophe rewrites it.**

## 2. Style rules

| Rule                                                                      | Why                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Smooth-shaded organics, crisp-edged architecture.**                     | Trees and terrain read as soft and painted; buildings keep clean silhouettes so they stay legible.                                                     |
| **Colour lives in hue, not in facet noise.**                              | Per-facet brightness jitter made everything look like a low-poly asset pack. Variation is now per-object (instance hue) and per-area (painted ground). |
| **Value structure: dark forest masses, light open ground, bright roofs.** | The eye lands on the village first, the forest frames it, the river leads through it.                                                                  |
| **Warm light, cool shadow.**                                              | Depth without darkness; shadows are blue-green, never black.                                                                                           |
| **Atmosphere over detail at distance.**                                   | Warm haze and a slight miniature blur make the far valley recede instead of competing.                                                                 |
| **Motion is ambient and purposeful.**                                     | Wind, smoke, water and cloud shadows are always present but slow; disasters are the only fast motion.                                                  |

## 3. Palette (sRGB)

| Role                  | Colours                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Meadow                | `#7e9a4c` (base), `#9aa858` (dry), `#5f8a3e` (lush), `#8fa45a` (hill)                                                        |
| Forest floor / shade  | `#4f6a35`, `#3f5a2e`                                                                                                         |
| Conifer / cypress     | `#3b5a31` → `#5f8040` (top light)                                                                                            |
| Broadleaf             | `#5d8a3c` → `#8db552`; birch `#9cb85a` → `#c6d47a`                                                                           |
| Autumn accents (≈12%) | `#d9862b`, `#e3a83a`, `#c4612d`, `#b8913a`                                                                                   |
| Earth / lanes / yards | `#9a7450`, `#b08a5e`, packed yard `#a98a62`                                                                                  |
| Fields                | wheat `#d9a441`, young crop `#9cb658`, ploughed `#8a6040`, flax/pink `#d49a8a`                                               |
| Water                 | shallow `#62b3ad`, deep `#2b6f7e`, foam `#f1efe2`                                                                            |
| Roofs by age          | Age I thatch `#d6a64e`/`#c8943e`; Age II tile `#c4553c`, `#d8743a`, `#b84a3a`; Age III slate `#4f7f92`, `#5aa3a8`, `#56677a` |
| Walls                 | cream `#eadcc0`, warm plaster `#dcbd8c`, timber `#6b4a2e`, stone `#b5a993`, brick `#a8584a`                                  |
| Sky / haze            | zenith `#9cc3e2`, horizon `#f1e2c6`, haze `#e9dcc4`                                                                          |
| UI                    | ink `#1e1912` panels at 78–88% opacity with blur, gold `#e8b84a`, warn `#f0a24a`, bad `#e0614a`                              |

Hazard colours stay functional and saturated (fire orange, flood blue, quake ochre, ash grey) so the forecast is never confused with scenery.

## 4. World scale, camera, composition

- One cell ≈ 4 m; a cottage is ~1.4 cells tall; trees 1.2–2.4 cells. The board is 34 × 34 cells — a valley, not a continent.
- Default camera: high three-quarter (polar ≈ 0.78–0.95 rad from vertical, 30° vertical FOV), looking up-valley across the hearth, so the river enters
  from the top, crosses the frame and leaves at the bottom (a natural leading line).
- **Desktop composition:** the village sits slightly below and left of centre (rule of thirds), forest masses frame the left and right thirds, the
  far ridge and haze fill the top band. **Portrait phones** use a steeper, closer framing centred on the hearth so the village fills the middle band
  between the HUD and the tray; **landscape phones** frame the village left of centre because the tray is a right-hand column.
- Foreground / midground / background: near trees and tufts (foreground silhouettes), village and fields (focus), far forest, ridge and haze.
- The board edge is a diorama cut: grass lip, roots and soil strata over a warm backdrop that fades into the same haze as the sky, never a grey void.

## 5. Materials and texture language

- Terrain: vertex-painted from the real world fields (fertility, forest, rock, scar, silt, erosion, pollution, roads) with **organic, noise-warped
  boundaries** (no cell stair-steps), a painterly brush-noise layer and moving cloud shadows.
- Foliage: smooth "canopy" normals (pointing out of the crown) give soft round shading; vertical value gradient (darker underside, sunlit crown); a hue
  per instance from the species palette; slow wind sway that grows with height.
- Architecture: clean planes with only faint facet variation; windows (dark glass, cream frames), doors, chimneys, eaves and darker fascia lines give
  the hand-drawn edge seen in the reference; masonry works show coursed blocks rather than grey slabs.
- No metal sheen except iron (forge) and wet stone; roughness ≈ 0.9 everywhere else. No textures downloaded — everything is procedural or vertex-painted.

## 6. Lighting and atmosphere

- Key: warm sun from the back-left of the default view (high, ~55° elevation) so shadows fall toward the viewer and to the right — form and depth
  without front-lit flatness. Fill: sky/ground hemisphere (cool blue above, warm earth below). Soft PCF shadows fitted to the board.
- Tone mapping: chosen by inspection between Neutral, AgX and ACES (see quality report); exposure tuned so roofs keep their hue.
- Atmosphere: gradient sky dome and matching distance haze; clouds as slow shadows on the land; the mood shifts per hazard during the last half-minute
  (fire: amber, flood: grey-blue, quake: dusty ochre, ash: desaturated).
- High tier adds a gentle miniature (tilt-shift) blur and vignette; lower tiers keep the vignette (CSS, free) and drop the blur.

## 7. Motion language

| Element      | Motion                                                      | Speed / amplitude          |
| ------------ | ----------------------------------------------------------- | -------------------------- |
| Trees, grass | sway grows with height, phase varies by position            | 0.25–0.5 Hz, ≤ 3° (canopy) |
| Smoke        | puffs rise, drift with the wind, swell and fade             | 4–6 s per puff             |
| Water        | ripples flow downstream; foam breathes at banks             | slow, continuous           |
| Clouds       | shadows cross the valley                                    | ≈ 1 cell / 3 s             |
| Birds        | small flocks circle the valley                              | wing beat 3 Hz, slow orbit |
| Citizens     | walk/work/idle from the engine's real labour allocation     | as simulated               |
| Camera       | eased orbit/pan/zoom; framing moves on age change and focus | critically damped          |
| Disasters    | the only fast motion: fire fronts, flood rise, shockwaves   | event-driven               |

`prefers-reduced-motion` (and the in-game setting) stops wind, birds, cloud drift and camera shake; smoke and water slow to a near-still state.

## 8. Quality tiers (same art direction at every tier)

| Feature                        | High            | Medium     | Low                |
| ------------------------------ | --------------- | ---------- | ------------------ |
| Pixel ratio cap / adaptive     | 2 / yes         | 1.75 / yes | 1.25 / yes         |
| Shadow map (PCF)               | 2048            | 1024       | 1024               |
| Foliage / grass density        | 100% / 100%     | 80% / 55%  | 60% / 25%          |
| Wind, cloud shadows, birds     | yes             | yes        | wind + clouds only |
| Tilt-shift blur + grade (post) | yes             | no         | no                 |
| Vignette                       | CSS (all tiers) | CSS        | CSS                |

Auto selection: desktops high, touch devices medium, software rasterisers low. The frame-time governor lowers the pixel ratio first (a run of
frames over 250 ms counts as over budget; a lone long frame is a hitch and is ignored); if frames stay over budget at the lowest ratio it sheds,
one step per two strained windows, first the post chain and then the birds and the valley beyond the board. It never removes geometry the
player needs or any information. The player can override the tier in Settings.

## 9. Acceptance (each scored 1–5 by inspection of real captures; target ≥ 4)

Art direction & cohesion · geometry & materials · lighting & depth · environmental richness · animation & liveliness · interaction quality · camera ·
mobile appearance · performance & fluidity. Scores are recorded with the screenshots they were made from in `docs/3D_QUALITY_REPORT.md`;
anything that could not be inspected (real GPUs, iPhone Safari, frame rates) is marked unverified, never estimated.
