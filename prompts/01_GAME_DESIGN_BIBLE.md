# Phase 01 — Design the game people replay, not a fast city-builder

**Deliverable:** concrete GAME_RULES.md and testable scenario fixtures. Do not stop at a long creative document.

## Promise and emotional peaks

EPOCH is a **60-second-act strategic civilization roguelite**. Every society rises, makes 6–15 meaningful decisions, suffers a foreseeable cataclysm and leaves archaeological, technological, ecological and cultural legacies. Over 8–12 generations a single landscape visibly evolves. Goal: intentionally trade current success for future advantage, make counterintuitive decisions and finally break the recurrent collapse cycle.

Each epoch should have three peaks: **opening possibility**, **last-second dilemma**, **inheritance reveal**. The player must understand exactly why next society inherited a repaired dam or poisoned aquifer.

## Main journey

Title → New Lineage/Continue/Expedition/Daily → pre-epoch planning/ruin survey (unlimited time) → Begin Epoch → real **60 ACTIVE seconds** with visible countdown and quick decisions → imminent forecast + final action choice → skippable cataclysm → debrief/archaeology → found next society on modified same map → eventual world-changing finale → immediate replay option.

Plan phase is unlimited but cannot freely complete production or actions; starter plan slots limited. Active epoch pauses on user pause, tutorial modal or tab hidden. Assisted slow mode should be clearly labeled and scored separately. It is NOT a 60-second tap-speed challenge; architecture and controls must support meaningful play on iPhone.

## Meaningful recurrent decisions

- WHERE place key buildings on real terrain (elevation, roads, river, soil, deposits).
- WHAT spend finite food/timber/stone/energy/knowledge and labor on.
- WHEN prioritize emergency shelter versus archives or megaprojects.
- WHICH tech branch to research at opportunity cost.
- WHICH failing structure or population to rescue as catastrophe approaches.
- WHETHER salvage ancient ruins for current gain or preserve/restore for future payback.
- WHETHER exploit ecology aggressively or sacrifice output to regenerate land.
- WHERE found the next society, choosing inherited advantage vs pollution/geographic risk.

Each requires visible consequence in current era and/or future era. No decisions that merely adjust flavor labels.

## Four legacy classes

**Physical:** remaining bridges, dams, road beds, excavatable ruins, sealed aqueducts, altered terrain and resource deposits.

**Knowledge:** archive fragments, technological traditions, discovered maps, ancient inventions, educational institutions that affect rediscovery after decay.

**Ecological:** forest regrowth, pollution, soil exhaustion, salinity, biodiversity, reservoirs, pathogens and landscape scars.

**Cultural:** social cohesion, traditions, fear of catastrophes, scientific ethos, cooperation and mythology that influence future societal efficiencies/events.

Each legacy has creator/cost, survival condition, disaster interaction, decay, spatial scope, discovery/activation, upside and downside. A legacy is not a disconnected "prestige +5%" tickbox.

## Alternative styles and endings

- Industrialist: rapid expansion, megastructures and huge energy output, risk wrecked biosphere.
- Steward: preserve soil/food/ecology, resilient society, limited immediate tech speed.
- Archivist: maximize recoverable knowledge, weak early material defense.
- Hybrid future: find a mix shaped by seed, catastrophe and prior mistakes.

Winning should eventually require 2–4 cross-era prerequisites assembled through action, not just surviving exactly N cycles. Endings: **Planetary Shield** (defeat external event), **Ark Exodus** (launch resilient colony), **Symbiosis** (earth/ecology/civilization coexist and transcend collapse). Meaningfully different prerequisite trees. Finite defeat: impossible resettlement because catastrophic land/resource spiral, or final generation expires with no pathway to resolution. Intermediate epochs may have poor outcomes but still produce interesting legacy. First run can be lost without punitive restart friction.

## Tutorial and first-play arc

First five seconds show settlement in beautiful 3D with visible river, attractive building and one hazard forecast. One obvious initial action by 15s; no >3 required tooltip slides. Previews show structure costs + what will survive. First epoch should deliver at least one successful building, one production/resource change, a clear warning, a meaningful legacy choice and tangible scene change. First three epochs teach economy, collapse/archaeology, and multi-era synergy. A cold newcomer should understand: "Build what you need now—but decide what the future should find."

## Illustrative first scenario — Greenvale

Small valley, 10 population, 30 food, 30 timber, 15 stone; main founder building plus a small farm. First three cataclysms: wildfire, flood, quake. First generation has starter Woodcutters/Farm/Archive/Firebreak and limited tools. Epoch 2 inherits burnt forest, maybe stone foundations, new irrigation research; Epoch 3 uses surviving archive and advanced shelter. Suggested third-epoch slice win: >=8 surviving population at final debrief, one intact cross-era landmark and two retained discoveries. **These are tuning proposals; run bots to ensure 2 different routes actually win.**

## Score dimensions

People rescued, livelihood/food, knowledge transmitted, ecology, heritage buildings and long-range goal progress; resource efficiency secondary. Cosmetic fast-tap score cannot overwhelm actual strategic achievements. Difficulty/assisted modes and generation rules included in comparable-score key. Loss debrief must explain counterfactual: which specific saved archive/flood barrier would have changed the outcome.

## Required phase artifact and gate

Write docs/GAME_RULES.md with quantitative initial formulas, exact epoch/goal phases, legacy decay and catastrophe order, 3-epoch slice goals, win/loss, score and controls. Write docs/CONTENT_SPEC.md with scenario/age/building/tech/disaster schema and prerequisites. Add fixtures describing 2 distinct win approaches and 1 plausible loss (until executed, mark as proposed). Begin implementing definitions as validated data. Fix contradictions and unplayable expectations before proceeding.