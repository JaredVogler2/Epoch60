# Phase 07 — Treat desktop and iPhone as first-class game controllers

## Overall design

The most common cause of failed fast browser strategy games is an excellent engine hidden behind 5 modal clicks. UI must enable **one meaningful action within the first 15 active seconds**, never require mouse hover, and never obscure more than necessary of beautiful 3D world. Visual hierarchy: time remaining / current urgent objective / resources / 1–3 obvious actions / selected target. Hide complex economics and research behind contextual expansion.

## Desktop interaction

- Left click building/plot opens compact inspector; drag empty terrain pans; wheel zoom; bounded right-drag orbit or modifier+drag; reset/focus camera button.
- B/number keys for build tray, Space for pause (avoid browser page scroll), Escape closes panel/selection, Enter confirms context, Tab to focus controls; keyboard complete a viable turn/run via accessible DOM alternative.
- Place ghost building, snap location, rotate via R/key or control, verify terrain and cost; click to confirm. Right click/Escape cancel (do not unexpectedly charge).
- Build paint stroke for road/fence/farm rows, with resource/path preview and cost cap; undo planned segments until committed.
- Resource chips show current and small rate trend; expanded inspector shows exact why production halted and who is assigned.
- Screen remains majority 3D world; permanent full-height inspector is optional and collapsible.

## iPhone Safari portrait interaction

Test actual dimensions 320x568, 375x667, 390x844, 430x932, landscape and tablet. Use viewport-fit=cover, safe-area insets, account for Safari bottom address/navigation bar and dynamic viewport unit (dvh) behavior. No app-wide unwanted scroll / rubber band while manipulating canvas, but retain touch scrolling within menus. Maintain >=44x44 CSS px targets with sensible separation.

- One finger empty-land pan; tap building/plot selects, with drag-versus-tap threshold. Two-finger pinch zoom, optional two-finger rotate; on-screen +/- and recenter as fallback.
- Bottom **collapsible action deck** shows 3–5 most relevant build/action icons, one-thumb friendly. Open selection drawer with thumb-size Confirm; no tiny corner close; drag handle; Escape-equivalent.
- For construction, tap build icon then tap valid world cell, view snapped 3D preview + context cost, tap large Confirm. Optional hold-to-confirm after tests if mis-taps common. Invalid footprint clear patterned warning, not color only.
- Speed/clock clear at top, Pause and End Epoch reachable, but don't accidentally hit during camera gestures. During build mode, timer continues normally (unless assist mode); users can choose pause and return to action in separate score mode.
- Automatic tactical camera zoom to selected placement without moving the entire world wildly; allow focus to hazards and buildings with direct buttons.
- Orientation change preserves action plan, selection, time and camera target. Text fields (naming civilization/seed) activate software keyboard only outside active 60s clock or auto-pause.
- Do not rely on long press or hover for crucial tooltips; tap opens them.

## HUD composition

Top: slender Epoch number + 60s countdown and looming hazard icon/forecast, expand details on tap.
Side: 3–5 icon resource chips with numeric amount and +/- flow, scroll/expand optional.
Bottom: action/build tray with 3–5 cards, primary selected context CTA, planning pause.
Selected building: small contextual floating panel; detailed inspector expands from bottom on phone and side on desktop.
Between epochs: cinematic but concise **Before/After** archaeological report with clear NEXT button.
Research: 3 deliberate branch options as illustrated cards, costs and tradeoffs in one tap.
Endgame: victory/defeat + actual map evidence, score, lineage summary, new seed/retry.

Avoid an always-open large tech tree, 12 tiny resource badges, giant panels covering city, or main buttons requiring nested modal traversal.

## Onboarding UX

Tutorial is ACTUAL gameplay, not fake overlay: first free inspect, highlight likely building site, prompt building Farm/Archive, animated construction, production effect, approaching crisis, what to preserve. Teach collapse/heritage at first interepoch; next era introduces archaeology and research. "Show me how" hint button always accessible, hints grounded in state and alternative plans. User can skip tutorial. Acknowledge failures with human-readable cause and useful counterfactual.

## Input and focus engineering

Use raycaster with large interaction hit volumes, avoid picking vegetation clutter, HUD pointer events only where visible. Correct pointer capture, delta threshold for drag, no ghost double clicks from touch. Account for Safari synthetic events. Prevent pinch from dragging a house. If graphic entities overlap, disambiguate via small near-touch picker list. Accessibility mirrored by DOM lists of all actionable buildings/plots; no canvas-only gate.

## E2E acceptance

Real browser flows on iPhone-like viewport: new game → Begin → select Build → tap valid 3D tile → confirm → see resource decrease → advance time → pause/resume → collapse → Next Epoch → inspect ruin → build again. Desktop mouse + keyboard similar. Test overlays, landscape orientation, different DPR, Safari/WebKit. Measure first legal placement taps and typical context; target <=3 taps after choosing build type. If user must perform 8 taps to construct one house, redesign.