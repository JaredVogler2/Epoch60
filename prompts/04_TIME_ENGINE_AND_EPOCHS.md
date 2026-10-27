# Phase 04 — Implement the 60-second time engine and reliable epoch state machine

## Nonnegotiable timing

Each civilization's ACTIVE phase is exactly 60.0 simulation seconds, e.g. 600 fixed 100ms ticks. Between eras, pre-planning and debrief have **no timer**. Only foreground unpaused play advances. Tab hidden / app switched / iPhone locked must freeze; restoring does not simulate missing wall time or fast-forward. A user who receives a phone call must NOT lose a civilization. The timer is always clear in game. Default controls and 1x simulation speed should feel energetic without frantic precision input.

Use one authoritative tick counter; render frames never own simulation time. Browser controller uses RAF delta accumulator to advance discrete ticks; if device stalls and cannot catch up in controlled bounded interval, auto-pause with explanation rather than uncontrolled runaway catch-up. Clock pause/resume and saved tick must be exact. Do not use setInterval to mutate resources, or Math.random / Date.now in sim.

## State machine

PREPARE → ACTIVE → COLLAPSE_PENDING → COLLAPSING_PRESENTATION → DEBRIEF → INTERREGNUM → PREPARE; terminal VICTORY/DEFEAT variants. Paused is an orthogonal mode or explicit state. Only state machine authorizes actions; no build after collapse, no double-start or double-advance. The catastrophe's *game state effects* are computed once from authoritative snapshot; cinematic is read-only presentation and skippable, including after refresh.

## Tick order (specify and freeze in docs)

1. Accept tick-stamped queued actions in sequence, validate and pay costs once.
2. Assign workforce and transport capacity.
3. Process construction queues/repairs.
4. Produce/extract/consume material resources.
5. Consume upkeep/food; resolve health/morale and migration.
6. Progress research and unlock technology.
7. Advance natural systems (soil, pollution, vegetation, water, finite deposits).
8. Advance ongoing hazard and mitigation models.
9. Resolve simplified NPC settlement activity/path occupancy.
10. Update objective progress and emit causal events.
11. Check terminal conditions, tick count and disaster triggers.
Never change order casually; regressions freeze expected state hashes.

## Player interaction and physical time

Tapping build card immediately shows world-space ghost, radius of influence, cost and invalid reasons. Confirm pays cost at next tick; build progress occurs over actual simulation ticks, structure activates on completion. UI response on input should feel immediate even while authoritative mutation queues; no fake resource subtraction that may not be accepted. Queue length bounded; each queue has clearly communicated progress; cancellation refunds proportional to unspent input with caps.

Forecast major collapse 25s before, escalate warning at 15s and 5s, include visual weather/environment response; do not reveal random untelegraphed apocalypse. "Begin Epoch" starts active clock after intro; if game auto-pauses for tutorial overlays, this must not be exploitable in score categories. Optional half-speed and tactical pause accessibility flags tagged into final score, still mathematically same 60 simulation seconds.

## Inheritance handoff

On the last tick: freeze construction and current economy → compute cataclysm damage/fatalities/effects/ruins deterministically → calculate legacy state and decay across documented years → create CollapseReport + interregnum preview. Never allow animation skipping to skip damage or double apply. Founding next generation commits exact starting location/cultural orientation/recovery choices and resets *epoch-specific* resources/timer, NOT global world state.

## Save and replay

Versioned save includes tick, seeded PRNG state/substreams, queued actions, state machine phase, map lineage, current epoch, renderer independent world data, rules version and action log. Replay transcript has tick, action sequence and seed to recover deterministic final world hash. On reload in ACTIVE, resume **paused** and prompt user, not automatically drain time. Offline simulator can run 600 ticks instantly for tests without fake wait.

## Stress and exploit tests

- Exactly 600 ticks per standard epoch, zero extra on repeated end or refresh.
- Same timestamped actions under simulated 30, 60 and 120 FPS → identical engine hash.
- Pause/tab hidden 10min → no state/time mutation; resume works.
- Double click Begin/End cannot consume extra epoch or duplicate disaster.
- Save/load at tick 1, 300, 599 → same final outcome.
- Action at 599 accepted according to explicit cutoff and never post-end.
- Settings/modal/touch orientation never inadvertently advance time.
- Negative delta/giant RAF elapsed times clamp safely.
- Failed action doesn't charge, cancellation cannot farm materials.
- Story debrief and interregnum remain paused indefinitely.

## Gate

A player can start a real 60s civilization, build and create resources, witness forecast, suffer a simulated catastrophe, inspect a causally valid aftermath and begin epoch two. Timer works correctly on mobile-like backgrounding and render performance does not change outcomes. Tests and actual browser run evidence logged.