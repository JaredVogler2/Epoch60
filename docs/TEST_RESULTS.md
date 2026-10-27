# Test results (executed evidence)

All commands run in this repository on Node 22.22 with the pinned dependency set. Nothing below is estimated. Numbers are from session 4
(the 3D visual overhaul and the second review's fixes); the source is the working tree committed right after these runs.

## Latest verified run

| Command                                                   | Result                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                       | clean (strict, `noUncheckedIndexedAccess`)                                                                                                                                                                                                                  |
| `npm run lint`                                            | 0 findings (engine forbids `Math.random`/`Date.now`/`performance.now`)                                                                                                                                                                                      |
| `npm test` (Vitest)                                       | **25 files, 247 tests passed**                                                                                                                                                                                                                              |
| `npm run build`                                           | success (JS 489 kB + R3F/three chunk 924 kB; gzip 158 kB + 246 kB)                                                                                                                                                                                          |
| `npx playwright test` (Chromium, SwiftShader software GL) | full suite after visual iteration 3 and the first hover version: **57 passed, 3 skipped, 0 failed** (18.2 min); then on the final build (hover outline, trailing pick, camera re-pick) the hover, journey and layout specs on both profiles: **all passed** |
| hover mutation checks                                     | the hover test **fails** with the camera re-pick removed (the highlight stays on the hearth after a pan) and with the throttle's trailing pick removed (the last steps onto the hearth are dropped)                                                         |
| `npx vite-node scripts/sim.ts`                            | rules 0.3.0: Greenvale/Normal 100 seeds × 7 policies and 40 seeds on Gentle, Hard and Ashen — 0 invariant violations, 0 soft-locks; results in `docs/BALANCE_REPORT.md` and `docs/balance/`                                                                 |
| `npx vite-node scripts/record-traces.ts`                  | all eight transcripts re-recorded under rules 0.3.0 and re-read: every verdict unchanged (`fixtures/greenvale-traces.md`)                                                                                                                                   |

The three skipped Playwright cases are deliberately desktop-only: the keyboard-only first epoch (a hardware-keyboard path), the hover-ghost invalid-placement test and the building hover highlight (hover is a mouse affordance).

### What the checks found after iteration 3

- The full suite found nothing new. The hover highlight was then inspected in captures (`docs/3D_QUALITY_REPORT.md`): too faint on pale
  stone, washed out on a red roof; it became an outline plus a multiplied brightening. Reading the hover code found that the 50 ms
  throttle dropped the last pointer move (a highlight could stay on a building the mouse had left) and that a camera moving under a
  resting mouse never re-picked; both fixed, and the browser test now covers them.
- A first mutation run of that test passed even with the camera re-pick removed. Playwright reuses any server already listening on port
  4173 (`reuseExistingServer`), so it most likely tested a stale build; against a preview server started on the mutated build it failed
  as it should. Mutation checks now start their own server.

### What the browser suite found in session 4

- "Reloading mid-epoch…" timed out clicking the HUD's Pause: the epoch had already paused itself as **stalled**. Under software GL the
  frame after a 314-tick `fastForward` can take longer than the 2.5 s stall guard (K-011). The test now pauses through the store; the
  test-only `fastForward` also marks its synchronous jump like a begin/resume. The new context-loss test resumes the epoch right before
  dropping the context for the same reason. The stall guard itself is unchanged.

### What the browser suite found in session 3d

- The new mute button was **invisible on phones**: an old `nth-child(3)` rule meant to drop the Help button now hit it. Phones now hide Help and keep mute.
- The new Next-site button made the placement bar **182 px tall on a 390×664 screen, stacked under the Begin card, covering the valley**; three iPhone specs could not place a building. The bar is now one info row plus one button row (107 px at 390 px, 122 px at 320 px) and the Begin card steps aside while placing. Screenshots were inspected at 390×664 and 320×568.
- Earlier in the session: the story spec raced its own 15 s countdown under CPU load (screenshot removed), and the journey spec expected locked cards to be hidden rather than `aria-disabled`.

### Unit / engine tests (247)

- `core` PRNG determinism + frozen reference sequence, hashing. `world` generation: 300/300 seeds valid, river continuity, integer field ranges, plus a bulk sweep.
- `time` exactly 600 ticks (not 601); double Begin; pause; action at tick 599 accepted and after end rejected; phase machine; plan slots.
- `economy` placement legality + reason codes, locked items, cost paid once, failed action never charges, cancel-spam cannot farm; every building has a tested effect; `suggestSpots` candidates are legal, ordered and stable.
- `hazards` forecast ≡ resolution for fire and ash, and (`effects`) for flood and quake including struck buildings and deaths, firebreak/clearing/dam/levee/wall reduce damage, ash plume depth falls off downwind, roofs by age decide ash damage, famine is decided against the larder.
- `legacy` idempotent collapse, no resurrection, knowledge retention only through carriers, ruins/scars/pollution persist, seed vault, bounded archaeology, defeat, founding-site soft-lock regression (fails without the fix).
- `story` decisions arise from real state, ≤ 3 per epoch, defaults apply at the deadline, `choose` is validated and replayable.
- `routes` recorded executed traces replay hash-identical for Greenvale and Ashen; on seed 6001 each winning route loses without its key mechanism (ablations); baselines lose. (On Normal a well-sited Archive alone is enough — K-003.)
- `difficulty` tiers change strength and requirements through one function, and on Hard both Greenvale routes win by different mechanisms (second Archive vs Seed Vault; fails if the Hard Engineers plan is removed); `experiments` are the eight paired strategic comparisons (prompt 15 A–H); `fuzz` runs chaotic actions over 30 seeds with the invariant checker; exploit probes (cancel/demolish/repair loops, save-reload, acting on the last tick).
- `replay` same seed + actions ⇒ same hash; save/load at tick 1/300/599; tamper/schema rejection.
- `game` clock (exactly 600 ticks at any frame rate, hidden/paused freezes, stalls pause), audio mapping and gesture unlock, DPR governor, modes (seed/link validation, hostile input, Daily Ruins by UTC date, run cards).

### Browser E2E (Playwright) — real pointer/touch/keyboard paths

- Title → New Lineage → plan three orders by **projecting real 3D positions and clicking/tapping** → Begin → costs paid once → clock → pause → collapse → debrief → interregnum → next age → ending → Play again.
- **Keyboard-only**: a complete first epoch with Tab/Enter/N/arrow keys (desktop).
- Inheritance, persistence (hidden tab freezes the clock; reload resumes paused at the exact tick), no duplicate canvases.
- Story decision answered with a tap and left to its free default; second scenario (Ashen Winter) starts from the title.
- **Four replays in the browser** (Greenvale and Ashen × Engineers and Archivists) reach the victory screen with the hash recorded in `fixtures/`.
- Audio: nothing starts before a gesture, exactly one `AudioContext`, mute persists across reload, separate music/effects volume.
- Modes: share links pre-select valley/scenario/difficulty, hostile or malformed links are ignored, any words give a stable seed, Daily Ruins and local run cards.
- Reduced motion: honoured from the OS by default; the catastrophe card appears at once with the facts kept.
- Graphics: a lost WebGL context pauses the epoch and the valley is redrawn when it returns.
- Hover (desktop): the building under the mouse is highlighted with a pointer cursor, the highlight follows the camera under a resting mouse, and it never stays behind.

## Not yet verified (honest list)

- **No WebKit/Safari run** (only Chromium is installed in this sandbox). `EPOCH_WEBKIT=1` enables the WebKit project when available.
- **No real-GPU or phone frame-rate measurement.** Software GL here cannot say anything about 60/30 FPS. Targets are unproven.
- **Visual quality judged only by me via software-GL screenshots** (`docs/review/`); no independent art review yet.
- **Audio has never been heard by a person**; the tests prove wiring and gesture rules, not taste.
- **Screen-reader behaviour is untested with a real screen reader**; the live-region content and ARIA structure are asserted, not their spoken output.
- No human playtest. Phones were inspected by screenshot (390×844, 393×852, 360×740, 844×390, 667×375, 320×568) and measured for touch targets with an emulated coarse pointer, never used by hand.
- No automated visual-diff baseline.
