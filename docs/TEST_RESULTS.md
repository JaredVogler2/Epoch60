# Test results (executed evidence)

All commands run in this repository on Node 22.22 with the pinned dependency set. Nothing below is estimated. Numbers are from session 5
(rules 0.4.0: an Archive is no longer a landmark) unless a row says otherwise; the source is the working tree committed right after these runs.

## Latest verified run

| Command                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                       | clean (strict, `noUncheckedIndexedAccess`)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run lint`                                            | 0 findings (engine forbids `Math.random`/`Date.now`/`performance.now`)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm test` (Vitest)                                       | **25 files, 251 tests passed**                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run build`                                           | success (JS 490 kB + R3F/three chunk 924 kB; gzip 158 kB + 246 kB)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npx playwright test` (Chromium, SwiftShader software GL) | session 5, on the rules 0.4.0 build: the campaign specs (now reading the victory goals and the live landmark count) and the four browser victory replays on both profiles, **14 passed** (7.0 min); the campaign specs again after the founding-site tags, **6 passed**. Session 4, after visual iteration 3 and the first hover version: the full suite, **57 passed, 3 skipped, 0 failed** (18.2 min); then the hover, journey and layout specs on the final session-4 build, all passed |
| mutation checks                                           | the K-003 tests **fail** when the Archive is made a landmark again; the hover test fails with the camera re-pick removed and with the throttle's trailing pick removed (session 4)                                                                                                                                                                                                                                                                                                         |
| `npx vite-node scripts/sim.ts`                            | rules 0.4.0 at `3ee40b8`: Greenvale/Normal 100 seeds × 7 policies (Engineers 98, Archivists 100, steward 7, other baselines 0) and 40 seeds on Gentle, Hard and both Ashen tiers — 0 invariant violations, 0 soft-locks; results in `docs/BALANCE_REPORT.md` and `docs/balance/`                                                                                                                                                                                                           |
| `npx vite-node scripts/recipes.ts`                        | seeds 1–40 on Normal: one Archive alone 0/40 on Greenvale and on The Ashen Winter; with a Seed Vault 40/40 and 7/40; with a hearth founded above the flood and kept 27/40 and 0/40                                                                                                                                                                                                                                                                                                         |
| `npx vite-node scripts/record-traces.ts`                  | all eight transcripts re-recorded under rules 0.4.0 and re-read: Engineers and Archivists still win seed 6001 on both scenarios (the Engineers now through a hearth refounded above the flood), every losing policy still loses (`fixtures/greenvale-traces.md`)                                                                                                                                                                                                                           |

The three skipped Playwright cases are deliberately desktop-only: the keyboard-only first epoch (a hardware-keyboard path), the hover-ghost invalid-placement test and the building hover highlight (hover is a mouse affordance).

### What session 5 measured before changing a rule

- The one-Archive policy's 40/40 on Greenvale/Normal was re-run and confirmed. Candidate rules were then scored on the final states of nine
  policies (both routes, three baselines, two minimal recipes, random, no action) × 40 seeds × 2 scenarios: "the landmark must not be an
  Archive" dropped the minimal recipe to 0/40 while the Archivists kept 40/40; "two landmarks of any kind" would also have dropped it but
  lets a second Archive answer it, the same single building again.
- The Engineers kept their ancestral hearth on only 13 of 40 seeds: the flood leaves it at exactly `1000 − resistance` damage in deep water
  and centuries of decay finish it. Reinforcing it was not enough (a reinforcement replaces the sandbag bonus rather than adding to it); a
  Dam was too expensive in the second age and fell to the quake; refounding above the flood and keeping that hearth worked on 39/40.

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

### Unit / engine tests (251)

- `core` PRNG determinism + frozen reference sequence, hashing. `world` generation: 300/300 seeds valid, river continuity, integer field ranges, plus a bulk sweep.
- `time` exactly 600 ticks (not 601); double Begin; pause; action at tick 599 accepted and after end rejected; phase machine; plan slots.
- `economy` placement legality + reason codes, locked items, cost paid once, failed action never charges, cancel-spam cannot farm; every building has a tested effect; `suggestSpots` candidates are legal, ordered and stable.
- `hazards` forecast ≡ resolution for fire and ash, and (`effects`) for flood and quake including struck buildings and deaths, firebreak/clearing/dam/levee/wall reduce damage, ash plume depth falls off downwind, roofs by age decide ash damage, famine is decided against the larder.
- `legacy` idempotent collapse, no resurrection, knowledge retention only through carriers, ruins/scars/pollution persist, seed vault, bounded archaeology, defeat, founding-site soft-lock regression (fails without the fix).
- `story` decisions arise from real state, ≤ 3 per epoch, defaults apply at the deadline, `choose` is validated and replayable.
- `routes` recorded executed traces replay hash-identical for Greenvale and Ashen; on seed 6001 each winning route loses without its key mechanism (ablations: Seismic Engineering, the Archive, research, the Seed Vault, refounding above the flood); baselines lose; one well-sited Archive with nothing else that lasts loses on four seeds and adding one landmark wins (K-003).
- `difficulty` tiers change strength and requirements through one function, and on Hard both Greenvale routes win by different mechanisms (a hearth held above the flood vs a Seed Vault; without Open Hands after the flood the Engineers end one survivor short); `experiments` are the eight paired strategic comparisons (prompt 15 A–H); `fuzz` runs chaotic actions over 30 seeds with the invariant checker; exploit probes (cancel/demolish/repair loops, save-reload, acting on the last tick).
- `replay` same seed + actions ⇒ same hash; save/load at tick 1/300/599; tamper/schema rejection.
- `game` clock (exactly 600 ticks at any frame rate, hidden/paused freezes, stalls pause), audio mapping and gesture unlock, DPR governor, modes (seed/link validation, hostile input, Daily Ruins by UTC date, run cards).

### Browser E2E (Playwright) — real pointer/touch/keyboard paths

- Title → New Lineage → plan three orders by **projecting real 3D positions and clicking/tapping** → Begin → costs paid once → clock → pause → collapse → debrief → interregnum → next age → ending → Play again. The planning card states the victory conditions, and after founding elsewhere it counts no landmark left standing.
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
