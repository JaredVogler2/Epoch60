# Phase 17 — iPhone Safari, accessibility, adaptive 3D performance and offline resilience

Treat mobile as FIRST CLASS. iPhone portrait must be a real comfortable way to play an urgent one-minute strategy game, not the desktop shrunk so everything is microscopic. Browser loads static assets from Vercel and runs entirely client-side; game timer must be trustworthy across tab interruptions.

## Touch design

Phone widths 320, 375, 390, 430; portrait and landscape safe-area insets. One-finger drag pans across terrain; tap selects 3D objects or valid build site (drag/tap distance threshold); two-finger pinch zooms; limited orbit via two-finger gesture or explicit rotate buttons; persistent center/focus-to-next-threat affordance. Interaction hit areas should be at least 44 CSS px for DOM controls where practical, enlarged invisible 3D hit proxies for small citizens. Main Build bottom sheet thumb-reachable, simple swipe-to-collapse and confirmation action; clock and primary resource data always visible, no scroll required for crucial action.

A building should take roughly two or three deliberate taps after entering palette—not six nested menus. Prevent accidental placements as finger releases after camera pan. Show immediate ghost building, site status and cost before commit. Provide long-press optional detail but no vital information hover-only. Real-time countdown visibility persists while panel open; assisted pause mode accessible (score separated).

## Accessible equivalents

All essential scene actions via semantically labeled DOM list/controls as alternative to raycast; keyboard Tab/Enter/Escape/arrows/shortcuts for desktop, appropriate focus trapping for modals, screen reader announcements for end-of-epoch summary, clear contrast and text scaling. No color-only state (green/red ghost needs text/icon). Reduced motion setting disables excessive shake/flash and skips long cataclysms while preserving damage information. Audio mute/music/effects independently stored.

## WebGL budgets (measure on real hardware when available)

Default midrange laptop aim 60fps; representative midrange iPhone aim stable 30fps while building, panning and disaster, with adaptation to reduce pixel ratio/foliage/shadows/particles while maintaining detailed 3D silhouettes. Track frame time p50/p95, draw calls, triangles, texture VRAM proxy, JS heap, shader compilation and scene load times. Capture device/browser and settings for any reported figures. No unsupported sweeping "runs at 60fps on iPhone" claim.

Create quality profiles:
- HIGH: full foliage density, larger soft shadow maps, richer water foam/lighting, optional restrained effects.
- MEDIUM: instanced vegetation, simplified water normals, fewer ambient particles and shadow casters.
- LOW: smaller DPR, cheap directional/contact shadows, reduced mesh LOD, simpler weather—but still volumetric architecture/sculpted terrain/real river/individual citizens.
Auto tune cautiously with user override; never remove the core gameplay information or make flood visually invisible.

Use shared geometry/material and InstancedMesh for repeated props, correct disposal of WebGL resources on new run, GLTF caching, lazy audio/models, asset compression only when effective. Prevent 200 per-frame React state updates; R3F uses ref/transforms for frequent cosmetics, engine updates at fixed ticks.

## Time and reliability

Pause on visibilitychange/pagehide; no offline catchup and no fake re-sim from wall clock. On tab return, show Resume panel with same authoritative tick; no epoch termination due to background. Save on meaningful action/transition and lifecycle event where possible; handle disabled storage/quota. If local device sleep makes timer uncertain, favor freezing until explicit resume and document policy. 60 seconds of active play should remain 60 regardless of FPS quality.

## PWA optional

Progressive Web App install/offline asset caching can be implemented after core app proven, but avoid stale service worker serving old schemas/shaders. Clear cache migration, versioned content and update prompt. Not required to have cellular connectivity after initial assets cached.

## Tests

WebKit/Chromium mobile viewport new game→placement→pause/resume→cataclysm→successor→second build; rotate viewport mid-session; 320px overflow audit; reduced motion; focus and accessible labels; mobile landscape; GPU context loss if mockable; repeated era transition resource leak check; Chrome desktop keyboard-only one complete game loop. Actual hardware Safari and VoiceOver verification recorded if available; otherwise mark unverified. Commit evidence and fixes.