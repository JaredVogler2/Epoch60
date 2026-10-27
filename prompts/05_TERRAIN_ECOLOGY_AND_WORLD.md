# Phase 05 — One physically persistent 3D planet across millennia

## Terrain that is both beautiful and strategic

Build a deterministic constrained world generator with sculpted heightfield, hills, winding river, lakes, shorelines, fertile flats, ridges, rock outcrops and 3–5 biomes. Underlying hex/square logical cells are okay for simulation/pathfinding but **must not be visible as repetitive flat squares**. Render terrain with continuous meshes, blended materials, grassy tufts, rocks, organic vegetation, landform variation and contact shadows. Build a scenic diorama base/edge or atmospheric distant land.

Generator stages: seed terrain elevation and erosion → drainage watershed / river path → soil moisture/fertility → forests/grass/stone/ore deposits → founding-site accessibility → disaster features → ancestor/future capacity viability checks → assign art motifs. Deterministic independence from graphics settings. No infinite reroll loops; bounded retries and curated fallback. Map size should fit quick games (e.g. logical 24x24 or 32x32, tune for readability) and be interactive without overwhelming phone GPU.

## Spatial world game model

World cells store height, biome, water depth, soil fertility, timber regrowth, deposit id/remaining volume, temperature, pollution, salinity, erosion risk, fire/flood/quake exposure and walk/build passability. Structures have footprint, elevation, protection and effect radius. Supply access simplified by path reachability; river crossings/roads matter but don't implement high-cost granular transport that makes 60 seconds unreadable.

Buildings depend on ground, adjacency and resource travel; some improve ecology while others damage it. Land must be visibly scarred: quarry craters, stumps, smoke stains, wet/dry riverbeds, collapsed bridges. State from ancestor epoch evolves through post-collapse decay/erosion regrowth, not reset to procedural virgin terrain each time.

## Natural feedback loops

- Deforestation: more immediate timber → steeper runoff and fire spread; reforesting mitigates future flood and increases biodiversity but reduces current build labor.
- Agriculture: irrigation helps yields → repeated extraction lowers soil fertility unless steward tech rotates crops; salts build up behind poorly maintained canals.
- Mining: finite minerals → terrain degradation and pollution; an old mine can become a later underground transit/mine reservoir or toxic ruin.
- Dam: controls local river water and irrigation/power, slowly silts and risks breach; surviving dam gives large next-era advantage if repaired, but flood catastrophe might turn it into disaster.
- Urbanization: infrastructure improves workforce/knowledge; overbuilt floodplain increases casualties and pollutant concentrations.
- Rewilding: preserved forest/seed vaults enhance recovery generations later, with delayed payoff and competing short-term output.

Implement bounded, legible per-tick updates and more substantial interepoch timeskip transform. Avoid physically inaccurate but opaque "ecosystem minus 1" effects; tie to ground color/foliage/water/landmark status.

## Catastrophe physical coupling

At least 4 hazard masks for release: fire, flood, earthquake, toxic winter/storm (others optional). Fire spread uses fuel, drought/wind/forest, breaks at cleared strips; flood fills from waterways using level/elevation/levees; quake damages based on tectonic risk/foundation/structure resistance; industrial toxicity spreads from polluting facilities/wind/water and decays slowly. These can be discrete approximations, not expensive CFD. Test effects against mitigation choices and visualize physical consequences in 3D. Probability draws seeded and explainable; catastrophic damage should not be random sparkle animation.

## Geological inheritance/archaeology layer

Store legacy ruin/sediment layer per structure with year built, era, original type, collapse cause, integrity, burial depth, salvage yield, decay/resilience, contamination, and discoverable tech/culture. Depth may change via erosion/flood deposits. Excavation modifies cell and yields material/knowledge but can damage future integrity. Ruin mesh remains recognizable beneath new building/tree growth; draw selectively for readability. Debrief "then vs now" slider can ghost previous civilization over current same coordinates, without modifying world.

## Verification

For fixed seed map physically coherent and settlement playable; river has connected mouth/source, no isolated founding region unless intentional challenge, deposits reachable, flood risk indicated. Repeat seed same terrain and world changes. Destroy forest vs preserve leads measurable flood/fire exposure difference in epoch2, and render shows it. Dam vs no dam changes downstream water and crop viability; salvage vs preserve physically changes ruin and yields. Prevent negative deposits or ecosystem infinite loops, clamp water/temperature. At least one viable foundation/alternative path on validated normal seeds.

## Gate

User can see an appealing living 3D terrain whose topography has strategic meaning. First collapse generates map scars and recoverable ruins; epoch2 visibly reuses same altered land. Render/engine state consistent; terrain not a green tile checkerboard; test with screenshots and numeric fixtures.