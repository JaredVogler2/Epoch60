# Phase 14 — Transform usable 3D into an unforgettable civilization fantasy

## Art direction mandate

A core lesson from earlier game projects: the user expects an actual **beautiful 3D world comparable to polished concept-art dioramas**, not flat green tilemaps or a field of colored cubes. Treat visuals as a hard gate before launch, with screenshots and adversarial art review. Improve geometry/materials/layout FIRST; VFX/bloom is never a substitute for modeled detail.

Art theme: **centuries in a living storybook**. Sunlit mossy valleys, terracotta and thatch architecture, hand-hewn stone, lively timber, bronze civic squares, smoky industrial revolution, verdant restored ecological metropolises and ethereal future structures. Same ancient landmark can persist through all ages as layered archaeological storytelling.

## 3D world polish

- Environment: smooth modeled topography, curving river and tributaries, bank stones/reeds/foam, 4+ tree canopies, natural forest groupings, instanced grass and wildflowers, farm crop rows, carved quarry, diverse ground paths.
- Buildings: 4+ distinct starter homes/farm variants, detailed arched stone bridge, mill, archive temple, dam, workshop, industry plant, modern science campus and futuristic endgame silhouette. Every important building model includes enough readable volumetric detail—roof/facade/door/window/trim/props—to look attractive at zoom.
- Citizens: recognizable small 3D people with era-appropriate outfits, purposeful walk cycles, carrying material, construction, research celebration, fleeing disaster and rebuilding over ruins. Use shared rigs/LOD to preserve FPS; don't fake everyone as 2D icons.
- Temporal identity: physical inherited ruins, overgrown foundations and reused old material visible when founding in same region; future structures grow around them.
- Lighting: consistent warm directional sun with soft shadows, hemisphere fill, ambient occlusion/contact, gentle fog, correctly tuned material colors and roughness. Sky and grade change by catastrophe and age. No severe blown bloom or muddy dark terrain.
- Water: subtle animated flow normals/specular, foam along banks, flood mesh rising in true risk regions rather than rectangles. Dam visibly diverts water when engine data changes.
- Catastrophes: signed region events drive fire front, smoke, char, flood inundation, quake fracture, dust storm, power grid flicker, post-disaster rubble; all skippable/reduced-motion compliant.
- Camera: buttery pan/orbit/zoom, focus on selected buildings/catastrophe, stable input gestures. Major era change can use <3s skippable time-lapse across SAME geography.

## Adaptive audio

Create original short musical cues and sound system (Web Audio procedural + self-owned sound files) with clear mute and sliders. Warm building clicks, wood/stone construction, footsteps/ambience, research discovery chime, disaster approach tension, catastrophe, mourning/rebuilding and victory. Music adapts to era/clock; not loud repetitive percussion every 60s. iOS gesture unlock required; prevent duplicate audio nodes on component remount; no unlicensed game OST.

## UX feedback and cinematics

Every successful action must communicate cost and outcome in <150ms perceived input latency even if structure takes sim seconds to finish:
- Placement commits create scaffold/worker and gentle building silhouette interpolation.
- Tech unlock sends brief camera highlight or physical structure transformation.
- Counterproductive action gets comprehensible forecast, not inexplicable penalty.
- Collapse destroys only actual affected assets in authoritative world; future layer appears around ancient ruins.
- Interepoch debrief overlays minimal evocative labels on actual affected map positions; a cinematic shouldn't hide the evidence.
- Victory project completion shows full structure with world transformation and concise headline.

Avoid UI pulsing on every resource tick or particles obscuring tap targets. Reduced motion keeps crisp status labels and map state transition.

## Screenshots required

Capture with actual running app, at fixed seed/camera and mobile/desktop:
1. Warm Founders town.
2. Closeup house/tree/river showing dimensional detail and light.
3. During build with animated citizens.
4. Wildfire and burned ruin aftermath.
5. Flood with protected dam, else inundated village.
6. Industrial city among ancient ruins.
7. Futuristic megaproject on evolved geography.
8. Post-civilization archaeology scene.
9. Mobile portrait with compact build tray and readable 60s clock.
10. Victory/debrief scene.

Annotate actual image filenames + commit/seed/viewport; do not use conceptual generated images as evidence of game runtime.

## Testing and art acceptance

Visual scorecard 1–5 by depth/silhouette, distinct ages, material coherence, water, character life, ruins, catastrophes, UI discipline and phone readability; internal subjective scores only, improve sub-4 before release. Confirm no floating buildings, missing GLBs, intersecting roofs, mesh flicker, posterized shadows, bright green checkerboard, blank scene, camera below ground, flat sprites masquerading as geometry. Test stable playable FPS during peak VFX and repeated epochs.

Do not call phase complete because assets exist on disk; they must load, render, remain interactive and show correct engine effects. Commit source/licensing and visual evidence.