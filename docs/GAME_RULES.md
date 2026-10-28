# EPOCH — Game rules (quantitative source of truth)

Numbers for buildings, techs, traditions and epochs are **generated from the live content data** into
[`generated/CONTENT_TABLES.md`](generated/CONTENT_TABLES.md) (`npx vite-node scripts/gen-content-tables.ts`).
This file holds the formulas and flow that the tables plug into. If code and this file disagree, the code and its
tests win and this file is a bug.

Status: rules **v0.3.0** (`RULES_VERSION`), content **v0.2.0** (`CONTENT_VERSION`). Implemented: two 3-epoch scenarios (Greenvale; The Ashen Winter),
four hazards and three difficulty tiers. Winning and losing routes are **executed** and replayed from `fixtures/` (see `fixtures/greenvale-traces.md`).

## 1. Time

| Constant             | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| Tick                 | 100 ms of _active_ simulation (`TICKS_PER_SECOND = 10`)             |
| Epoch                | 600 ticks = 60.0 s (`EPOCH_TICKS`)                                  |
| Warnings             | 25 s, 15 s, 5 s before the end (`FORECAST_LEAD_TICKS = 250/150/50`) |
| Timer outside ACTIVE | none: PREPARE, COLLAPSING, DEBRIEF and INTERREGNUM are unmetered    |

Only `advanceFixedTick` moves time. It refuses unless `phase === 'ACTIVE' && !paused && tick < 600`.
No `Math.random`, `Date.now`, `performance.now` or frame rate in `src/engine` (ESLint-enforced).

### Phase machine

`PREPARE → ACTIVE → COLLAPSE_PENDING → COLLAPSING → DEBRIEF → INTERREGNUM → PREPARE (next epoch)`; terminal `VICTORY` / `DEFEAT`
(a `VICTORY` in the last age can be carried on with `endure`, which leads to `INTERREGNUM`: the long chronicle, §20).
`COLLAPSE_PENDING` is transient inside `collapseEpoch` (hazard resolved exactly once, guarded by `collapseResolved`).
`COLLAPSING` is the read-only presentation window; `continue` moves it to `DEBRIEF` and then onward.
`paused` is orthogonal. A saved ACTIVE game always reloads paused.

### Frozen tick order (`advanceFixedTick`)

1. Apply queued actions in sequence order (re-validated; costs paid once, here).
2. Allocate labor.
3. Progress construction/repair.
4. Production, finite extraction and natural side-effects (soil drain, felling, quarrying).
5. Upkeep, food, morale, births/starvation.
6. Research progress.
7. Forecast beats (25/15/5 s).
8. `tick++`, `totalTicks++`.
9. If `tick == 600` or population is 0 → `collapseEpoch`.

Changing this order changes state hashes; do it only with a deliberate fixture update.

## 2. Actions

| Action               | When                         | Effect                                                                                                                    |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `beginEpoch`         | PREPARE                      | Starts the clock at tick 0. Idempotent-safe: a second call is rejected.                                                   |
| `build`              | PREPARE (plan slot) / ACTIVE | Validated now (`checkPlacement`), queued, paid and created at the next tick boundary.                                     |
| `unplan`             | PREPARE                      | Withdraws a planned order.                                                                                                |
| `cancel`             | ACTIVE                       | Unfinished building only. Refund = `refund‰ × (1 − progress)` of cost.                                                    |
| `demolish`           | ACTIVE                       | Standing building → `salvage‰ × 0.4` of cost back; rubble → its stored salvage. Not the hearth.                           |
| `repair`             | ACTIVE                       | Damaged: 40 % of cost, resumes at 60 % progress. Excavated non-thatch ruin: 65 % of cost, resumes at 35 %.                |
| `reinforce`          | ACTIVE                       | +22 % resistance to one hazard on one standing building. Cost `2 timber + (3 + w·h) stone`. Once per hazard per building. |
| `research`           | PREPARE/ACTIVE               | One at a time. Pays knowledge up front, completes after `ticks`.                                                          |
| `setFocus`           | PREPARE/ACTIVE               | Labor focus: `balanced`, `build`, `food`, `timber`, `stone`, `knowledge`.                                                 |
| `continue`           | COLLAPSING, DEBRIEF          | Advance the presentation / apply verdict or begin the interregnum.                                                        |
| `survey`, `excavate` | INTERREGNUM                  | Bounded archaeology (below).                                                                                              |
| `found`              | INTERREGNUM                  | Choose a founding site and a tradition; starts the next epoch.                                                            |
| `endure`             | VICTORY (last authored age)  | Carry the chronicle on (§20): the centuries pass and a later age can be founded.                                          |
| `rest`               | DEBRIEF (a later age)        | End the long chronicle there, as a victory (§20).                                                                         |

Plan slots: **3** orders may be queued in PREPARE. ACTIVE queue is bounded at **16**. Queued orders reserve their cost
against what you own (you cannot over-plan). Failed actions never charge. Rejected-on-apply actions emit an `action.rejected.*` event.

Error codes are stable strings (`ErrorCode` in `core/types.ts`) and carry hints (missing resources, slope, etc.).

## 3. Placement

A build is legal iff all hold (`economy/placement.ts`):

- Unlocked: `def.age ≤ epoch index` and required tech known.
- In bounds; no deep-water cell unless the building must span the river (needs ≥ 2 river cells); fords are walkable, not buildable.
- No overlap with a non-ruin structure or with another queued order. **Ruins may be built over** (they are cleared; their contents are lost).
- Terrain spread under the footprint ≤ `slopeMax`. The pad is **levelled** to its mean height permanently.
- Quarry: ≥ 12 stone units in footprint + 1-cell ring. Lumber camp: Σ forest within radius 4 ≥ 2500.
- Per-kind `limit` (counting queued orders).
- Reachable on foot from a standing hearth through land, fords and bridges (BFS, cached).
- Affordable after queued reservations.

