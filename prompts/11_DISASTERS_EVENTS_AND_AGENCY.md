# Phase 11 — Imminent disaster creates drama and counterplay, not dice-roll cruelty

## Catastrophe variety with telegraphing

At minimum four implemented disaster types with **different strategic responses and spatial footprints**:
1. **Great Wildfire**: spread based on forest fuel/drought/wind; firebreaks, stone roofing, river and evacuation help. Scars forests/soil and leaves charcoal foundations.
2. **Rising Flood**: accumulated rainfall, river stage and height; levees, channels, dams, bridge siting, relocation and reservoirs matter; deposits sediment and changes farm fertility.
3. **Earthquake**: region fault hazard/foundation types/stone durability; seismic engineering, lighter structures, distributed infrastructure matter; cracks road, can expose mines/caves.
4. **Volcanic Winter / Toxic Industrial Winter**: crop failure, contamination or ash/radiation based on map+industrial choices; greenhouses, food reserves, purification/knowledge matter; scars persist for multiple generations.
Later options: plague, meteoroid, grid collapse, societal fragmentation, asteroid/solar storm—only add if they have coherent unique mechanics and serious visual quality.

Use seeded hazard generators with declared forecast windows and risk confidence. No secret random 100%-chance building deletion before player can meaningfully respond. Player should always have at least a mitigation, relocation, archive, population rescue or acceptance strategy. Some disasters cannot be avoided entirely—this is the premise—but loss severity and inheritance are player controlled.

## Story events from actual state

Generate 1–3 small event choices per epoch, never spam modals during timed play. Events must be selectable from **context/known state**:
- refugees seek shelter (food cost vs workforce + cultural solidarity);
- ancient vault cracked open (immediate salvage vs slow excavation/technology);
- dam leaks (repair costs stone vs risk downstream farms);
- plague risk from pollution (clinic investment vs research);
- forest wildfire warning (evacuate workers vs collect final timber);
- historian discovers lost technique (research branch/knowledge tradeoff);
- guild strike (morale/food vs accelerated workshop output);
- winter ash makes solar low-power (switch energy priorities).
Offer quick 2–3 options with expected tradeoffs; don't interrupt a 60s epoch with a lengthy dialogue. Most show as concise event chip with 10–15s to decide and sensible default "ignore" if not chosen; rare high-consequence critical choice may auto-pause only in narrative/accessibility mode and then categorized as assisted.

## Dynamic feedback and causality

The landscape directly communicates looming disaster: sky darkens, fire glows on ridge, floodwater rises against pillars, earthquake tremors crack road, ash falls and crops lose color. Visual progression MUST match headless hazard masks/time. Audio cues in each danger type with mute/reduced-motion alternatives. Tooltip "Your firebreak protects 3 cottages; the northern wind may change next tick", not arbitrary warning.

NPCs respond according to evacuation/safety priorities and world reachability: workers shelter, farmers harvest frantically, citizens move from unsafe housing to high ground; no walking through fire/water or broken bridges inconsistent with engine. At catastrophe resolution, population casualties/structure losses traceable to exposure and mitigation, not hard-coded storyline.

## Emergent systemic combinations

Test combinations, not just individual bars:
- Industry accelerated deforestation → wildfire reaches exposed village faster; old firebreak becomes later road foundation.
- Dam + glacier-melt flood saves lowland but breaks later when neglected.
- Deep quarry + quake exposes rare metal, also destabilizes shelter.
- Archive sealed underground survives ash but floods in next era unless player reroutes river.
- Dense modern cities produce short-term knowledge and traffic productivity but become fragile to grid collapse.
Never spawn impossible combos without a viable response. A game should show dramatic irony from player choices (success becomes later problem).

## Input and opportunity fairness

Provide forecast at begin epoch and updated risk at ~25, 15, 5 seconds. Event cap per epoch 1–3. No modal requiring typing during active timer. On mobile event popup is one compact bottom sheet not an entire screen. Choices meaningful but optional; auto-ignore choices don't irrevocably wipe colony unless forecast warned. Critical decision can be made from quick action row.

## Test suite

Each catastrophe vs relevant defenses: compare same seed/control with and without mitigation; hazard footprint/damage differs and event reasons match. Hazard progression bounded/reproducible, no negative resources, no irreversible doom at active t=59 without forecast. Events derive from actual prerequisite states, impossible conditions not spawned; choices alter end-state. At least 2 combination effects verified, including a beneficial legacy turned dangerous later. Captured 3D pre-collapse/aftermath screenshots match maps; player can understand loss causation.

## Gate

Every crisis has a recognizable unique physical presentation, strategic response and inheritance consequences. The countdown builds anticipation; losses feel fair and improve next decisions. No luck-only auto loss or cosmetic threat markers.