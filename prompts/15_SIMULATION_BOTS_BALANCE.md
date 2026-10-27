# Phase 15 — Simulation tournaments, strategic balance, exploit detection and fun validation

## Goal

Do not claim "addictive and replayable" because the game contains a timer and procedural seeds. **Prove that the player can master the system, that actions matter across epochs, and that multiple strategies work**. Automated bot data quantifies balance and viability; human fun remains subjective until actual human playtests are observed.

## Headless simulation harness

Implement CLI npm run test:sim -- --mode story --seeds 1000 --policy all --report docs/BALANCE_REPORT.md (adapt arguments as appropriate). It must run 60-second epochs without real wall-clock delay using the **same engine public action API** as human play. Record JSON/CSV summary and representative reproducible action traces:
- seed, scenario, rules/content versions, build commit hash, difficulty, policy and tick-stamped inputs;
- alive population/health/food/output across ticks, resource scarcity windows and construction counts;
- epoch count, catastrophe severity/damage, preserved ruins, archaeology used, technologies retained;
- final victory/defeat, score categories, generation time, CPU time and errors/softlocks;
- biome degradation/recovery, legacy survival, exploited interactions, project/ending diversity.

Don't write invented statistics into docs. Actual sample size and test version must appear in report.

## Required bot policies

1. **No-op:** ignore decisions; baseline. Typically should lose normal run.
2. **Random legal:** affordable random construction and research; should not beat thoughtful policies overall.
3. **Current-age maximizer:** rush farms, workshops, houses and immediate production while ignoring legacy.
4. **Archivist:** preserve knowledge via archives/vaults, delayed payoff, trades short-term resources.
5. **Steward:** invest in soil/forest/water/seed legacy, preserve ecosystems and dispersed safe housing.
6. **Engineer:** site defenses/stone structures/dams/infrastructure strategically based on known hazard forecast.
7. **Long-horizon planner:** limited horizon heuristic/beam search across likely apocalypse and next few epochs; cap action sampling and runtime, use only information player has.
8. **Exploit adversary:** repeated salvage/repair/cancel/undo/pause/reload actions designed to defeat constraints.

Policies choose same legal actions and have same Influence/resources/clock as human, not direct state manipulation. Distinguish omniscient solver, if created to establish solvability, from fair play agent. Implement batch paired-seed comparisons with same geography/hazards across different policies.

## Metrics that reveal gameplay quality

- Win rate for multiple strategies vs no-op/random by scenario/seed/difficulty.
- Mean, median and distribution of meaningful actions in each 60s epoch (aim roughly 6–15, revise based on human trials).
- Number of actual constrained decisions, excluding repeated no-op clicks.
- First visible reward time, time to first structure, time with no useful action.
- Number of epochs where last 10 seconds offer at least 2 viable materially different preservation choices.
- Number of distinct preserved physical/ecological/knowledge/cultural legacies that actually change NEXT epoch production or build options.
- Ruin discovery and exploitation rates; what fraction of inherited effects appear only as a UI bonus and never affect world?
- Expected future return of expensive legacy investments vs greedy immediate expansion.
- Endgame and technology diversity, not just single dominant "Archive → Win" route.
- Outcome sensitivity: same seed + two different rational plans should yield distinct map state and score.
- Threat visibility/fairness, number of early irreversible softlocks, catastrophic surprises before warnings.
- Time-to-debrief UI overhead, phone action friction and live simulation step timing.
- Procedural map generation rejection/validation, false positives for solvability and difficulty variance.

## Paired strategic experiments

Create controlled tests:
A. Build archive epoch1 vs same amount spent on farms → epoch1 economy differs, epoch2 available tech differs, eventual win frontier changes.
B. Clear forest vs reforest → epoch1 timber increases, later flood/fire vulnerability changes; score vs population tradeoff.
C. Reinforce dam vs cheap homes → immediate houses vs future reservoir and breach effects.
D. Salvage ancient bridge vs restore → resource windfall vs future travel connectivity/engineering opportunity.
E. Build farm highland vs floodplain → output vs flood risk; each better in certain geography.
F. Choose tech branching industry vs ecological restoration → late-era form and catastrophe resistance differ.
G. Use normal 1x vs Assisted half-speed with same tick-scheduled actions → same canonical gameplay result; scores categorized separately.
H. Vary FPS/graphics quality → exact same simulation state and hash.

Use these as permanent regression tests after balance changes.

## Exploit probes (must be automated)

No resource duplication via cancelling plans, save/reload, collapsing twice, entering new civilization twice, salvaging one ruin repeatedly, upgrading ghost structure, resuming while page hidden, switching quality tier, undo after production, construction completion at last tick, replay race conditions, tech rediscovery loop, high-value infinite crop/energy production. Random-legal fuzz tests should never crash or softlock or produce NaN/infinite/negative resources.

## Iteration

Run 1000+ valid generated seeds, record results; if generation too slow, run CI subset and full offline benchmark with actual sample counts. Locate top 5 issues (dominant strategy, useless tech, boring era, catastrophic unfairness, UI timing barrier), rank by real observed cost. Fix top 3, re-run paired seeds, confirm no regressions. Don't balance exclusively for superhuman bots: single-step decisions must remain understandable for human phone users.

## Human trial protocol

When actual humans can test, observe uncoached users on phone and desktop: can they act within 15s, do they understand what legacy carried forward, do they feel unfairly punished by timer, do they spontaneously want to try a different preservation strategy? Record actual observations, confusion points and game session length; do not invent testers. If only automated tests were performed, mark subjective fun UNVERIFIED.

## Gate

No-op/random significantly weaker than at least 2 rational approaches on validated authored seeds, 2 mechanical 3-epoch winning traces and a credible loss, one complete 8+ epoch win trace, effects of heritage/placement measurable and visible, stable replay, no critical exploit. Write docs/BALANCE_REPORT.md and docs/PLAYTEST_LOG.md with actual results and uncertainty, commit tests and corrective changes. A game that only offers random seeds without meaningful strategic divergence FAILS.