## 4. Labor

`labor = pop`. If any project is under construction, `builderCap = ceil(labor × share)` with share 45 % (70 % for focus `build`),
split across projects oldest-first up to each building's `maxBuilders`. Remaining labor staffs support buildings (Workshop, Forge) first,
then production buildings by focus order (default: food, timber, stone, knowledge; the focused resource first).
Idle labor produces nothing. `staffing‰ = workers / def.workers × 1000`.

## 5. Production (per tick, integer fixed-point; `UNIT = 1000`)

All outputs are `def.output × staffing × modifiers`, using integer rounding on products divided by exact powers of 10.

| Building    | Formula (permille factors)                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Farm        | `105 × staffing × soil × tech × cond`, `soil = 400 + 0.8 × avgFertility`, `tech = 1000 + foodRate (+250 Irrigation)` |
| Lumber Camp | `120 × staffing × eff × (1000 + timberRate) × cond`, `eff = min(1000, Σforest(r=3) / 9)`                             |
| Quarry      | `85 × staffing × (1000 + stoneRate + 250 Masonry) × cond` while rock remains                                         |
| Archive     | `50 × staffing × (1000 + knowledgeRate + 400 Writing) × cond`                                                        |
| Hearth      | `12 × cond × (1000 + knowledgeRate)` milli-knowledge/tick (storytelling)                                             |

`cond` = 1000 active, 400 damaged. Resources cap at 900 units.

**Finite and persistent side-effects**

- Farm: every 5000 staffing-ticks removes 1‰ fertility from each footprint cell (a fully staffed farm: −120‰ per 60 s) unless Crop Rotation.
- Lumber Camp: every 1 timber produced fells 40‰ (24‰ with Forestry) of forest from the densest cell in radius 3.
- Quarry: each stone removes 1 rock unit from the richest adjacent cell, raises erosion and lowers the slope.

**Upkeep:** a building with upkeep that cannot pay it idles that tick.

## 6. People

- Food: each person eats 12 milli-food/tick (0.12/s).
- Housing: Hearth 6, Cottage 4 (damaged housing counts half).
- Growth: needs food in store of at least 0.06 a person (half a second of eating), no shortage, `pop < housing`, morale ≥ 350; +1 per 70 ticks.
- Hunger: no food → morale −2/tick; −1 person per 50 hungry ticks.
- Overcrowding (pop > housing): morale −1/tick; no growth.

## 7. Hazards (deterministic, no dice)

The forecast and the final resolution call the same function (`world/hazards.ts#resolveHazard`), so mitigation always has exactly the
effect the overlay shows. Seeds only choose the world (and thus ignition point, wind, epicentre); the physics is a function of state.

### Fire

Fuel per cell: grass 12, forest = density/10, structures = `def.fuel` (×0.6 while under construction; rubble 3 stone / 18 wood),
burnt ground ×0.35, bare/water/rock/firebreak = 0 (barrier). Spread is a shortest-path flood from the ignition cell:
cost to enter a cell = `round(700 / (fuel + 3))`, ×0.75 with the wind, ×1.5 against, ×1 across. Cells with arrival ≤ `strength` burn.
Embers may leap **one** bare cell along or across the wind for +42 cost; two cells (a firebreak, a river) stop them.

### Flood

Peak rise = `strength × clamp(1 + 1.5 × (0.42 − meanForest), 0.65, 1.55)` — bare slopes shed water faster. Head starts at river-bed + peak
in every river cell, loses 5 per step outward, and floods any cell whose head exceeds its effective height (levees add +2.2 cells).
A dam cuts the peak to 62 % downstream (rows below it). Each active Grove cell adds +0.9 cells of barrier (vegetation slows water); a damaged levee
adds only half.

### Quake

Intensity at a cell = `strength × 46 / (46 + d²)` (d from the epicentre), ×0.7 on bedrock (rock cells), ×1.25 on soft floodplain (height < 0.85).

### Damage

`damage = exposure × (1000 − resistance) / 1000` (fire: share of footprint burned; flood: `min(1000, 12 × depth_cm) × share`; quake: peak intensity × **1.6**,
because ground motion does far more harm than the same "amount" of heat or water).
Resistance = building + reinforce bonus + traditions + techs (Seismic Engineering +25 % quake) + a Retaining Wall within 5 cells (+25 % quake) − state (damaged −15 %), capped at 98 %.
Outcome: `damage ≥ 600` → **rubble**, `≥ 250` → **damaged**, else intact. Statuses and integrity only ever worsen: a building already damaged that a catastrophe touches without new harm is no worse for it (it is not counted as damaged by it, and its provenance says it came through still in disrepair), and a light blow never raises an older building's integrity, which decides how it weathers between ages.

### People in a collapse

Occupants are spread over standing housing by capacity. Home destroyed: 55 % of occupants die; damaged: 12 %. People above housing capacity
sleep outdoors: 40 % die in fire/flood, 25 % in a quake, if the hazard touched any structure.

## 8. Knowledge and legacy

- **Retention:** a surviving people always keep 1 technology (oral tradition). Each intact Archive adds 3 (+2 with Writing) and a standing Hearth 1; a damaged one adds half (rounded down), a site under construction nothing.
  Each counts at the status it ends the catastrophe with, an older wound included: a damaged Archive the catastrophe barely touches is still damaged (rules 0.4.2).
  The most valuable (highest knowledge cost) are kept.
- **Tablets:** every Archive is assigned technologies in id order (highest value first). A destroyed Archive keeps its tablets in the ruin.
- **Lost** technologies are cheaper to re-research (−35 %).
- **Ruins** are real structures: `rubble` → `buried` after enough centuries/silt. They block building cells until cleared or built over.

### Interregnum (time-skip)

