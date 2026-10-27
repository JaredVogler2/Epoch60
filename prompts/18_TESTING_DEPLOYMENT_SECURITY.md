# Phase 18 — Production testing, secure static deploy, versioned saves and final integration

Objective: make the genuine browser game reliable, safe, deployable to Vercel and demonstrably playable on desktop and iPhone. Complete end-to-end acceptance, not just unit tests. No mandatory database, account or paid API for default single-player.

## CI and local commands

Fresh checkout/npm ci, typecheck, lint, Vitest, Playwright E2E and npm run build pass with exact versions. CI workflow runs fast deterministic tests and build; headless tournament can be separate slower workflow. Add release verification scripts that fail on missing assets, invalid content schemas, dead routes, missing shader resources and inconsistent save versions. Never disable a failing test to make a green build.

## End-to-end browser matrix

Desktop Chromium at 1366x768, laptop 1440x900, Firefox smoke; WebKit at 390x844 and 320x568, landscape iPhone. If actual iPhone Safari available, test and record version; WebKit automation is not proof of actual physical device. Flows:
1. Fresh user starts guided mode, taps Begin, builds Farm and Cottage with real resource changes.
2. Uses camera orbit/pan/zoom, selects buildings, opens context card and selects research; no dead hits.
3. Advances precisely one 60.0s epoch (testable virtual clock), observes collapse and true world modifications.
4. Next civilization discovers ruin, excavates/salvages and builds atop changed land; repeating yields multi-epoch end.
5. Successfully completes an authored campaign and also reaches a legitimate loss/recovery screen.
6. Saves mid-epoch; refresh/resume freezes timer while absent; resumes same state and real time remaining.
7. Background/foreground transitions do not silently consume minute or duplicate catastrophe.
8. Uses keyboard and touch independently, respects reduced motion, mute, font scale and safe area.
9. Runs seeded expedition and daily, copies shareable seed, replays exact result hash.
10. Invalid/corrupt save gracefully recovers, user can export/import, reset confirms consequences.
11. Intro/asset load errors report helpful fallback rather than a blank WebGL canvas.
12. No console errors, memory runaway after 10 new-world transitions or inaccessible modal traps.

## Security and reliability

Validate all user-controlled query strings, scenario seeds, save JSON and import content by bounded schema; no eval/Function/arbitrary executable mod in saves. Never commit API keys, no Vite-exposed secret; no tracking by default. Limit asset origins and apply appropriate content-security controls where possible. Use licensed/original models and music and record attributions. For static website, save data stored locally with versioned migrations and optional export/download, not assumed synced between devices. Explain user privacy and limitations plainly.

## Exact deterministic regression

Engine fixed seed+tick actions outcome hash equal across desktop/mobile, quality tier, reload and reduced-motion settings. Collapse must occur exactly once, legacy transforms apply in same order, scoring/rewards do not mutate physical state incorrectly. Execute 1000+ generated worlds offline; publish actual success/failure/invalid reasons without inventing rates.

## Production deployment

Document Vercel static config (build npm run build, output dist, rewrite for SPA routes if applicable). If Vercel app connection and authorization available, deploy, wait for actual success, open live URL, run smoke actions and inspect asset loading. If access unavailable, leave tested deploy-ready project with exact steps and **do not make up a URL**. Consider bundle budgets and immutable hashed assets.

## Art proof

Attach actual browser screenshots of day 1, epoch collapse, successor ruins and future-era scene on both wide and portrait view. A gorgeous picture that is disconnected from game runtime does not pass. Validate real sprite/mesh assets and shader compatibility with WebKit.

## Required evidence

docs/RELEASE_CHECKLIST.md and docs/TEST_RESULTS.md containing commands, test versions, results, failure notes, bundle/perf measurements, deployment status, specific screenshots. Commit and advance to phase 19 with all known bugs enumerated.