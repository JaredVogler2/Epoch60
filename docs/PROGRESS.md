# PROGRESS

Status vocabulary: NOT STARTED · IN PROGRESS · IMPLEMENTED UNVERIFIED · VERIFIED · BLOCKED · REOPENED.
Only claim VERIFIED with executed evidence recorded below.

| Phase                          | Status                                                                                                            | Evidence                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 01 Design bible / rules        | IMPLEMENTED (rules + content executable); route fixtures PROPOSED                                                 | `docs/GAME_RULES.md`, `CONTENT_SPEC.md`, generated tables, `fixtures/greenvale-traces.md` |
| 02 Economy, actions, tech      | VERIFIED for the implemented subset (9 enabled buildings, 3 techs)                                                | `tests/engine/{economy,hazards,legacy}.test.ts`                                           |
| 03 Architecture / app scaffold | IN PROGRESS: entry point + title screen build; runtime layer (store/clock/persistence) VERIFIED; 3D scene not yet | `tests/game/clock.test.ts`, `npm run build`                                               |
| 04 Time engine / epochs        | Engine side VERIFIED (600 ticks, pause, save/load 1/300/599, replay hash); browser controller NOT STARTED         | `tests/engine/{time,replay}.test.ts`                                                      |
| 05–19                          | NOT STARTED                                                                                                       | —                                                                                         |

## Log

### Session 1 — Engine foundation (phases 01, 02, engine half of 04)

Branch `claude/determined-wright-c0aptv`. Repo previously contained only prompts.

**Built:** Vite/React/TS-strict toolchain (pinned: React 19.3.1, three 0.186.1, R3F 9.8.2 (stable; 10 is alpha), drei 10.7.9, Vite 8.3.5,
Vitest 5.0.5, TypeScript 6.0.3 (7.x unsupported by typescript-eslint), Playwright 1.63.0 to match the preinstalled Chromium).
Deterministic engine: seeded valley generator with validity gate (300/300 seeds valid), economy tick, labor, placement, three physical hazards
(fire/flood/quake) shared by forecast and resolution, idempotent collapse, knowledge retention via archives, time-skip + bounded archaeology + founding,
integrity-checked saves, replay transcripts, bot framework.

**Commands run (all green at end of session):**

- `npx tsc --noEmit` → clean
- `npx eslint .` → clean
- `npx vitest run` → 7 files, 70 tests passed
- `npx vite-node scripts/campaign.ts 6001` → full 3-epoch bot campaign in ≈3.7 s (reaches a verdict; the _scripted bot loses on the victory conditions_, as expected for an untuned baseline)

**Bugs found by tests and fixed:** replay desync (non-timed actions logged with tick 0, so replays never ran the epoch out); quadratic reachability BFS made bot scans take minutes (now cached).

**CI incident (found by the PR checks, fixed):** the first push failed `npm run build` — `index.html` referenced `/src/main.tsx`, which did not exist yet.
I had verified typecheck/lint/test locally but not `build`, and one local check chain used `| tail`, which hides failures. Fixed by adding the real entry
point. **Rule from now on:** before every push run exactly `npm run typecheck && npm run lint && npm test && npm run build` with no pipes, and only then push.

**Not done / honest gaps:** no browser app yet; no 3D; no UI; Stone House/Levee/Dam/Bridge/Retaining Wall/Forge/Grove and later techs are data only
(`enabled:false`); no winning trace exists yet (fixtures are proposed); balance untuned (hazards are currently easy for a bot that sites buildings out of the forecast footprint).
