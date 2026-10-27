# Claude Code execution, context-reset and truthful evidence protocol

This file supplements all phases. It tells Opus 5.5 Max how to continue a very large coding assignment without losing work to context, credit or timeout interruptions.

## On every agent invocation

1. Inspect repo status, branch, recent commits, package scripts and docs/PROGRESS.md.
2. Identify next incomplete phase and its *actual* acceptance criteria; verify whether previous claimed milestones are truly shipped.
3. Record a short active task plan in docs/PROGRESS.md. Limit current work to one testable milestone (e.g. legal 3D farm placement, not entire tech tree).
4. Implement, run relevant checks and inspect actual browser/render for visual changes.
5. Commit coherent working code and progress; do not defer commit until all 20 phases.
6. Report: phase, commit hash, commands and actual results, screenshots/fixture references, known failures, exact next subtask.
7. If context nearly exhausted, update docs/CONTINUE_HERE.md with file paths, pending bug IDs, test command and next action; commit. Next agent session begins by reading it. Avoid long speculative essays.

## Status semantics

NOT STARTED — no delivered code.
IN PROGRESS — concrete files currently being implemented.
IMPLEMENTED UNVERIFIED — code exists but relevant tests/visual interaction not run.
VERIFIED — required actual code/test/visual evidence passed.
BLOCKED — external dependency or environment prevents, with specific evidence.
REOPENED — regression or quality failure discovered post-pass.

Never check off a phase merely because a prompt file exists. Distinguish design/spec from implemented functionality. Do not conceal unverified human fun with bot statistics.

## Command and evidence log template

Phase and date, branch/sha, requirements addressed, files changed, npm ci/typecheck/lint/test/build/test:e2e outcomes with exact failure excerpts if any, headless simulation fixtures, screenshot path and viewport/hardware, human interactive path if available, quality rubric, blockers and next exact action.

## Rollback safeguards

Before breaking schema, renderer or world-state migration: commit a known-good checkpoint; maintain legacy save migrations or explicit conversion, run seeded replay regression; don't delete user changes; ensure new phase remains runnable. Prefer incremental adapters to app rewrites. If unstable major branch, open a PR with test notes before replacing main.

## Dependency hygiene

Confirm official current documentation and actual tested version pairings; avoid alpha WebGPU pipeline and R3F prerelease as default. Lock dependencies. No server or LLM necessary for local core play, and no generated external assets silently linked from unstable CDNs. Track licenses of any third-party art/audio.

## What to tell user after completion

Do not say "the game is ready" unless code is runnable, core 60s path completed, 3-epoch persistent inheritance and mobile input verified, qualitative art review performed, and release checklists passed. A commit of 20 prompt files is an implementation **plan**, not a game. State real deployment status and actual URL only when verified.