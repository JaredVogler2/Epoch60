# Phase 19 — Independent adversarial game review, visual review, correction and truthful finish

Act as 7 skeptical testers: first-time player, experienced strategy gamer, speedrunner/exploit hunter, environment artist, iPhone touch player, performance engineer and release QA. This phase is NOT a self-congratulatory summary. Reopen earlier phases whenever game is ugly, confusing, technically unverified or not genuinely replayable.

## Required real gameplay audit

Play/automate at least one full 3-epoch campaign from fresh save, including a victory, one intentional failure/recovery and another seed. Attempt 2 mechanically distinct viable strategies (ecology-steward and archive/engineering); run clock, placement, tech, disaster, collapse, inherited scars, excavation and subsequent age; inspect true event chains. If interactive browser tools unavailable, mark human-experience/visual items UNVERIFIED instead of inventing play.

Critique:
- Are 60 seconds actually filled with 6–15 meaningful choices, or dead time/tap-spam?
- Do inheritance outcomes causally reflect past decisions? Can a player explain 3 exact inherited states?
- Does the player want to retry another approach after defeat, and does the same map create new puzzles?
- Is end-of-epoch cataclysm fair and telegraphed rather than arbitrary RNG?
- Do science, ecology and monuments represent genuinely competitive strategies?
- Are late eras more than recolored identical buildings?
- Do mobile controls permit decisive action without thumb gymnastics?
- Does the 3D scene look like a quality indie fantasy diorama when HUD is hidden?
- Are screenshots from a functioning browser, not pre-rendered assets?

## Rigorous visual gate

Produce actual runtime screenshots at canonical fixed seed and camera of early village, close building detail, mid-build placement, crisis, collapse, successor archaeology, industrial/future city, desktop HUD and 390px + 320px portrait mobile. Score 1–5 on geometry, scene composition, material shading, lighting, foliage, water, citizen life, historical progression, HUD restraint and touch usability. Require >=4/5 in core categories; if not, list visible failures and revise actual meshes/lighting/art, not only CSS. See QUALITY_GATE_VISUAL_AND_FUN.md.

## Exploits & stability

Try timer pause while placing, background tab clock exploit, save-scumming RNG, rapid build/demolish resource creation, stacking impossible footprints, indefinite ore extraction, persistent archive infinite knowledge, cancel-queue refunds, copied seed URLs, resource underflow/overflow, infinite archaeology reward loops, no-op or one-button strategy dominance. Test orientation switch, tab sleep, browser restart, local save corruption, return from suspend, lost WebGL context and multiple scene remounts.

## Evidence-led remediation

List 10 highest-severity REAL defects if found; do not fabricate. Rank P0/P1/P2 with screenshots or reproducible seed/action trace, root cause, fix and regression test. Fix all P0 and at least top five P1; rerun targeted and global suites. If inability to verify, mark explicitly and leave manual QA runbook. Record corrections in docs/ADVERSARIAL_REVIEW.md with before/after screenshots and observed effect.

## Final release verdict

PASS only if: 60s timer exact, game start/collapse/inherit/next epoch/end fully works, 3D beauty verified, at least 3-epoch full human-like flow, seeded replay and saves consistent, real iPhone-like browser interactions tested, performance reported with device context, production build works and deployment status truthful. Build/console success alone is NOT release proof. Commit fixes, report exact code SHA and live URL only if actually deployed/verified. Otherwise report incomplete gates, no false success language.