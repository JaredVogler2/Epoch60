# Release checklist (Phase 18)

**Status: deploy-ready, not deployed.** A production deployment needs the owner's explicit confirmation (K-018). No URL
exists, so none is given here; never write one that was not actually deployed and opened.

## Before every release

Each of these must pass on a fresh checkout. CI (`.github/workflows/ci.yml`) runs the first six on every push, from
`npm ci` with the exact locked versions.

| Step                          | Command                                                                  | What it proves                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                       | `npm ci`                                                                 | the lockfile installs as written                                                                                                                                      |
| Types                         | `npm run typecheck`                                                      | strict TypeScript, `noUncheckedIndexedAccess`                                                                                                                         |
| Lint                          | `npm run lint`                                                           | the engine never reads `Math.random`, `Date.now` or `performance.now`                                                                                                 |
| Unit and engine tests         | `npm test`                                                               | rules, determinism, saves, replays, bots, feats, backups, the release check itself                                                                                    |
| Build                         | `npm run build`                                                          | type-checked production bundle in `dist/`                                                                                                                             |
| Release check                 | `npm run verify:release`                                                 | `dist` is whole (every file the page and every chunk loads exists, no inline script or style, no source map or secret), within budget, served under the headers below |
| Browser suite                 | `npx playwright test`                                                    | desktop and iPhone-profile journeys, all under the production headers; CI runs it too, as an informational job                                                        |
| Bot balance (after rule work) | `npx vite-node scripts/sim.ts` and the scripts in `docs/TEST_RESULTS.md` | the measured win rates and the recorded traces still hold                                                                                                             |

Latest results with dates and numbers: `docs/TEST_RESULTS.md`.

## What a release serves

- A static single-page app: `dist/index.html` and hashed files under `dist/assets/`. No server code, API, database,
  account, analytics or tracking. One route (`/`); options travel in the query string (`?seed=…&scenario=…`), so no
  rewrites are needed.
- Budget (`scripts/verify-release.ts`): JavaScript and CSS at most 1.8 MB raw and 520 kB gzipped. Session 7 measured
  1.52 MB and 433 kB.
