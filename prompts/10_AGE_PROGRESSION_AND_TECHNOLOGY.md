# Phase 10 — Four or more visually and mechanically distinct eras with branching tech

## Age design, not skin swapping

The game traverses evolving civilizations on the same land. Each epoch is a generation/civilization, but **multiple epochs may share an age** depending on preserved research and progress; prevent one automatic age-up per 60s regardless of decisions. Distinguish at least four major eras for release:

**Age of Hearths / Ancient:** gather/farm/wood/stone, simple shelters, firebreaks, oral story vs first archive. Visual: timber, thatch, seed fields, smoky hearth.
**Age of Stone & Kingdoms:** masonry, fortifications, bridges, canals, structured education, public works, civic coordination. Visual: warm stone towers, tile-roof towns, arched aqueducts and cobbled roads.
**Age of Steam & Industry:** machines, foundries, rail/transport, mines, electricity precursor, higher output and pollution. Visual: dark brick, ironwork, smokestacks, copper machinery, lit workshops.
**Age of Networks / Modern:** grids, automation, medicine, science, satellites, waste treatment and public infrastructure. Visual: concrete/glass, illuminated roads, communication nodes, greener restoration options.
**Age Beyond Collapse / Future (endgame):** planetary shields, ark launch rings, adaptive ecology, resilient distributed cities, fusion/advanced energy. Visual: lush futuristic architecture with luminous white structures and gardens, not simple glass cube cloning.

A given run may choose different sub-eras/visual hybrids; polluted industrial ruins can sit behind glass present-day structures. Buildings remember originating era and remain recognizable.

## Branching technology graph

Model technology nodes as typed DAG with ids, prerequisites, cost, time, era unlock, active effects, structures unlocked, hazard mitigation, legacy carrier, UI icon, distinct visual theme and historical narrative snippet. At every era include **competing choices** and 2–3 pathways to next:
- exploitative industry (growth now / toxic legacy);
- infrastructure resilience (slow but durable);
- ecological intelligence (health and biodiversity);
- knowledge preservation (fast future rediscovery, fragile now).
No universal best upgrade for all disasters/seeds. Research consumes actual labor/Knowledge/energy and active seconds, unless preserved historical understanding reduces costs. Avoid auto-unlocking everything after X epochs; require player achievements/path prerequisites.

## Cross-era mega-projects

A memorable long-run puzzle uses 2–4 multi-epoch components with actual construction and world influence:
- **Great Watershed**: earthworks → ancient aqueduct → hydroelectric dam → precision water grid → climate stabilizer.
- **Memory Spine**: stone tablets → library → university → protected data vault → future cognitive infrastructure.
- **Skyward Arc**: observatory → industrial alloys → launch technology → orbital platform → star ark.
- **Living Biome**: seed preservation → rotations → ecological restoration → biome engine → symbiotic world.
Each project must consume land/resources during several epochs, survive hazards selectively, and produce different ending conditions. Ensure at least 3 viable ending strategies and environmental tradeoffs. Inherited unfinished work may persist as a ruin/partial project; visible progress in world.

## Inter-era visual metamorphosis

Do NOT instantly replace the whole landscape on tech unlock. Construction upgrade or founding next epoch triggers short transformation from old foundation to new building model, retaining provenance and plausible footprint. Old village road can become cobblestone → rail → transit, with ruins alongside. Fog, atmosphere, world sounds, city density, citizen clothes and landmark silhouettes change per era. Use glTF model variants with consistent material palette and appropriate mobile LOD.

## Goals and failure

Intermediate epochs have milestone goal (e.g. first archive, safe crossings, energy network). Ultimate victory requires an end project plus living society and ecology or alternative tradeoffs. If world is ecologically uninhabitable, give repair pathways early enough to be fair; avoid untelegraphed forced loss. Tech graph validation ensures no impossible prerequisite chains or content that cannot appear. Save/load schema preserves historical discovered nodes and lineage decisions.

## Verification

- Only reachable tech nodes shown enabled; invalid research reason explicit.
- Distinct researched paths alter available build catalog, production/hazards and model styles.
- Same building upgrades retain lineage without duplication/refund exploit.
- 3 victory endings reachable with constructive traces on validated seeds (at least one in shorter automated campaign initially; expand).
- 4+ eras **actually visible and playable** in build, not only named in JSON.
- 8+ epoch run supports multiple age transitions and recurring meaningful choices, not fixed age every turn.
- Visual capture of ancient/kingdom/industrial/modern/future or at least four properly implemented.
- Tech progression remains deterministic and survives serialization.
- No instant super-technology via single lucky archive.
If no alternate real paths and era visuals are minimal, do not mark phase complete.