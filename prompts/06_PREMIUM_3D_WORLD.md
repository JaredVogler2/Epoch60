# Phase 06 — A beautiful stylized 3D civilization world: art is a hard gate

## Art direction: handcrafted miniature world across eras

Visual north star is a polished **miniature tabletop diorama** with painterly materials, tactile geometry, deliberate sun direction, soft shadows and softly animated life. Initial Stone/agrarian settlement: rounded rolling landscape, winding teal river, warm thatched cottages, wooden frames, field rows, orchards, stones, thin paths, chimney smoke and villagers. With age advancement add masonry/castles/arched bridges, brick industrial towers/rail, modern glass/concrete grid and graceful luminous post-scarcity megastructures. All are real 3D, not icons extruded from 2D.

## 3D asset requirements

Build or source (properly licensed with attribution) high quality glTF/GLB 3D geometry; favor reproducible Blender Python/Three.js geometry creation source for original assets. Houses require roof volumes with shingles/beam details, doors, windows, fireplaces/chimneys, foundations and props. Farms need visible furrows/individual crop clusters, barns and fences. Trees need varied canopy shapes and roots/trunks (4+ species/variation). Roads should curve and connect. Rivers have bank geometry, flow normals, mild reflections/foam; ponds/seasonal water levels respond to engine state. Ruins have collapsed roof timbers, fragmented walls, overgrown moss, cracked roads and buried foundations. Avoid default BoxGeometry house + ConeGeometry tree after polish phase; a simple art style can still be richly detailed.

Materials/color:
- Ancient: warm clay, deep leaf green, gold grass, raw timber, rough stones.
- Medieval: terracotta/plaster, blue shadow, lush crops and masonry.
- Industrial: iron/brick, copper, smoke and amber furnace light; soot damages environment.
- Modern: light concrete, muted glass, bright water and clean greenery in sustainable branches.
- Future: ivory ceramics, glowing cyan/gold infrastructure, vertical gardens, elegant orbital architecture.
Cohesion matters more than polygon counts. Keep scale believable and interactive buildings visually distinct at common camera distance.

## Camera/lighting

Three-quarter orthographic or subtle low-FOV perspective looking down 35–50°; bounded orbit, smooth pan and zoom, reset to world, focus selected structure, optional timeline sweep shot. Fixed demo camera should frame geographic landmarks and key civilization area; avoid a board of identical square parcels. Warm directional sunlight, cool hemisphere fill, soft shadows and contact occlusion, atmospheric haze, physically appropriate standard materials with tone mapping. Time-of-day effects emphasize milestone, but no mandatory visually dark nighttime that hides game.

Careful postprocessing only for emissive lighting/future effects; preserve mobile clarity. Real 3D picking via raycaster / hit proxy collider. Selected building subtly glows/highlights; overlay is world-anchored but readable. Avoid dozens of permanent 3D labels cluttering view. Camera inertia tuned separately for mouse and touch.

## Performance-minded rendering

One R3F Canvas, shared material/geometries, instanced foliage/grass/rock, LOD for model detail, optional shadow tiers and dynamic resolution. Geometry changes only when state says construction/damage. Buildings not React-re-rendered every frame; animate component refs/Three mixers. Static and dynamic world separated; dispose resources on seed restart. Stable high/medium/low quality presets; even low retains true 3D volumes and visual identity. Aim stable >=60fps desktop and >=30fps modern/midrange iPhone, pending real measurement.

## Visual acceptance scene set

Capture ACTUAL running-browser screenshots at:
1. Epoch1 60-second opening valley overview (sun/shadows/water/life).
2. House/farm/water closeup (roof details, vegetation, materials).
3. Construction half-complete vs finished.
4. Fire/flood approaching village.
5. Collapsed aftermath ruins.
6. Next society built beside same ruins.
7. At least 2 later eras with materially different architecture.
8. Phone portrait overview with HUD and game still legible.
Compare against an internal art checklist; no declaring complete because canvas exists.

## Browser validation

Raycast click/tap each major building, pan/zoom/orbit without clipping into terrain, react to selected object and actual engine state. WebGL2 compatibility in Chromium and WebKit; if R3F import errors or black-screen, correct immediately. Avoid WebGPU-only code and third-party model URLs breaking after deployment. Check lighting for whitewashed roofs, floating houses and invalid materials.

## Gate

If the screenshot with HUD hidden looks like an empty green chessboard, uniform cones and cube houses, FAIL. Iterate with real geometry, terrain composition, proper lighting and attractive assets until it looks like a product worth exploring. Display must be interactive and fully tied to game simulation, not only cinematic concept art.