- Headers (`vercel.json`), sent by `vite preview` too, so every browser test runs under them:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:;
font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    (`data:` images are the then-and-now pictures, `blob:` only ever holds what the page itself made; nothing is
    allowed from anywhere but the site);
  - `Permissions-Policy` denying camera, microphone, geolocation, payment and USB; `Cross-Origin-Opener-Policy:
same-origin`; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`;
  - `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` (their names change with their content).

## Deploying to Vercel (only with the owner's confirmation)

1. Import the GitHub repository into Vercel. `vercel.json` sets the framework (Vite), the build (`npm run build`) and the
   output (`dist`); Node 22 (`package.json` engines). Production branch: `main`.
2. Add no environment variables or secrets: the game never calls a server, and none is read at build time.
3. When the deployment is Ready, smoke-test the live URL:
   - `curl -sI <url>/` shows the headers above; `curl -sI <url>/assets/<a file the page loads>` shows the immutable cache;
   - on a desktop browser and on a phone: the title shows the living village; New Lineage, place a Farm, Begin; the
     minute runs and the catastrophe plays; the debrief appears; Settings, Your data, Export a backup downloads a file;
     the console shows no errors and no "Refused to …" line.
4. Record the URL, the commit, the date, the browsers and devices used and what was seen in `docs/TEST_RESULTS.md`.
   A real iPhone check is recorded as such only if it happened on a real iPhone (K-001).

## Privacy and data

What the game says in Settings, Your data, and does:

- Everything is kept in this browser's `localStorage`: the saved lineage (one), the branch points of the current
  lineage, the Codex, up to 40 run cards and the settings. Nothing is sent anywhere; clearing the site's data erases it.
- **Export a backup** downloads one JSON file holding the saved lineage (with its Daily Ruins date and branch mark), the
  Codex and the run cards. Settings stay with the device; branch points and then-and-now pictures are not carried.
- **Import a backup** treats the file as untrusted, like stored data: the lineage must read back whole (shape and
  integrity checks), Codex entries and run cards are checked one by one, and nothing is written until the player has
  seen what the file holds and confirmed. Feats and run cards join this browser's; the lineage replaces the saved one.
- **Starting a new lineage** over a saved one with progress (begun, not yet ended) asks first, naming it.

## The flows Phase 18 asks for, and their evidence

| Flow (prompt 18)                                                         | Evidence                                                                                                                                                                                                                                                            | Status  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1. Begin, build a Farm and a Cottage with real resource changes          | `e2e/journey.spec.ts` (mouse on desktop, touch on the phone profile)                                                                                                                                                                                                | done    |
| 2. Camera, selection, context card, research; no dead hits               | `e2e/journey.spec.ts`, `e2e/interaction.spec.ts`, `e2e/ruins.spec.ts`, `e2e/layout.spec.ts`                                                                                                                                                                         | partial |
| 3. One exact 60.0 s epoch, the collapse and the world changed            | `e2e/journey.spec.ts`, `e2e/campaign.spec.ts`; 600 ticks, not 601, in the engine tests                                                                                                                                                                              | done    |
| 4. The next people find ruins, dig, build on changed land; an ending     | `e2e/campaign.spec.ts`, `e2e/ruins.spec.ts`                                                                                                                                                                                                                         | done    |
| 5. An authored campaign won, and a legitimate loss                       | `e2e/victory.spec.ts` (each route's recorded win, same hash), `e2e/modes.spec.ts` (an unprepared Daily Ruins lost, with its card)                                                                                                                                   | done    |
| 6. Save mid-epoch; reload resumes paused at the same tick and time       | `e2e/persistence.spec.ts`                                                                                                                                                                                                                                           | done    |
| 7. Background and foreground never consume the minute or repeat it       | `e2e/persistence.spec.ts`                                                                                                                                                                                                                                           | done    |
| 8. Keyboard and touch apart; reduced motion, mute, font scale, safe area | `e2e/a11y.spec.ts`, `e2e/audio.spec.ts`, `e2e/layout.spec.ts` (larger text at 125% and 150%, session 7); safe-area insets are not tested (no emulation for them)                                                                                                    | partial |
| 9. Expedition and daily, a shared seed, a replay to the same hash        | `e2e/modes.spec.ts`, `e2e/challenges.spec.ts`, `e2e/replay.spec.ts`                                                                                                                                                                                                 | done    |
| 10. Corrupt save recovers; export and import; reset confirms             | `e2e/backup.spec.ts` (session 7); damaged saves set aside with a message (`tests/game/robustness.test.ts`, the title's bad-save note)                                                                                                                               | done    |
| 11. Load errors give a helpful fallback, never a blank canvas            | `e2e/fallback.spec.ts` (session 7: no WebGL at all, and a scene whose graphics context cannot be created: the error screen offers a reload, a backup and a confirmed fresh start), `e2e/graphics.spec.ts` (a lost context pauses and redraws)                       | done    |
| 12. No console errors, no runaway memory over many new worlds, no traps  | `e2e/memory.spec.ts` (session 7: ten new worlds leave one canvas; heap 10.3 → 11.5 MB after forced collection, within its 25% bound, K-025), `e2e/journey.spec.ts` and `e2e/security.spec.ts` (console errors, policy violations), `e2e/a11y.spec.ts` (modal focus) | done    |

The browser matrix asked for is wider than what runs here:

| Browser                                                     | Status                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Chromium, desktop 1366×768 (software GL)                    | the full suite                                                                             |
| Chromium with the iPhone 13 profile (touch, 390×664, DPR 3) | the full suite                                                                             |
| WebKit and Safari; a real iPhone                            | not run: no WebKit build here (K-001); `EPOCH_WEBKIT=1` adds the project where one is      |
| Firefox; laptop 1440×900                                    | not run as suites: no Firefox build here; 1440×900 was inspected by screenshot (session 4) |
| Real-GPU frame rates                                        | unmeasured (K-009)                                                                         |

## Known issues at release

`docs/KNOWN_ISSUES.md`, in particular K-001 (no WebKit or real iPhone), K-009 (no real-GPU frame rates), K-011 (the
software-GL timing flake in the browser suite), K-014 (no human playtest), K-015 (the audio has never been heard),
K-016 (no real screen reader) and K-018 (not deployed).