Years pass (`yearsAfter` per epoch). Standing buildings lose `decay × centuries` integrity (×1.5 damaged); ≤ 250 → rubble, < 600 → damaged.
Rubble: wood salvage halves per century, stone ×0.9; burial grows with centuries and silt.
Land: burnt cells (+110 fertility ash), flood silt (+silt/3 fertility), forest regrows +90‰/century toward a fertility-limited potential (×0.6 on scars, so burnt valleys stay sparse for a few centuries),
scars ×0.45, pollution ×0.5, rested fields recover toward 700. A surviving **Seed Vault** adds +140 fertility and +140 forest within radius 7.

### Archaeology (bounded)

**2 surveys** and **1 excavation** per interregnum. Excavation yields salvage × `max(0.4, 1 − 0.2 × burial)`, plus: Archive → its tablets and +6 knowledge;
Seed Vault → +12 food and reseeds radius ~4; Quarry +6 stone; Hearth +4 stone. Excavated stone/earth works can be **repaired** at 65 % of cost.
You cannot excavate the same ruin twice or dig everything. A building restored from a ruin that falls again is a new ruin, to survey and dig again;
a restoration still under construction when it falls keeps its "dug up" mark (its tablets were already taken).

**Pressing a ruin** (the inspector, `src/ui/ruins.ts`) says, from the engine's own records: when and by whom it was built
and what it was for; how it fell — destroyed outright, abandoned, never finished, or broken by a catastrophe and finished
by the centuries (that catastrophe is named unless it was repaired since); what clearing it gives now (its exact salvage,
in whole units as the resource bar counts them, or "less than 1"); and what restoring it costs (rounded up, as every
price in the UI) and does — builders finish the last 65 %, a landmark restored and standing at the end counts as one
from an earlier age, an Archive carries technologies again — or why it cannot be restored yet (not excavated; thatch;
an old hearth; the kind's limit). Tests check the stated salvage and price against what the actions really give and take.

### Founding the next society

Choose one of up to three computed **sites** (ancestral hearth, fertile flats, high ground — each scored against the _next_ epoch's hazard) and one of three
**traditions**: a lesson from the hazard that just struck, a preparation for the hazard the next age brings, and Open Hands (topped up from the same two
hazards once a tradition is already held). Within a hazard the offer rotates with `(seed + 7 × epoch)`, so every tradition comes up in some lineage. Founders = `clamp(round(0.5 × spec.startPop + 0.7 × survivors) + tradition, 5, 16)`.
Starting resources = scenario base + tradition + excavated yield + 10 food from a surviving Seed Vault. Techs = retained + excavated.

## 9. Scoring and endings

Score (debrief, one age): `people = 100 × survivors`, `livelihood = 2 × food made + 10 × buildings standing when the minute
ends`, `knowledge = 120 × retained + 30 × researched`, `ecology = (meanForest + meanFertility)/10`,
`heritage = 150 × heritage structures standing`. Since rules 0.4.1 livelihood counts the works standing as the catastrophe
comes, not every completion: building and clearing the same works again and again no longer inflates it.

**Legacy (the ending, the whole lineage)** counts only what lasted, read from the state after the last catastrophe
(`src/engine/legacy/score.ts`):

| Part      | Points                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| People    | 100 per person who came through the last catastrophe                                     |
| Knowledge | 120 per technology still held                                                            |
| Works     | 30 per building still standing, and 150 more per landmark from an earlier age among them |
| Feats     | 100 per feat the lineage earned                                                          |

Every part is a count of what is there at the end, never a running tally, so clearing and rebuilding, or waiting, adds
nothing. There is no part for the land: between ages the valley regrows and is enriched on its own, so every recorded
lineage that reached its last age ends far greener than it began whatever was built, and such a part would measure the centuries, not the people
(K-023). A run card keeps its legacy and the rules version; "best for this valley" compares only runs scored under the same
rules: a victory first, then the greater legacy, then more survivors.

- **Defeat (any epoch):** fewer than 3 survivors — "no one is left to remember".
- **Greenvale victory (end of epoch 3):** survivors ≥ 8 **and** ≥ 1 **landmark** from an _earlier_ epoch still standing — a Hearth a later society kept (refounding on the same spot), a Seed Vault, a Dam or a Bridge — **and** ≥ 3 technologies carried through the final collapse (a surviving people keeps 1 by oral tradition and 1 more through the Hearth, so an Archive must stand to reach 3). Since rules 0.4.0 an **Archive is not a landmark**: it carries the knowledge, so no single building answers two conditions (before, one well-sited Archive won Greenvale/Normal on every seed; K-003). The planning card lists the three conditions with a live landmark count.
- Otherwise defeat with the unmet conditions listed.

## 10. Ages, technology and what each building does

Buildings unlock by **age** (the epoch index) and by **technology**; the build tray lists later-age or untaught buildings greyed out with the reason.
Techs form a branching tree (industry · ecology · resilience) and cost knowledge; a hearth yields 0.12 per second of it, a fully staffed Archive 0.5 per second (+40 % with Writing),
and idle labor does nothing for it unless the labor focus is set to Knowledge. Knowledge does **not** carry between epochs — only technologies do.

| Tech (branch)                    | Needs            | Effect                                                                 |
| -------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Masonry (industry)               | —                | Quarries +25 %; unlocks Stone House                                    |
| Bronze Tools (industry)          | Masonry          | Builders +15 %; unlocks Bridge                                         |
| Ironworking (industry)           | Bronze Tools     | Unlocks Forge                                                          |
| Irrigation (ecology)             | —                | Farms +25 %                                                            |
| Crop Rotation (ecology)          | Irrigation       | Farms stop mining the soil and slowly restore it toward 72 % fertility |
| Forestry (ecology)               | —                | Lumber camps fell 40 % fewer trees; unlocks Grove                      |
| Writing (resilience)             | —                | Archives +40 % knowledge, carry 2 more techs                           |
| Hydrology (resilience)           | Writing          | Unlocks Levee and Dam                                                  |
| Seismic Engineering (resilience) | Writing, Masonry | All buildings +25 % quake resistance; unlocks Retaining Wall           |

| Building       | Age · tech                 | Mechanism                                                                                                            |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stone House    | any · Masonry              | 5 housing; fire 75 %, flood 50 %, quake 55 % resistance (cottage: 8 % / 25 % / 30 %)                                 |
| Levee          | Bronze · Hydrology         | 2.2 cells of barrier on its footprint; water goes around the ends, so placement matters (limit 6)                    |
| Dam            | Bronze · Hydrology         | Spans the river; downstream flood peak ×0.62; farms within 8 cells get +15 % irrigation; a heritage landmark         |
| Bridge         | Bronze · Bronze Tools      | Walkable crossing, so the far bank becomes buildable; a heritage landmark                                            |
| Retaining Wall | Iron · Seismic Engineering | Buildings within 5 cells gain +25 % quake resistance (limit 4)                                                       |
| Forge          | Iron · Ironworking         | Staffed: quarries and lumber camps within 8 cells work +30 %; its smoke lowers fertility within 4 cells by 3 per 6 s |
| Grove          | any · Forestry             | Regrows +1.2 % forest per 2.5 s on its cells and calms erosion; slows floods; burns (fuel 70)                        |

Every effect above is exercised by `tests/engine/ages.test.ts`; the hazard maths is shared by the forecast and the resolution.

## 11. Greenvale routes (executed)

Two policies written in `src/engine/ai/routes.ts` win Greenvale on seed 6001 by different mechanisms, and their transcripts are replayed by
`tests/engine/routes.test.ts` (see `fixtures/greenvale-traces.md`):

- **Engineers** refound above the flood line after the fire and keep that hearth through the quake — it is their landmark — keep their Archive on the
  north-east ridge inside the quake zone, and survive the Great Quake by Seismic Engineering, Retaining Walls and Stone Houses.
- **Archivists** keep Archive and Seed Vault (their landmark) on ground no age's hazard reaches, found each later society on the High Ground, research for retention and dig up what was left.

A do-nothing village loses to the first fire; twelve random policies never win; a thriving builder that never researches or plans a landmark loses; one
well-sited Archive with nothing else that lasts loses (`minimalRecipe`, `scripts/recipes.ts`).

## 12. Story decisions (agency during the 60 seconds)

Small decisions arise from the village's **actual state** — never as modals, never in the planning phase, never in the last 15 s, at most **3 per epoch**,
at least 10 s apart. Each is a compact chip with a 15 s countdown; if the deadline passes, the **free default** (always "do nothing") is applied.
Answering is a normal timed action (`choose`), validated when sent and re-validated at the tick boundary; an unaffordable choice is refused and the decision stays open.

| Decision                                      | Offered when (state)                             | Options (cost) → real effect                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dry wind (fire age, ≥ tick 150)             | the fire forecast destroys or damages a building | Clear the brush (4 timber): trees and scrub within about 4 cells of the hearth are removed (grass still burns), shrinking the forecast burn · Cut what we can: +8 timber · Trust the forecast |
| The river is climbing (flood age, ≥ tick 250) | the flood forecast reaches a building            | Sandbag (6 timber): buildings within 6 cells of the hearth gain +16 % flood resistance · Bring the harvest in: +10 food · Hold our nerve                                                      |
| The ground trembles (quake age, ≥ tick 250)   | the quake forecast reaches a building            | Brace the worst-hit building (8 stone, +22 % quake resistance) · Shore up up to three at-risk homes (10 stone) · Wait and see                                                                 |
| Refugees (age ≥ 2, ≥ tick 100)                | at least 3 free beds and 12 food                 | Welcome them (8 food): +3 people, +3 knowledge · Turn them away                                                                                                                               |
| A historian (≥ tick 120)                      | an Archive is standing and sound                 | Fund her (6 timber, 4 food): +8 knowledge · Decline                                                                                                                                           |
| The dam is seeping (flood age, ≥ tick 200)    | a sound Dam or Levee exists                      | Patch it (6 stone) · Leave it: it becomes **damaged** (a levee holds half as much)                                                                                                            |

The outcome line states the measured result ("the predicted burn shrank by 18 cells", or that it is unchanged when the cleared scrub lies off the fire's path) and appears in the debrief's important events.
Impossible decisions are never offered (no dam leak without a dam, no refugees without beds). Covered by `tests/engine/story.test.ts` and `e2e/story.spec.ts`.

## 13. Ashfall winter (the fourth disaster) and the Ashen Winter scenario

A regional hazard with its own physics, unlike the three spreading fronts:

- **Plume.** A vent lies upwind of the valley (`ventOf`: hearth − 13 × wind, 4 cells north). Ash depth at a cell is `strength × 70 / (70 + d²)` where `d²` stretches the distance
  downwind (×0.45) and compresses it upwind (×2); river cells receive none. Cells with depth ≥ 120 are in the footprint; `arrival` is distance from the vent, so the overlay and the
  cinematic sweep from the vent downwind. Nowhere is perfectly safe: it thins, it does not stop.
- **Roofs.** `damage = depth × (1000 − ash resistance) × 1.5 / 1000` with the usual rubble ≥ 600 / damaged ≥ 250. Thatch (10 %) fails first; stone houses (60 %), archives (65 %) and
  Granaries (55 %) shed it; the **Steep Roofs** tradition (+25 %), a **Deep Larders** tradition (+10 %), a reinforcement (+22 %) and the "Re-pitch the roofs" decision all help.
- **Famine.** No harvest comes for 30 s. The village needs `population × 12 × 300 ticks ÷ 1000 = 3.6 food each`; it has the food on hand plus **25 per sealed Granary** (12 if damaged).
  Each missing 3.6 food costs one life. The forecast shows it before the sky darkens, and the debrief states the larder it had.
- **Legacy.** Ash raises pollution (it only halves per interregnum), lowers fertility by `depth/6` and thins forest; the terrain is tinted grey where it fell.
- **Granary** (2×2, 10 timber + 6 stone, limit 2, any age) is the counterplay; so is food laid by earlier, farms, and trading timber for grain in the "grey sky" decision.
- **The Ashen Winter** scenario (`ashen`): wildfire → great flood → ashfall winter on the same valley and victory conditions as Greenvale. Both tuned routes win it on seed 6001
  (`fixtures/ashen/`); the Engineers lose it without a Granary (ablation test), a steward who ignores roofs and larders is buried.

Combination effects covered by tests: a Grove planted against floods burns hotter in the next fire; Forge smoke and ash stack on the same soil; deforestation raises both flood
peak and fire reach; a neglected dam weakens before the flood.

## 14. Difficulty tiers

Difficulty changes what the world does and what winning asks for — never the rules or the clock. It is part of the campaign (saves and replay transcripts), and the title screen offers it.

| Tier   | Hazard strength | Survivors | Surviving landmarks | Retained technologies |
| ------ | --------------- | --------- | ------------------- | --------------------- |
| Gentle | ×0.88           | 6         | 1                   | 2                     |
| Normal | ×1.00           | 8         | 1                   | 3                     |
| Hard   | ×1.15           | 10        | 1                   | 4                     |

Strength is applied once, through `hazardStrength` (the difficulty, then a lineage's challenges, §18), so the forecast, the resolution, founding-site risk scores and the bots' foresight always agree.

**Measured, not promised** (`docs/BALANCE_REPORT.md`, `docs/balance/`; scripted bots on seeds 1–40 or 1–100, never humans): under rules 0.4.0 both tuned routes win
Greenvale/Normal on 98–100 of 100 seeds and every Ashen/Normal seed sampled, and on Hard the Engineers win 39/40 on both scenarios and the Archivists 40/40 on
Greenvale and 31/40 on The Ashen Winter. Hard asks for ten survivors and a fourth technology on top of fiercer hazards, which is why the Engineers there raise a
second Archive (more knowledge), learn hydrology in the third age and take Open Hands after the flood. Baselines (no action, random, builder, maximizer) win
nothing on Normal or Hard; the steward wins 7 % of Greenvale/Normal. What Normal still forgives — a player who knows the two moves — is measured by
`scripts/recipes.ts` (K-003).

## 15. Ways to start a lineage

- **Story** — the authored scenarios (Greenvale; The Ashen Winter) on the canonical seed.
- **Seed / shared link** — type a number or any words (hashed to a stable uint32), or open `?seed=…&scenario=…&difficulty=…`. Links are validated: unknown scenarios, non-integer or
  out-of-range seeds, over-long queries and anything that is not a known value are dropped. Nothing in a link can run code or set state.
- **Random valley** — a random seed in the UI layer (never in the engine); the seed is shown and shareable.
- **Daily Ruins** — one seed and scenario per UTC calendar date, pinned to Normal, identical for everyone; a run that began on a date finishes as that date's run (the date is kept beside the save and trusted only if that date's daily really is the saved seed). There is no server
  and no global ranking: results are local run cards (newest first, at most 40) kept in the browser, with "best for this valley" shown on the title and a "Copy link to this valley" button.
- **Assisted** — a setting, combinable with any tier (Gentle is the gentlest pairing): the same 60 simulated seconds at half speed. Assisted runs are marked on their run cards
  and ranked only against other Assisted runs ("best for this valley").

- **Replay an age** — the ending offers "Replay from Age II / III": the lineage as it stood when that age was founded (kept in
  the browser for the current lineage only; a new lineage clears it, and a damaged or foreign point is ignored). Everything
  after it is played again. The lineage is then a **branch**: the briefing and the ending say so, its run card is marked, its
  feats count, and it is never ranked — "best for this valley" (Daily Ruins included) only counts straight lineages. A
  lineage brought back from a backup once it had begun is a branch from the age it was in (a backup could otherwise retry
  an age that was lost).

- **Challenges** — up to three optional twists on the world, its catastrophes or its people, chosen when a lineage begins, or
  drawn for a random valley by an **expedition** (§18).

Not built yet: 8–12-epoch campaigns. A finished lineage can be watched again from the ending (§19).

## 16. Accessibility and audio

- **Keyboard:** Tab through every control; `1`–`9` choose a building; `N` jumps to the next suggested site (safe-from-forecast first, then nearest the village); arrow keys nudge the
  ghost one cell (the camera keeps WASD); `R` rotates; `Enter` builds; `Esc` cancels; `Space` pauses; `H` shows or hides the history lens while planning an inherited age. The whole first epoch can be played without a pointer (`e2e/a11y.spec.ts`).
- **Screen readers:** a polite live region announces each age, 30 s and 10 s left, each forecast warning, the collapse headline, the debrief and the verdict — never every tick;
  warnings are `role=alert`; the placement message states whether the site is valid and why not.
- **Motion:** the OS "reduce motion" preference is the default for the in-game setting; with it, the catastrophe card appears at once with the facts and the camera does not shake.
- **Audio:** procedural Web Audio (no sample files). Created only after a user gesture (one context per page), suspended while paused or hidden, with a master mute (HUD button and
  settings) and independent music/effects volumes. The graph, routing, mute and event→sound mapping are unit-tested with a recording fake; **how it sounds has not been judged by ear**.

## 17. Feats, the Codex and the Atlas of Ages

**Feats** are things a lineage did. The engine awards each one at the moment it happens — when a building is finished, a
research job ends, a catastrophe's report is written, a ruin is dug up or an age is founded — from the state that event
produced, and keeps it in `lineage.feats` (`src/engine/legacy/feats.ts`). They are part of the hashed, replayed and saved
state, so a recorded run always earns exactly the same feats. They change nothing in play.

| Group       | Feat                      | Rule                                                                                                                                                                          |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knowledge   | Words Kept                | Finish an Archive.                                                                                                                                                            |
| Knowledge   | Three Kinds of Knowing    | In one lineage, know a technology of industry, one of ecology and one of resilience (researched, or read from dug-up tablets).                                                |
| Knowledge   | The Grandparents' Library | Between ages, dig up an Archive your lineage built two ages before the people who find it, its tablets still legible.                                                         |
| Heritage    | The Hearth Endures        | Found a new age in a hearth kept from the age before.                                                                                                                         |
| Heritage    | On Old Foundations        | Excavate a ruin left by an earlier age, then repair it into working order.                                                                                                    |
| Heritage    | Living Heritage           | Keep a landmark built in the first age standing through the last catastrophe.                                                                                                 |
| Heritage    | Works of the River        | Finish a Bridge or a Dam.                                                                                                                                                     |
| Heritage    | Five Generations          | Carry the chronicle on, and keep a landmark built in the first age standing through the fifth age's catastrophe.                                                              |
| Engineering | The Fire Stopped Here     | The Great Fire reaches your village but takes no home while a Firebreak you built stands.                                                                                     |
| Engineering | The River Held            | The Great Flood takes no lives, and your Levees or Dam spare a building harm the water would otherwise have done (the same flood is projected with no levee or dam standing). |
| Engineering | Unshaken                  | The Great Quake reaches your village but brings down none of your buildings, with at least six standing (Greenvale).                                                          |
| Engineering | Full Larders              | No one starves in the Ashen Winter, with at least six people to feed (The Ashen Winter).                                                                                      |
| Engineering | Shored Up                 | A building you reinforced against the coming catastrophe is struck by it and still stands.                                                                                    |
| Stewardship | Not One Field Lost        | Bring at least two farms whole through the Great Flood.                                                                                                                       |
| Stewardship | The Forest Returns        | Plant a Grove on ground the fire burned (fire scar ≥ 100 of 1000 under it).                                                                                                   |
| Stewardship | Light on the Land         | Win a lineage without ever ordering a Quarry (a plan withdrawn before the age began does not count).                                                                          |
| Endings     | The Cycle Is Broken       | Win a lineage.                                                                                                                                                                |
| Endings     | Against the Odds          | Win a lineage on Hard.                                                                                                                                                        |
| Endings     | The Twelfth Age           | Carry the chronicle on to the twelfth age and come through its catastrophe with at least three people.                                                                        |
| Endings     | An Age Without Loss       | A catastrophe reaches your village yet takes no lives, and none of at least six buildings is lost or damaged.                                                                 |

"Reaches your village" means the hazard touched at least one of your buildings: a catastrophe that missed the village
entirely proves nothing about how it was built. "Reinforced" means the player's own Reinforce order for that hazard in
that age (a story decision can set the same bonus; it does not count). Every feat is earned by at least one recorded run
(`fixtures/feats.md`, `scripts/record-feats.ts`, `tests/engine/feats.test.ts`). Five Generations and The Twelfth Age
need the long chronicle (§20): the recorded Archivists' victory carried on to the twelfth age earns both (its first-age
Seed Vault stands through the fifth age), and in passing The Grandparents' Library in age X, from an Archive the fierce
returns brought down.

**The Codex** is the device-local list of every feat this browser has seen a lineage earn (`epoch60.codex.v1`). It only
copies records from played lineages — the title screen's demo village never counts — so nothing appears in it that was
not played; stored entries naming unknown feats, scenarios or difficulties are dropped on load. Feats earned in play or
between ages are announced with a toast the first time; those a catastrophe brings are listed in the debrief and the
ending, marked "new" when this device had never seen them. The Codex unlocks nothing: no power, no content behind it.

**The ending** shows an **Atlas of Ages** — one entry per age from its collapse report: the society and its age, the
catastrophe, people before and after, the most valuable technology it knew, the landmarks standing afterwards, the
ecology score and the first line of why it went as it did, plus that age's feats — then the lineage's feats, and two or
three **ideas for the next lineage**: first what the lineage lacked when the end came (people, a landmark, knowledge),
then feats this device has not seen that the scenario allows, then another valley or Hard.

**The history lens** puts the same history on the map (`src/render/history.ts`). Between ages it is always on, since that
is when the player chooses what to dig and where to found. While planning an inherited age it is a toggle: the briefing's
"Show history on the map" button, or `H`.

- Every building and ruin is outlined in the colour of the age that raised it: standing works with an outline, ruins
  hatched.
- Each past catastrophe's reach is drawn from its collapse report: exactly the cells it recorded. A fading field could not
  show it: a flood's own erosion falls below any useful mark once the centuries pass.
- Eroded ground is land with erosion ≥ 30 of 1000, river excluded. Quarries, felling and floods all erode; on the recorded
  runs what crosses the mark is felled woodland the flood then washed over, and quarry pits.
- A legend counts each age's standing works and ruins, the cells each catastrophe reached, and the eroded cells.

It reads the record and the world as they are now. It is drawn over the canopy, because a regrown forest would otherwise
hide the history it grew over, and the hazard forecast steps aside while it is shown. It changes nothing in play. The first
age has no history, so a toggle left on by an earlier lineage does not apply there.

**Then and now.** The game photographs the valley from one fixed viewpoint, the default framing centred on the age's
hearth (`src/render/Snapshot.tsx`). It takes one picture in the last three seconds of each minute, before the catastrophe
resolves, and another afterwards: between ages, or at the ending for the last age. Overlays are left out of both. Between
ages a slider lays the two over each other, "as the minute ended" against "N years later". The ending's Atlas shows each
age's pair. The pictures live only in this session's memory: a game resumed from a save, or reloaded mid-age, has none
for the ages it did not see.

**The chronicle of works** on the ending tells the lives of the lineage's three most storied buildings (`src/ui/chronicle.ts`):
those with the most recorded events, weighted towards landmarks and keepers of knowledge. Each story opens with who raised it
and in which age, unless its own first record already says so ("The founders lit the first fire here."). Then comes one
sentence per recorded event, oldest first: every catastrophe it met, how the centuries treated it, who dug it up or restored
it. Ages are named, not numbered. It closes with the knowledge it keeps and how it stands now. Nothing is invented: apart from
the opening, the knowledge and the closing, each sentence retells one of the building's provenance lines.

## 18. Challenges (world modifiers)

A lineage can begin with up to three of twelve **challenges** (`content/modifiers.ts`). Each changes the world, a catastrophe or the people
for the whole lineage, never the clock or the rules of play, and lists exactly what it changes. They are part of the campaign:
stored in canonical order, hashed, saved and replayed (a transcript carries them). A standard lineage has no challenge field at
all, so it hashes exactly as before challenges existed. A save naming a challenge this build does not know, an empty list, an
unknown order, a clash or a challenge that does not suit the scenario is refused, never trimmed (trimming would change the
simulation).

| Challenge          | What changes                                                                                                                        | Scenarios | Not with                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------- |
| Fertile Floodplain | Fertility +250 (of 1000, at most 950) on land within 6 cells of the river's centre line; flood strength ×1.30.                      | all       | Dry Summers                     |
| Storm Front        | Flood strength ×1.40; forest regrowth between ages ×1.5.                                                                            | all       | Dry Summers                     |
| Dry Summers        | Fire strength ×1.30; flood strength ×0.80; food production −15%.                                                                    | all       | Fertile Floodplain, Storm Front |
| Thin Woods         | Forest ×0.5 at the start; regrowth between ages ×0.5 (less fuel for the fire; less forest in the catchment, so higher floods).      | all       | Overgrown                       |
| Overgrown          | Forest ×1.4 at the start, at most 950 (more fuel for the fire; more forest in the catchment, so lower floods).                      | all       | Thin Woods                      |
| Blight             | Farm output ×0.75 until the lineage knows Crop Rotation.                                                                            | all       | —                               |
| Soft Rock          | Every stone deposit ×1.5; quarry output +25%; quake strength ×1.20.                                                                 | Greenvale | —                               |
| Rich Vein          | No rock within 9 cells of the first hearth; every other deposit ×2.                                                                 | all       | —                               |
| Fractured Fault    | The quake's epicentre is 3 cells east and 3 north of the first hearth (instead of 8 and 8). Founding-site risk shows it.            | Greenvale | —                               |
| Overcrowded Refuge | +4 people and −10 food when the lineage begins and at every founding (people at most 16 after a founding, as always).               | all       | —                               |
| Elders' Lore       | The first founders know Masonry; research costs +20%.                                                                               | all       | —                               |
| Buried Library     | An Archive older than the founders lies buried (depth 3) about seven cells west of the first hearth, holding Writing and Hydrology. | all       | —                               |

Strength deltas add up and multiply the difficulty-scaled strength (Hard and Dry Summers: fire ×1.15 then ×1.30). Rate and
start deltas add to the traditions' (`mods`); regrowth factors multiply. The quake challenges do not suit The Ashen Winter,
where no quake comes. Thin Woods and Overgrown change nothing about the hazards' rules: the fire burns what fuel there is, and
the flood's peak follows the catchment's forest, as always.

The Buried Library is an ordinary ruin from the founders' first day: no catastrophe strikes it, it can be surveyed and dug up
between ages (its tablets then reach the next age like any other dug-up tablets, with 6 knowledge), restored once excavated,
cleared, or built over, which destroys it. Its people are older than the lineage: digging it up does not earn The
Grandparents' Library, which asks for an Archive the lineage itself built.

**Choosing them.** The title's Challenges list shows all twelve. Each opens once this device's Codex holds the feat that shows
its kind of trouble has been met: Fertile Floodplain with Not One Field Lost, Storm Front with The River Held, Dry Summers with
The Fire Stopped Here, Thin Woods with The Forest Returns, Overgrown with Light on the Land, Blight with Full Larders, Soft Rock
with Unshaken, Rich Vein with On Old Foundations, Fractured Fault with Shored Up, Overcrowded Refuge with The Cycle Is Broken,
Elders' Lore with Three Kinds of Knowing, and Buried Library with Words Kept.
They open variety, never power: each has a cost, and a lineage begun with challenges is compared ("best for this valley") only
with lineages begun with the same ones. A shared link may name challenges (`mods=`, validated like everything else in a
link: one unknown, clashing or unsuited name and the link carries none), and is honoured even where this device has not
opened them. The Daily Ruins never carry challenges: they are the same challenge for everyone. Run cards and branch points
keep a lineage's challenges; the briefing lists them every age, the ending names them, Play again and New valley keep them,
and Copy link includes them. Clearing or building over an Archive that was never dug up warns that any tablets inside are
lost with it (what it holds stays unknown until it is surveyed).

**Measured, not promised** (`docs/balance/challenges.md`: `scripts/challenges.ts`, seeds 1–40, Normal, each challenge alone,
the route bots and the steward, which do not read challenges). Every challenge moves what it says: the second age's flood
reaches 560–578 cells instead of 484–497 under Fertile Floodplain and Storm Front, and 429–446 in Dry Summers; the first fire
171–232 cells in Thin Woods against 249–402, and 309–485 when Overgrown or in Dry Summers; the quake 595 cells on Soft Rock and
747 on the Fractured Fault against 527. The tuned routes barely notice most of them: the Archivists win 39–40 of 40 under every
challenge, and the Engineers drop furthest under Blight (34/40) and Dry Summers (36/40). The Buried Library is mostly a gift:
it lifts the steward from 4 to 20 of 40 on Greenvale (the bots dig it on 17–29 of 40 seeds). Elders' Lore changes almost nothing
for the bots, whose plans never use early Masonry. None of this measures a player who reads the challenge and plans for it.

**Expeditions.** An expedition is a random valley (a random seed, drawn in the UI layer, shown and shareable like any other)
with one to three challenges drawn from the open ones by that seed: the same seed always draws the same challenges, and only
ones that suit the scenario and fit together. It is then an ordinary lineage with challenges: ranked against the same seed and
set, kept on its run card, carried by its link. Nothing else about an expedition differs (Phase 13's variable 6–12-epoch target
needs campaigns longer than three ages, which are not built).

## 19. Watching a lineage again

The ending offers **Watch this lineage**: the finished lineage replayed from its first day through the same engine (the same
seed, scenario, difficulty, mode and challenges), each of its accepted actions applied at the tick it was logged, before that
tick runs, exactly as a replayed transcript. The minute runs on the clock at 1×, 2× or 4×; outside it each action waits a moment
of wall time (700 ms while planning, 4 s for the debrief and 1.5 s between ages, at 1×), and the collapse waits out its
6.5 s cinematic at any speed. A replay is a viewing, not a game: the HUD's controls are inert, only Space (pause) works, nothing
can be selected, and nothing is saved, carded, branched or added to the Codex. When it ends, the ending says whether it reached
exactly the lineage's final state (the state hash): it always should, and a test replays recorded lineages through the clock at
several speeds and frame rates to prove it. Stop, or Back to the ending, returns to the finished lineage as it was.

## 20. The long chronicle (endless play after a victory)

A lineage that wins its scenario's last age may **carry the chronicle on** (`endure`, offered on the ending): the
centuries pass as after any other age (400 years, `CHRONICLE_YEARS`), and later ages can be founded, up to **twelve
ages** in all (`MAX_AGES`, which the eleven traditions also bound: each founding adopts one, never twice). The victory
already won stands and keeps its own run card.

- **What each later age brings** (`epochSpec`, `src/engine/content/scenario.ts`): the scenario's catastrophes return in
  their order (Greenvale: fire, flood, quake, then again; The Ashen Winter: fire, flood, ash), each return **10 % fiercer
  per age past the last authored one** (`CHRONICLE_STEP_PM`: age IV ×1.1 … age XII ×1.9), three ways at once: its
  strength (how far it reaches; difficulty and challenges then scale it as usual), the harm it does to every building
  it reaches (`chronicleSeverityPm`, applied to each building's damage before it is classified), and every building's
  resistance against it, divided by the same factor (`effectiveResistance`: walls, reinforcement, materials and
  traditions alike). The forecast shows exactly this, and its "resistance %" is the divided one. All three were needed:
  with strength alone, and then with strength and harm, every winning bot lineage measured lived all twelve ages,
  because a quake's intensity is capped per cell, a fire's harm is the share of a footprint it burns, and a late
  village's resistances sit at their cap (traditions stack every age), so multiplying its tiny vulnerability changed
  nothing. With resistance divided too, defences age out while living out of harm's way still works (measured below). Its headline counts the returns ("The Second Great Fire", … "The Fourth
  Great Quake"); the settlers bring the provisions of the age whose catastrophe returns and build in an architecture of
  their own, the Age of Spires (copper roofs, spires, turrets and pennants; the render layer's fourth era); each later age
  has its own people ("The Ember Folk", "The High-Water Folk", …).
- **Not judged.** A later age has no verdict. At its debrief the chronicle **ends by itself** when fewer than 3 came
  through (`MIN_FOUNDERS`: "The chronicle ends") or when the twelfth age has passed ("The chronicle is complete");
  otherwise the player chooses: let the centuries pass, or **rest the chronicle** there (`rest`: "The chronicle rests").
  Every ending of a long chronicle is a `VICTORY`, since the cycle was already broken.
- **What it keeps.** Everything carries on as between any two ages: ruins, scars, regrowth, archaeology, traditions,
  knowledge and its carriers, feats (a later age can earn a feat not yet earned; the victory feats were earned at the
  victory). The legacy (§9) is read after the last catastrophe, as always.
- **Cards and ranking.** When a long chronicle ends it gets a second run card, marked with the ages it lasted. It is
  **never ranked**: more ages mean more legacy, so it is not compared with lineages of the scenario's length.
- **Replays, saves, branches.** `endure` and `rest` are logged actions, so a transcript replays a long chronicle exactly,
  and Watch this lineage pauses on the victory (4 s at 1×) before carrying it on. Saves accept an age past the
  scenario's last only for a lineage carrying its chronicle on (`Campaign.endless`, absent otherwise, so no other
  lineage's state hash moved). Each later age's founding is a branch point like any other.
- **Bots.** The route policies meet a returning catastrophe with the plan they made for its first coming (`planAge` in
  `src/engine/ai/routes.ts`), and site what must outlast a catastrophe against its next, fiercer return (`avoidedAge` in
  `src/engine/ai/spots.ts`); `playCampaign(…, { ages })` carries a victory on and rests it after that many ages.
  `scripts/chronicle.ts` measures how long each policy's lineages last (`docs/balance/chronicle.md`). Over seeds 1–20
  of both scenarios (Normal), the Archivists live all twelve ages on every seed; the Engineers complete on 8 of their 19
  Greenvale victories and 14 of 20 Ashen ones, the rest falling mostly to the Fourth Great Fire at age X.
