# Phase 09 — The emotional center: collapse, archaeology, and world-changing legacies

The unique selling point is not the 60s clock alone: **what survives 60 seconds and how a later society uses it**. Allocate the most gameplay and VFX design effort here.

## Canonical catastrophe and survival model

Each epoch has a preannounced likely catastrophe type (fire, flood, quake, volcanic winter, nuclear/industrial cascade, asteroid etc as unlocked). At clock zero or explicit early terminal, resolve hazard footprint/severity deterministically from seeded environmental conditions and built mitigation. For every active structure and district calculate: exposed hazard, material resistance, structural condition, linked shielding/support, structural damage, survivor/rescue status and resource loss. Terrain cells similarly update forest cover, water/soil/pollution/debris. No total wipe of everything; geographic asymmetry creates salvage/strategic decisions.

## Legacy objects with lifecycle

For EVERY important structure create persistent LegacyRecord:
- origin epoch, age, owner/culture, type, orientation/footprint/world coordinates;
- built condition, final damage, survival category (functional / dormant / damaged / buried / rubble / consumed);
- remaining usable/repairable parts, salvage quantity and location;
- archive/tech content preserved, ecological legacy, cultural stories;
- time/decay function depending on original materials and catastrophe;
- discoverability, excavation costs/risks and upgrade-compatible age branches;
- provenance event IDs "Hearth at (8,14) destroyed by flood; foundation persisted, 28% durable material remained."
Convert visible structures to coherent ruin meshes with burnt timbers, exposed stone, collapsed roofs, scattered props, wet sediment, ivy and excavation holes; do not replace with generic icon labels.

## Between-epoch passage of ages

Skip hundreds/thousands of in-world years according to campaign pacing. Compute forest succession, material weathering, river sediment and course drift bounded by watershed, deposit changes, pollution decay or persistence, archeological depth and technology erosion. The world remains recognizably the SAME terrain, but a millennial timeskip should feel different: overgrown old road, softened city footprint, flooded ruined foundations, growing trees over broken wall, ancient dam still shaping water. Future founding sites can choose to build atop older foundations, which may save resources or risk contamination.

## Archaeology as actual gameplay

In the unmetered **Interregnum**, inspect prior landscape with time-scrub/ghost overlay, highlight recoverable sites. Choose limited archaeological priority (e.g. 1 free survey + 1 limited excavation slot) or start with excavation project in next epoch that consumes clock/resources. Discover ancient archive to reduce technology research cost; salvage mill for stone; recover seed vault for fertile crops; restore partially functional aqueduct; bulldoze ruin for flat building lot. Some ruins are hazardous/cursed culturally (radiation, quake cracks), so discovery is meaningful. No fully free excavation of all sites and no giant unbounded inventory. Provide one strong high-value decision each interepoch.

## Tradeoffs and synergies

- Finish dam in Epoch 1 → survives wildfire but needs maintenance in Epoch 2; improves irrigation during flood response; silt in Epoch 4 if ignored.
- Preserve archive at cost of losing food surplus → next era starts with learned masonry, but population is small and land may be damaged.
- Clear forest for quick timber → build many homes now, wildfire devastates these and later generations inherit eroded soil.
- Plant diverse forest before winter → current era slower, future fertile food network and flood defense.
- Rebuild on ancient foundations → faster city growth, but might inherit unstable quaked underground structures.
- Human civic heritage and myths modify morale/tech adoption with visible reasons, never invisible arbitrary buff.

## Make catastrophe thrilling but not obnoxious

At last 15s: sky color shifts, impending disaster geometry/banners and visual urgency. Last 5s: amber/red warning plus optional soft audio, clear suggested protection. At 0: 2–4s skippable cinematic that follows real hazard cell propagation: fire spreads and buildings char, floodwater rises around real hills, seismic shake collapses at affected foundations, toxic cloud poisons a district. Then camera pulls back to silent devastated miniature settlement; bright outline of **what survived**. Avoid detached full-screen pre-rendered video that misrepresents player outcomes. Low-motion mode replaces with stateful crossfade/summary.

## Collapse Report / Story of Two Civilizations

Concise high-impact page:
- "The Great Fire took 8 houses. Your Stone Archive survived."
- survivors, food/knowledge, functional structures, ruins and damage overview;
- map-based before/after slider anchored same camera and coordinates;
- 3 most decisive causes and counterfactual (e.g. 2 more stone needed to reinforce archive);
- preserved lineage ledger with 1–3 selectable legacy decisions, not a huge table;
- button "FOUND THE NEXT AGE" with fresh valley silhouette/era update.
Player should instantly want to test whether their "failed" epoch enabled a genius next epoch.

## Tests

Idempotent collapse, stable event provenance, no resurrection after damage, same seed+actions same ruins, physical placement maintained, true material-dependent survival, technology only inherited via valid carrier, no repeated-free archive/salvage exploit, decay finite and bounded, ecological scar changes later production and rendered terrain. Integration trace proves **sacrificing present economy for archive** wins later under a seed where maximizing immediate houses loses. Another trace proves preserving ecology beats resource rush in a different hazard. Visual screenshot compare two strategies' future world, not only score bars.

## Gate

If Epoch 2 looks like a completely new seed with a "Legacy +20%" text badge and no genuine visible ruins/modified ecology, FAIL. The transition must be one of the most delightful features of the entire game and mechanically change successor choices.