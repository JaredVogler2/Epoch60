# Test results (executed evidence)

All commands run in this repository on Node 22.22 with the pinned dependency set. Nothing below is estimated. Numbers are from the end of session 3c
(source commit `d203d36` plus the Hard-route work in session 3d; the Playwright and perf rows were measured on `d203d36`, whose browser-facing code is unchanged since).

## Latest verified run

| Command                                                   | Result                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                       | clean (strict, `noUncheckedIndexedAccess`)                                                              |
| `npm run lint`                                            | 0 findings (engine forbids `Math.random`/`Date.now`/`performance.now`)                                  |
| `npm test` (Vitest)                                       | **20 files, 208 tests passed** (≈ 13 s)                                                                 |
| `npm run build`                                           | success (JS 447 kB + R3F/three chunk 924 kB; gzip 143 kB + 246 kB)                                      |
| `npx playwright test` (Chromium, SwiftShader software GL) | **44 passed, 2 skipped, 0 failed** in 10.9 min — 8 spec files × desktop 1366×768 and an iPhone-13 touch profile |
| `node scripts/perf-probe.mjs`                             | scene cost recorded in `docs/PERF.md` (software GL only: counts are real, frame rates are not)          |
| `npx vite-node scripts/sim.ts …`                          | 100 seeds × 7 policies on Greenvale/Normal (700 campaigns, 0 invariant violations, 0 soft-locks) plus 40-seed runs on Gentle, Hard and Ashen — `docs/BALANCE_REPORT.md`, `docs/balance/` |
| GitHub Actions CI (`typecheck → lint → test → build`)     | green on PR #3's merge commit `2db9d6d` (same source as `d203d36`): `verify` passed and the new Playwright job passed on GitHub's runner in ≈ 7 min (it is informational, `continue-on-error`) |

The two skipped Playwright cases are deliberately desktop-only: the keyboard-only first epoch (a hardware-keyboard path) and the hover-ghost invalid-placement test (hover is a desktop affordance).

### What the browser suite found this session (and what changed)

- The new mute button was **invisible on phones**: an old `nth-child(3)` rule meant to drop the Help button now hit it. Phones now hide Help and keep mute.
- The new Next-site button made the placement bar **182 px tall on a 390×664 screen, stacked under the Begin card, covering the valley**; three iPhone specs could not place a building. The bar is now one info row plus one button row (107 px at 390 px, 122 px at 320 px) and the Begin card steps aside while placing. Screenshots were inspected at 390×664 and 320×568.
- Earlier in the session: the story spec raced its own 15 s countdown under CPU load (screenshot removed), and the journey spec expected locked cards to be hidden rather than `aria-disabled`.

### Unit / engine tests (208)

- `core` PRNG determinism + frozen reference sequence, hashing. `world` generation: 300/300 seeds valid, river continuity, integer field ranges, plus a bulk sweep.
- `time` exactly 600 ticks (not 601); double Begin; pause; action at tick 599 accepted and after end rejected; phase machine; plan slots.
- `economy` placement legality + reason codes, locked items, cost paid once, failed action never charges, cancel-spam cannot farm; every building has a tested effect; `suggestSpots` candidates are legal, ordered and stable.
- `hazards` forecast ≡ resolution for all four disasters, firebreak/clearing/dam/levee/wall reduce damage, ash plume depth falls off downwind, roofs by age decide ash damage, famine is decided against the larder.
- `legacy` idempotent collapse, no resurrection, knowledge retention only through carriers, ruins/scars/pollution persist, seed vault, bounded archaeology, defeat, founding-site soft-lock regression (fails without the fix).
- `story` decisions arise from real state, ≤ 3 per epoch, defaults apply at the deadline, `choose` is validated and replayable.
- `routes` recorded executed traces replay hash-identical for Greenvale and Ashen; ablations show each winning route depends on its own mechanism; baselines lose.
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

## Not yet verified (honest list)

- **No WebKit/Safari run** (only Chromium is installed in this sandbox). `EPOCH_WEBKIT=1` enables the WebKit project when available.
- **No real-GPU or phone frame-rate measurement.** Software GL here cannot say anything about 60/30 FPS. Targets are unproven.
- **Visual quality judged only by me via software-GL screenshots** (`docs/review/`); no independent art review yet.
- **Audio has never been heard by a person**; the tests prove wiring and gesture rules, not taste.
- **Screen-reader behaviour is untested with a real screen reader**; the live-region content and ARIA structure are asserted, not their spoken output.
- No human playtest; 320 px landscape and very small phones have been inspected by screenshot only at 320×568 portrait.
- No automated visual-diff baseline.
