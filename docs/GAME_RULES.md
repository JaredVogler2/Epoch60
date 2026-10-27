# EPOCH — Game rules (quantitative source of truth)

Numbers for buildings, techs, traditions and epochs are **generated from the live content data** into
[`generated/CONTENT_TABLES.md`](generated/CONTENT_TABLES.md) (`npx vite-node scripts/gen-content-tables.ts`).
This file holds the formulas and flow that the tables plug into. If code and this file disagree, the code and its
tests win and this file is a bug.

Status: rules **v0.1.0** (`RULES_VERSION`), content **v0.1.0**. Implemented: the Greenvale 3-epoch slice engine.
Win/lose routes are **proposed until traced** (see `fixtures/`), not claimed.

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
| Archive     | `36 × staffing × (1000 + knowledgeRate + 400 Writing) × cond`                                                        |
| Hearth      | 10 knowledge/tick (storytelling)                                                                                     |

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
A dam cuts the peak to 62 % downstream (rows below it).

### Quake

Intensity at a cell = `strength × 46 / (46 + d²)` (d from the epicentre), ×0.7 on bedrock (rock cells), ×1.25 on soft floodplain (height < 0.85).

### Damage

`damage = exposure × (1000 − resistance) / 1000` (fire: share of footprint burned; flood: `min(1000, 12 × depth_cm) × share`; quake: peak intensity).
Resistance = building + reinforce bonus + traditions + techs (Seismic Engineering +25 % quake) + nearby Retaining Wall (+25 % quake) − state (damaged −15 %).
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
**traditions** (offered because of what just happened, plus Open Hands). Founders = `clamp(round(0.5 × spec.startPop + 0.7 × survivors) + tradition, 5, 16)`.
Starting resources = scenario base + tradition + excavated yield + 10 food from a surviving Seed Vault. Techs = retained + excavated.

## 9. Scoring and endings

Score (debrief): `people = 100 × survivors`, `livelihood = 2 × food made + 10 × buildings`, `knowledge = 120 × retained + 30 × researched`,
`ecology = (meanForest + meanFertility)/10`, `heritage = 150 × heritage structures standing`.

- **Defeat (any epoch):** fewer than 3 survivors — "no one is left to remember".
- **Greenvale victory (end of epoch 3):** survivors ≥ 8 **and** ≥ 1 heritage structure (Hearth, Archive, Seed Vault, Dam, Bridge) from an _earlier_ epoch still standing **and** ≥ 2 technologies carried through the final collapse.
- Otherwise defeat with the unmet conditions listed.

## 10. Status of designed-but-not-yet-live content

`Stone House`, `Levee`, `Dam`, `Bridge`, `Retaining Wall`, `Forge`, `Grove` and techs beyond Masonry/Irrigation/Writing exist as data with
`enabled: false`. They are **hidden from the catalog** until their gameplay is wired and tested (phases 08–11).
