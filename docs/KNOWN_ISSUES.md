# Known issues

| ID | Severity | Issue | Next action |
|---|---|---|---|
| K-001 | high | No browser application yet (phase 03). | Build Vite/R3F scaffold next. |
| K-002 | medium | Balance is untuned: a bot that avoids the forecast footprint suffers almost no losses. | Phase 12/15: shrink safe land, tune hazard strengths with tournaments. |
| K-003 | medium | Victory routes A/B are proposed only; no executed winning trace. | Phase 12. |
| K-004 | low | Defeat tests rely on forcing population at the last tick. | Add a natural no-action loss trace in phase 12. |
| K-005 | low | Hazard `HazardCell.arrival` units differ per hazard (fire: cost, flood: steps, quake: distance×4); the presentation must normalize by `span`. | Handle in renderer. |
| K-006 | low | Tradition choice text is generated from the report; copy review pending. | Phase 14 polish. |
