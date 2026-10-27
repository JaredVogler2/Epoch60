# Content schema (content v0.2.0)

All content is typed TypeScript data validated by the compiler and by tests; there are no scattered magic numbers.

| File                               | Schema                                                                         | Purpose                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/content/buildings.ts`  | `BuildingDef`                                                                  | Footprint, age/tech gates, cost, build work, workers, output, upkeep, housing, slope/water/deposit rules, material, per-hazard resistance, fuel, heritage, archive capacity, refund/salvage, decay. `enabled:false` hides prototypes. |
| `src/engine/content/techs.ts`      | `TechDef`                                                                      | Branch, knowledge cost, research ticks, prerequisites, unlock summary, `enabled`.                                                                                                                                                     |
| `src/engine/content/traditions.ts` | `TraditionDef`, `Modifiers`                                                    | Additive permille modifiers with explicit upside **and** downside text.                                                                                                                                                               |
| `src/engine/content/scenario.ts`   | `ScenarioSpec`, `EpochSpec`, `HazardSpec`                                      | Epochs: age, hazard + three escalating warning lines, scarcity, starting stores, years to the next epoch, victory thresholds.                                                                                                         |
| `src/engine/core/types.ts`         | `World`, `Structure`, `Civ`, `Lineage`, `Campaign`, `Action`, `CollapseReport` | Runtime state; every field JSON-serializable.                                                                                                                                                                                         |

## Units

- Resources: fixed-point, `UNIT = 1000`. Authored costs are whole units; rates are milli-units per tick.
- Time: ticks (100 ms). Research `ticks`, build work in builder-ticks.
- Fields (fertility, forest, scar, silt, erosion, pollution): integers 0..1000. Height: 1/100 cell. Rock: whole stone units.
- Resistance: permille 0..1000 (clamped to 980 in play).

## Adding content

1. Add the def; set `enabled:false` until it functions and is tested.
2. Add tests proving its rule (placement, production, hazard interaction, inheritance).
3. Run `npx vite-node scripts/gen-content-tables.ts`; update GAME_RULES.md formulas if a new rule type was introduced.
4. Bump `CONTENT_VERSION` if saves/replays would change meaning.

## Scenario fixtures

`fixtures/greenvale-traces.md` records the **executed** winning and losing routes for both scenarios. Each transcript in
`fixtures/greenvale/` and `fixtures/ashen/` is replayed by `tests/engine/routes.test.ts` and, for the winning routes, in the
browser by `e2e/victory.spec.ts`; any rules or content change that alters an outcome fails those tests until the traces are
re-recorded (`npx vite-node scripts/record-traces.ts`) and re-read.
