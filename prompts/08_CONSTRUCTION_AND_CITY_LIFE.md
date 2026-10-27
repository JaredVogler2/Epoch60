# Phase 08 — Make construction satisfyingly physical and civilizations feel alive

## Objective

Not a spreadsheet-driven city painter: each building placed should feel **tactile, animated, impactful and worth the few seconds it consumes**. Make construction and village activity readable at miniature scale in beautifully rendered 3D.

## Interacting with terrain

When player enters Build Mode:
- World highlights buildable area with tasteful subtle projected edge / footprint; slope, soil, flooded/occupied access and dependency validation. Overlay is temporary, not always-on grid.
- Semi-transparent preview of actual model with its footprint, rotation, estimated worker time, upfront cost, production effect/heritage; arrows/contours showing road/water adjacency bonus if significant.
- Invalid placement displays explicit cause e.g. "no quarry deposit", "too steep", "water blocked", "not connected to settlement", "requires masonry".
- On confirm: cost deducted exactly once and construction site created with foundation, delivery pile, scaffolding and visible construction progress. Workers path to it when available. Building appears in logical stages as it is assembled.
- Completed structures become active, resource flow/trade and objective updates observable. Tap Inspector provides input/output/worker/maintenance and legacy survival potential.
- Repair/upgrade visually modifies geometry in scene, retaining underlying entity ID/relevant lineage; never instant jump to arbitrary icon.

## City people

Populate first epoch with 8–15 small but recognizable 3D citizens sharing a modest rig/animation library, varied color/clothing/occupation silhouettes (builder, farmer, miner, researcher, messenger, defender). Citizens move along roads, work at building footprints, respond to hazards, congregate near hearth, evacuate. Player may change labor priorities rather than micromanage each individual, but the observed avatars must reflect assigned work. Headless deterministic jobs choose destinations and operate discretely; renderer interpolates smooth foot movement and idle gestures without changing resources based on animation.

Use instancing/LOD for later larger populations; visible miniature people count may be representative rather than literally all 5000 modern citizens. HUD accurately identifies aggregate population, scene can label representative units. Explicitly communicate abstraction in design notes; avoid promising exact walking individual for million-person city.

## Strategic spatial system

- Roads shorten travel/transport and affect service range / worker time.
- Buildings have adjacency bonuses/synergies (farm+aqueduct, archive+school, workshop+ore, dam+river).
- Overcrowding/traffic causes a bounded penalty; don't simulate full microscopic traffic that bogs iPhone.
- Power later has infrastructure coverage; failure/water damage cuts lines and shuts down dependent tech.
- Safe high ground matters for shelter; where to build against flood/fire has consequences.
- Constructing one outpost across river may improve minerals but need bridge; bridge destruction disrupts transport.
- Rich 3D placement ghost must agree with state legality: renderer never assumes legality independently.

## Visual detail by building lifecycle

Unbuilt site: readable footprint foundations, worker movement.
In progress: scaffold timbers, piles of stone, raising beams, animated hammer sound and dust.
Complete: roof/trim/window lights, small smoke or production motif; contextual positive feedback.
Underused: less activity, workshop cold, fields withering.
Damaged: char, broken beams, cracked masonry, broken wires.
Ruined: fallen roof, buried debris, remaining foundation; weathering/overgrowth by age.
Restored: old stones remain visibly different from new material, not instant pristine clone.

## Important game feedback

Workers need not have exact rendered physical contact with every mesh, but cannot walk across a destroyed bridge or underwater route inconsistent with engine. Construction progress should be visible from overview, not require inspecting numeric bar. When food production begins, crops gain visual growth or sacks/cart/harvest effects and resource trend visibly changes. When timber consumed, some actual forest trees disappear according to logical forest depletion, avoiding sudden unrelated tree vanish if far away.

## Workload constraints

In each 60s epoch, player typically performs 6–15 key actions. Multi-placement brushes (road/farm row) count one interaction but pay appropriate resources and time; preview number/cost. Auto-suggest recommended valid location with a single confirmation to help phone players, but do not remove siting decisions. Queue 2–4 builds maximum until tech upgrades; clear opportunity costs.

## Tests and acceptance

Place 2 different buildings in same seed and show different output and world presence. Repair vs leave damaged affects next epoch legacy. Build on river/steep slope correctly rejected. Resources, no duplicate cost/cancel exploit, path connection matters, workers appear at assigned site, model states match engine construction percentage, destroyed structure no longer produces. Visual Playwright screenshots: blueprint ghost, 50% progress, finished farm, later same farm ruined and overgrown. The game scene should feel populated and reactive while remaining performant.