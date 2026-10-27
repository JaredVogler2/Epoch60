# Phase 02 — Make every building and resource decision count

## Action vocabulary

Build, Upgrade, Repair, Set Labor Priority, Research, Salvage/Excavate, Preserve, Relocate, Inspect, Pause and explicit End/Confirm. All actions require legal player intent, state preconditions and visible outcomes. Inspect is free, does not advance active time. Actions should require around **two touches** after opening a context, not complex workflows. Every unavailable card explains its cost/constraint.

## Core resources & constraints

Food, Timber, Stone, Knowledge, Power/Energy (unlocked later), Labor, Population, Morale/Health, Ecosystem and land fertility. Not all should remain as permanent top HUD counters; compact the displayed set to most critical 4–5, expand details when tapped. Start with physically grounded feedback:
- Farming needs land, water and workers; productivity depends on soil quality and weather.
- Lumber gives timber and depletes trees; forest loss intensifies flood/fire risk for later eras.
- Quarry gives stone from finite deposits and physically scars slope; partially excavated quarry persists.
- Housing increases capacity but costs wood and may be inundated/burned.
- Workshop speeds labor and construction but consumes food/fuel.
- Archive stores technology/knowledge through cataclysm and costs current resources.
- Granary/Seed Vault persists food/seeds, but requires safe placement.
- Levee/Firebreak/Wall protects specific area from associated hazards and becomes ruin after.
- Dam/Aqueduct creates multi-epoch geography and irrigation impacts, requires repair and careful siting.
- City Hearth anchors people and storage; relocation has real costs.

## Structure data schema — real game rules, not render placeholders

Each building: id, age, tech requirements, allowed biome/slope/adjacency, placement footprint and orientation, resource/labor/build-time cost, upkeep/inputs/output, health, durability per catastrophe, upgrade lineage, production cap, worker needs and priority, radius/influence, emissions, visual asset, ruin model, archaeology discoverability, inherited effects and salvage/refund. Use discriminated TS unions or validated JSON, not scattered magic numbers. Define exact rate units (per tick, per second, per active epoch).

Initial functional set of ten: Hearth, Farm, Lumber Camp, Quarry, Cottage, Workshop, Archive, Seed Vault, Firebreak, Dam/Aqueduct. Build fewer first for early slice but finish them; expansion later. Define era evolutions (stone road → rail → transit; scroll archive → library → data center; dam → hydroplant) with compatibility rules and real visual progression.

## Production tick

A. Allocate workforce to prioritized jobs and construction.
B. Compute terrain/adjacency/tech/labor modifiers.
C. Consume required inputs and apply outputs with storage caps.
D. Apply food demand/shortages and morale/health.
E. Progress construction/repair and research.
F. Apply ecosystem change and finite deposit extraction.
G. Emit reason-coded events for shortages, build completions and resource thresholds.
H. Update UI forecasts derived from state (not separate UI math).

Resource values finite, nonnegative, preferably fixed point/integer. Unproductive labor and transport bottlenecks matter. Don't let all buildings teleport supplies through a severed bridge. Bound pathfinding and don't slow UI with per-agent logistics.

## Strategic balancing and timing

A 60s epoch should support around 6–15 distinct decisions, not 40 required click operations. Building queues/road brush accelerate interaction. First building within 15 active seconds of tutorial; meaningful resource pressure by ~20s; last 10s emphasize preservation. Every fast-build action previews costs and placement, displays a 3D ghost, confirms on tap; resources spent once and queued structure exists in sim. Cancelling has predictable partial refunds/time opportunity cost; prevent cancel/refund loop exploits.

## Tech tree

Three branches: **Industry**, **Ecology**, **Knowledge/Resilience**. Decisions unlock new actions rather than simple linear +10% output:
- Basic: irrigation vs shelters vs written records.
- Middle: water power / fertile rotations / advanced archives.
- Industrial: engines, medicine, science institutions, pollution controls.
- Modern: automation, grid, satellites, climate stabilization.
- Future: planetary defense, seed-world biome engines, ark engines.
Prerequisites and power gating are real. Future people may rediscover historical inventions at lower cost if archives/schools survived; knowledge lost without trace or through decay. Alternatives must have different upsides/risks.

## Tests / gate

Economy deterministic, no negative output/input, bounded capacity, correct dependency ordering, finite land, no instant-building unless design says so, legal placement and adjacency, cancel-spam cannot duplicate resources, research unlocks exact new behaviors, inherited works have actual per-era effects. Two building plans on same seed lead to different ecology and available actions. Add tests and GAME_RULES numbers. Any structure shown in catalog must function; hide prototype items.