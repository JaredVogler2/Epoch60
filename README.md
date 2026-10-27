# EPOCH: The 60-Second Civilization

**One minute to build. Centuries to inherit. Infinite ways to change history.**

This repository is currently a **Claude Code Opus 5.5 Max implementation specification**, not a completed game. It contains executable, sequenced prompts to create a beautiful and genuinely playable 3D desktop/iPhone browser strategy roguelite in which **every 60-second civilization changes the same persistent world**.

## Begin implementation

**Start:** [prompts/README.md](prompts/README.md)  
**Master goal:** [prompts/00_MASTER_GOAL.md](prompts/00_MASTER_GOAL.md)  
**Game rules:** [prompts/01_GAME_DESIGN_BIBLE.md](prompts/01_GAME_DESIGN_AND_CORE_LOOP.md)

In Claude Code, open this repo and paste:

~~~text
/goal Read prompts/README.md and prompts/00_MASTER_GOAL.md. Execute numbered phases 01–19 in order, implementing, testing and committing a genuinely playable and gorgeous real-time 3D browser game, EPOCH: The 60-Second Civilization. Maintain a playable vertical slice from the earliest phases. Use Three.js/React Three Fiber, a deterministic headless game engine, responsive mobile-first interaction, and a coherent premium miniature-diorama visual style. A run lasts exactly 60 seconds of active simulated play. When it ends, centuries pass and the next civilization inherits the buildings, damage, ecology, ruins, technology and cultural consequences. Ship proven survival/progression and rich replayability, not a screenshot, prototype dashboard or boxes on green tiles. Create evidence-backed tests and screenshots at each stage. Continue autonomously, recording truthful progress and commits, and never silently replace quality with placeholders.
~~~

## Creative contract

- A complete **60-second real-time civilization** session from title to collapse/legacy/debrief/next civilization.
- A persistent evolving landscape with authored physical inheritance, excavatable ruins, environmental degradation/recovery and strategic intergenerational planning.
- Active, readable placement, resource balancing, research, infrastructure and crisis management with consequential tradeoffs.
- Distinct cultural/technological epochs, alternate victory routes, fail-forward progress and meaningful replay seeds.
- Premium interactive 3D storybook/miniature world: sculpted terrain, animated water, detailed buildings, moving citizens, forests, light, weather, construction, ruin and archaeology, orbit/pan/zoom.
- Smooth, accessible UI/UX for desktop mouse/keyboard and portrait iPhone touch; clear 60-second clock and optional pause/accessibility settings.
- Pure deterministic simulation; real-time graphics interpolation independent of authoritative ticks; offline local saves for standard single-player.
- No mandatory paid LLM API, login, DB, cloud simulation or paid asset pack. Deployable to Vercel.
- Real verification: timed runs, inheritance assertions, seeded strategy/balance tournaments, Playwright mobile/desktop flows and browser-captured visual QA.

## Critical distinction

This is not a four-minute building game accelerated into a timer. **The one-minute boundary creates the strategy**: what you erect, neglect, repair, protect, invent, pollute, teach or bury will shape the next age. A sacrifice that loses this era can create the winning opening centuries later.

## Status

- [x] Implementation prompt program initiated.
- [ ] Executable game implemented by Claude Code.
- [ ] First complete 60-second civilization playtested.
- [ ] 3D art quality acceptance passed.
- [ ] Deterministic multi-epoch inheritance verified.
- [ ] iPhone and desktop end-to-end tests passed.
- [ ] Live deployment verified.

**Do not represent this document as a shipped game.**
## Additional binding quality and continuation instructions

- [Premium 3D and 60-second fun acceptance matrix](prompts/QUALITY_GATE_VISUAL_AND_FUN.md)
- [Agent context reset and verified-commit protocol](prompts/AGENT_RESUME_AND_EVIDENCE_PROTOCOL.md)

Execute these alongside each relevant phase. In particular, a green-grid, cubes-only, image-only or dashboard-led game is a **visual acceptance failure** even if unit tests pass.
