# Phase 13 — Make every lineage an interesting new puzzle

## Goal

Once the authored Greenvale three-epoch slice is genuinely fun, expand into an 8–12 epoch campaign, *meaningful* procedural world variation, seeded expeditions and a deterministic daily challenge. New starts must change decisions, not just colors, decorations or names.

## Modes

1. **Story of Greenvale:** approachable progressive campaign through 8+ active epochs with distinct events, age changes and at least one implemented cross-age ending. Narratively grounded history and return to exact world; optional continue after win for sandbox experimentation.
2. **Expeditions:** procedural world from seed, variable 6–12 epoch target, pre-selected challenges with specific lineages and viable crisis combinations. More diverse strategy than fixed story.
3. **Daily Ruins:** one reproducible UTC-date seed + pinned rules version/difficulty. Runs comparable locally; local best result, shareable URLs; no backend/global rankings required or fabricated score rank.
4. **Sandbox / Explorer:** optional untimed or assisted mode for relaxing exploration without comparable normal achievements. Great for iPhone practice but must still have functional construction/legacies.

## Procedural world generator constraints

Deterministically generate:
- River topology (crossing bottlenecks, forks, wetlands) and water supply.
- Elevation/biomes: fertile river plain, mineral upland, woodlands and defensible site.
- Landscape scars / ancient remnants for expedition variants if appropriate.
- Initial resources/population/season and early tech options.
- Primary/secondary catastrophe schedule with enough advance warning and 2+ counterplay opportunities.
- Deposit concentrations, distance/travel costs, varied build sites, resource asymmetry.
- Alternative founding cultures / legacies with mechanically distinct starting incentives.
- Scenario progression and endings with reachable prerequisite chains.

Validate logical constraints: at least one buildable home/farm site reachable, viable food/water/fuel loop, early defensive/legacy option, expected income sufficient for action costs, final projects possible under relevant track, disaster not unavoidable lethal before actions. Generate with seeded bounded retries and known-good fallback. Avoid making every world perfectly balanced—small risks and asymmetric resources create real decisions; impossible states do not.

## Modifiers that alter strategy

At least 12 meaningful modifier definitions, with actual simulation effects:
- Fertile valley, soft rock, dry plateau, steep ridges, isolated islands, storm front, ancient canal, buried library, rare ore, fractured fault, fungal blight, overcrowded refuge, recurring fire season, mineral-rich but polluted ground, strong cultural tradition.
Each modifier must change a world variable/action/goal and UI explanation. Mix 1–3 nonconflicting modifiers per expedition, use incompatibility rules, no trivial "every output +5%" filler.

## Replay and sharing

Seed is string/uint32 with rulesVersion, contentVersion, mode, difficulty and modifiers; use encoded compact validated URL. Same seed and actions yields same canonical historical timeline regardless of browser frame rate and quality. Store local run cards with ending, era history, score, dominant legacy, notable near-miss and same/new seed buttons. Preserve exact action logs for deterministic replay viewer if capacity permits; version old replays carefully.

Daily challenge uses UTC date until midnight UTC for challenge identity; continue existing run even if date rolls while playing. Validate URL/query lengths, no code execution from seed or user-supplied custom text. Never invent online leaderboard; if adding backend later, require account/security design.

## Campaign variety

Age progression with distinctive visual evolution and mechanical challenges. Add at least 4 catastrophe categories (fire/flood/quake/drought) implemented in engine and shown by real world visuals; late age threats may include pollution, solar storm, asteroid with actual counterplay. Allow recovery after mediocre epochs, long-term restoration projects, rare findings, failed preservation and alternate endings. Player must be able to see different inheritance timeline endings, not only cosmetic title banners.

## Procedural test harness

Generate 1000+ seeded candidate worlds:
- 0 invalid map topologies, 0 infinite loop/NaN, 0 unsolvable "no place to settle" seeds.
- Run bounded bot policies seeking at least one feasible win witness on normal difficulty or restrict served seeds to curated tested cohort. Do not advertise full mathematical solvability without proof.
- Content signature diversity measures: river/terrain topology, deposit scarcity, catastrophe schedule, modifiers, tech choices, first-epoch successful strategies and end states.
- Same seed/action log gives same world and score across 10 repetitions.
- Changing seed changes at least some strategic variables on majority of sampled pairs; changing player action on same seed visibly changes afterlife.
- Check generated 8+ epoch run actually reaches completed ending, no state explosion or memory leak.
- Daily selection/reload/share/restart E2E on desktop and phone.

## Completion

At least a complete 8-epoch playable campaign and an expedition/daily seed mode with bounded validated starts, alternate actual physical legacies, several rendered eras and working replay/local saves. Report real seed-validation statistics and any unknown solvability rates. Commit content and tests.