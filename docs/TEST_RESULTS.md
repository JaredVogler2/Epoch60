# Test results (executed evidence)

All commands run in this repository on Node 22.22 with the pinned dependency set. Nothing below is estimated.

## Latest verified run (end of session 2)

| Command                                                   | Result                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run typecheck`                                       | clean (strict, `noUncheckedIndexedAccess`)                                      |
| `npm run lint`                                            | 0 findings (engine forbids `Math.random`/`Date.now`/`performance.now`)          |
| `npm test` (Vitest)                                       | **8 files, 82 tests passed**                                                    |
| `npm run build`                                           | success (JS 383 kB + R3F/three chunk 924 kB; gzip 122 kB + 246 kB)              |
| `npx playwright test` (Chromium, SwiftShader software GL) | **13 passed, 1 skipped** (desktop 1366×768 and iPhone-13 touch profile)         |
| GitHub Actions CI (`typecheck → lint → test → build`)     | green on the fix commit `51acc7a` (the first push failed `build`; see PROGRESS) |

### Unit / engine tests (82)

- `core` PRNG determinism + frozen reference sequence, hashing.
- `world` generation: 300/300 seeds valid; river continuity; integer field ranges.
- `time` exactly 600 ticks (not 601); double Begin; pause; action at tick 599 accepted and after end rejected; phase machine; plan slots.
- `economy` placement legality + reason codes, locked items, ford/river reachability, cost paid once, failed action never charges, cancel-spam cannot farm, farms/lumber/quarry/archive/workshop/vault function, research.
- `hazards` forecast ≡ resolution, firebreak/forest-clearing/dam reduce damage, deforestation raises flood, thatch burns/stone survives, 25/15/5 s warnings.
- `legacy` idempotent collapse, no resurrection, knowledge retention only through carriers, archive tablets survive in ruins and can be excavated, scars/ruins/terrain persist into epoch 2, regrowth, seed vault, bounded archaeology, defeat.
- `replay` same seed + actions ⇒ same hash; 3-epoch bot campaign bit-for-bit reproducible; save/load at tick 1/300/599 ⇒ same final outcome; tamper/schema rejection; transcript replay hash.
- `game/clock` exactly 600 ticks at 60 FPS; identical hash at 30/60/120 FPS for a tick-stamped schedule; frozen while hidden/paused for 10 simulated minutes; render hitches never fast-forward; true stalls pause with explanation; negative/non-finite deltas ignored; assisted mode = same 600 ticks, 2× frames; revision counters; placement-mode ghost legality.

### Browser E2E (Playwright) — real pointer/touch paths

- Title → New Lineage → briefing → **plan 3 orders by projecting real 3D positions and clicking/tapping** (mouse hover ghost + click on desktop; tap + Confirm on iPhone profile) → Begin → costs paid once → scaffolds appear → clock runs → pause freezes → resume → warnings → collapse → debrief with causes.
- Invalid placement: ghost goes red with the engine's reason; Build disabled; click never charges; Esc cancels. (desktop only: hover is a desktop affordance)
- Inheritance: debrief → interregnum with ruins → one bounded excavation (second disabled) → choose site + tradition → epoch 2 is the same valley (ids persist; ruins remain) with the inherited summary.
- Three epochs to an ending (verdict screen with unmet conditions) → Play again resets to a fresh epoch 1.
- Persistence: hiding the page (visibilitychange) freezes ticks and resources for seconds and requires an explicit Resume; reloading at 28.6 s left resumes **paused at the exact tick with identical state** and the catastrophe resolves once; navigation never duplicates the canvas.

## Not yet verified (honest list)

- **No WebKit/Safari run** (only Chromium is installed in this sandbox). `EPOCH_WEBKIT=1` enables the WebKit project when available.
- **No real-GPU or phone frame-rate measurement.** Software GL here cannot say anything about 60/30 FPS. Targets are unproven.
- **Visual quality judged only by me via software-GL screenshots** (`docs/review/`); no independent art review yet.
- No audio. No automated visual-diff baseline yet.
