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

`PREPARE → ACTIVE → COLLAPSE_PENDING → COLLAPSING → DEBRIEF → INTERREGNUM → PREPARE (next epoch)`; terminal `VICTORY` / `DEFEAT`.
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
- Growth: needs food ≥ 6 s of consumption, `pop < housing`, morale ≥ 350; +1 per 70 ticks.
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
Outcome: `damage ≥ 600` → **rubble**, `≥ 250` → **damaged**, else intact. Statuses only ever worsen.

### People in a collapse

Occupants are spread over standing housing by capacity. Home destroyed: 55 % of occupants die; damaged: 12 %. People above housing capacity
sleep outdoors: 40 % die in fire/flood, 25 % in a quake, if the hazard touched any structure.

## 8. Knowledge and legacy

- **Retention:** a surviving people always keep 1 technology (oral tradition). Each intact Archive adds 3 (+2 with Writing); a damaged one adds half.
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
You cannot excavate the same ruin twice or dig everything.

### Founding the next society

Choose one of up to three computed **sites** (ancestral hearth, fertile flats, high ground — each scored against the _next_ epoch's hazard) and one of three
**traditions**: a lesson from the hazard that just struck, a preparation for the hazard the next age brings, and Open Hands (topped up from the same two
hazards once a tradition is already held). Within a hazard the offer rotates with `(seed + 7 × epoch)`, so every tradition comes up in some lineage. Founders = `clamp(round(0.5 × spec.startPop + 0.7 × survivors) + tradition, 5, 16)`.
Starting resources = scenario base + tradition + excavated yield + 10 food from a surviving Seed Vault. Techs = retained + excavated.

## 9. Scoring and endings

Score (debrief): `people = 100 × survivors`, `livelihood = 2 × food made + 10 × buildings`, `knowledge = 120 × retained + 30 × researched`,
`ecology = (meanForest + meanFertility)/10`, `heritage = 150 × heritage structures standing`.

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

| Decision                                      | Offered when (state)                             | Options (cost) → real effect                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A dry wind (fire age, ≥ tick 150)             | the fire forecast destroys or damages a building | Clear the brush (4 timber): forest/scrub within 3 cells of the hearth is removed, shrinking the forecast burn · Cut what we can: +8 timber · Trust the forecast |
| The river is climbing (flood age, ≥ tick 250) | the flood forecast reaches a building            | Sandbag (6 timber): buildings within 6 cells of the hearth gain +16 % flood resistance · Bring the harvest in: +10 food · Hold our nerve                        |
| The ground trembles (quake age, ≥ tick 250)   | the quake forecast reaches a building            | Brace the worst-hit building (8 stone, +22 % quake resistance) · Shore up up to three at-risk homes (10 stone) · Wait and see                                   |
| Refugees (age ≥ 2, ≥ tick 100)                | at least 3 free beds and 12 food                 | Welcome them (8 food): +3 people, +3 knowledge · Turn them away                                                                                                 |
| A historian (≥ tick 120)                      | an Archive is standing and sound                 | Fund her (6 timber, 4 food): +8 knowledge · Decline                                                                                                             |
| The dam is seeping (flood age, ≥ tick 200)    | a sound Dam or Levee exists                      | Patch it (6 stone) · Leave it: it becomes **damaged** (a levee holds half as much)                                                                              |

The outcome line states the measured result ("the predicted burn shrank by 18 cells") and appears in the debrief's important events.
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

Strength is applied once, inside `resolveHazard`, so the forecast, the resolution, founding-site risk scores and the bots' foresight always agree.

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

Not built yet: 8–12-epoch campaigns, the 12 strategy-changing world modifiers, a replay viewer.

## 16. Accessibility and audio

- **Keyboard:** Tab through every control; `1`–`9` choose a building; `N` jumps to the next suggested site (safe-from-forecast first, then nearest the village); arrow keys nudge the
  ghost one cell (the camera keeps WASD); `R` rotates; `Enter` builds; `Esc` cancels; `Space` pauses. The whole first epoch can be played without a pointer (`e2e/a11y.spec.ts`).
- **Screen readers:** a polite live region announces each age, 30 s and 10 s left, each forecast warning, the collapse headline, the debrief and the verdict — never every tick;
  warnings are `role=alert`; the placement message states whether the site is valid and why not.
- **Motion:** the OS "reduce motion" preference is the default for the in-game setting; with it, the catastrophe card appears at once with the facts and the camera does not shake.
- **Audio:** procedural Web Audio (no sample files). Created only after a user gesture (one context per page), suspended while paused or hidden, with a master mute (HUD button and
  settings) and independent music/effects volumes. The graph, routing, mute and event→sound mapping are unit-tested with a recording fake; **how it sounds has not been judged by ear**.
