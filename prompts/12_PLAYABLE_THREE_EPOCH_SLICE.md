# Phase 12 — Hard gate: a delightful, complete three-civilization game

This is the **first nonnegotiable complete gameplay milestone**. Do NOT expand to endless mode or 100 buildings until this experience is playable from start to victory/defeat with demonstrated choices, 3D consequences and a satisfying urge to retry.

## The Greenvale 3-Epoch Challenge

Narrative: "The valley will fall three times. Your choices decide what rises from the remains." Same seeded map through THREE complete 60-second active sessions:
- Epoch I, Founders, **Wildfire**. Forests supply timber but fuel a catastrophic fire. Player chooses rapid homes/farms, defensive firebreak, hilltop archive, seed vault or rescue/knowledge efforts. Fire burns genuinely vulnerable structures/trees and creates darkened soils plus buried stone/knowledge caches.
- Epoch II, River Kingdom, **Great Flood**. Ancestral hill archive may be excavated; soil retains ash fertility; bare slopes intensify runoff. Stone defenses, hillside farming, repaired ancient aqueduct, archive knowledge and bridge connectivity are all different strategies. Flood causes physically visible water/ruins and future changed agriculture.
- Epoch III, Iron Dawn, **Earthquake**. Ancient foundations/retaining walls and stored scientific knowledge matter. Player may pursue resilient structure upgrades or evacuate/refound on high ground, depending inherited resources and geography. Quake fractures infrastructure; player needs enough residents, food and institutions to establish a viable inheritable society.

Each epoch has one headline disaster, one material scarcity, at least two opportunities to prepare and one cross-epoch consequence. Player sees clear pre-announced forecasts and a countdown. Buildable icons/cards MUST represent real functions and appear in 3D, not hypothetical screens.

## Victory/defeat design

By end of Epoch III after catastrophe, target victory requires people/resources/heritage criteria actually computed from state; example: >=8 surviving people, >=1 durable heritage project and >=2 discovered/stored knowledge. Tune these based on actual simulation so two contrasting strategies can win on canonical seed(s). Defeat when conditions fail or no viable founders remain. Optional heroic medal for all three epochs with minimal damage or restored valley.

Make explicit conditions readable in PREPARE and debrief; no ambiguous " civilization succeeded" verdict.

## Required competing success routes

Route A, **Engineers**: prioritize quarry/stone + elevated firebreak + flood barriers + final sturdy shelter; sacrifices early technology, preserves more living infrastructure.
Route B, **Archivists**: modest food production + hidden durable archives + fast rediscovery of irrigation/seismic engineering; risks current population but stronger next-age tools.
Optional Route C, **Stewards**: forests/fertility/seed bank + hilltop refuge; less stone/tech but environmental resilience.
**Demonstrate complete automated winning traces** for at least two routes, preferably same canonical seed, and a no-action/random loss. Fix economy until they're real.

## Detailed player experience

First 30 seconds of first session:
1. Start title, see gorgeous valley and "Three ages. One landscape. Every choice survives."
2. Inspect forecast with one visible goal and 3–4 starter resources.
3. Tap a legal plot and choose useful first building from compact bottom tray.
4. Get immediate material cost and animated construction feedback.
5. See citizens work and resource gain.
6. Timer advances; warning encourages protection/knowledge investment.
7. At zero, consequence is visible (trees/huts burn, archive survives if reinforced).
8. Debrief shows what survived and WHY; player eagerly chooses next site/strategy.

Between civilizations: unmetered archaeology screen integrated with actual 3D ruins, a short history ledger and a tangible "found again" decision. Two-tap progression into next 60s epoch. Collapse animation can skip instantly. Save/resume mid-epoch and between lives works.

## Actual visual expectations

Default high-quality map: sculpted rolling hills, detailed era buildings, citizens walking, cast shadows, animated river and foliage, weather gradients. Catastrophe changes those meshes materially: smoke/fire/ash; flood water over realistic low ground; quake fractures/broken bridges. Era II and III buildings have visibly different architecture, not identical huts recolored. Camera orbit, zoom and focus must work throughout. iPhone HUD never hides a majority of map.

## Acceptance automation

Browser E2E:
- New Game -> PREPARE -> Begin Epoch -> select farm -> place correctly -> resource decreases and construction appears -> time advances -> wildfire collapse -> ruins and debrief -> choose founding site -> Epoch II.
- Full scripted 3-epoch route -> victory with meaningful inherited world difference at each stage.
- Distinct scripted 3-epoch route -> victory and different legacy outcome.
- No-action or intentionally destructive route -> defeat with causal explanation.
- Save/reload at 28.6s remaining -> same world and countdown, no duplicated catastrophe.
- Run same action schedule at 30/60 fps -> same final engine hash; World/ruin state reflects actions.
- Playwright phone viewport complete at least initial epoch without inaccessible card; desktop keyboard/mouse construction validated.
- Screenshot default village, mid-construction, wildfire, postcollapse ruin, flood, Iron Dawn and final debrief.
- Audio off/reduced motion still reveal mechanical consequences.

## Fun gates

Count meaningful decisions/epoch, aim 6–15; measure no-action vs strategic, different paths, worst dead time and unnecessary clicks. Force at least one true opportunity cost where current survival conflicts with future legacy. Avoid the trap of tutorial that makes player click "NEXT" 12 times or one unbeatable best building. The pre-epoch period cannot perform free production; every action must have actual cost. A novice should know one valid action within 10s, first building within 15 active seconds.

## Exit

Actual playable beginning-to-end 3-epoch game, two verified different victories, one legitimate defeat, accessible readable 3D with responsive desktop/iPhone controls, documented test evidence. **Do not write "vertical slice complete" if you only simulated end state programmatically without testing browser interaction.** Commit evidence and only then expand scope.