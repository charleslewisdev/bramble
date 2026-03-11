# Bramble Backlog Items

Captured 2026-03-10 from user feedback session. Updated end of garden map v2 session.

## Garden Map

- [ ] **Verify WebGL fix on user's browser** — Refactored PixiJS app init to create WebGL context once (not per data change). User was hitting `FEATURE_FAILURE_EGL_NO_CONFIG` / `FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`. Needs confirmation the single-context approach resolves it.
- [ ] **Verify house sprite rendering** — House was showing as gray box on user's browser (works in Playwright). Fixed with solid background fill + explicit `CanvasSource` with `scaleMode: 'nearest'`. Needs user confirmation after pulling latest.
- [ ] **Verify plant grid spacing** — Rewrote plant layout with `PLANT_SLOT_SIZE=44px` grid + overflow rotation (8s cycle). Playwright screenshot looked good but needs user eyes on it.
- [ ] **Verify plant click/popover** — Added `hitArea` + `eventMode: 'static'` to plant Graphics containers. Not yet tested by user.
- [ ] **WebGL fallback rendering** — If WebGL truly can't work on user's browser, consider a Canvas 2D fallback renderer. PixiJS v8 removed built-in canvas renderer; would need `@pixi/canvas-renderer` or a custom 2D canvas approach.

## UI/UX Fixes

- [x] **Amphibian capitalization** — Added "Amphibians" to categoryLabels in Dashboard
- [x] **Yellow dots on plant sprites** — Added `showOverlay` prop to PlantSprite; disabled in PlantBrowser reference views
- [x] **Plant tag/chip inconsistency** — Created `Chip` component; standardized SafetyBadge, StatusBadge, and inline badges to consistent sizing
- [ ] **Sprite selection on plants** — Allow choosing a sprite from the full library when editing a plant. Current auto-matching is rough; users should be able to override
- [ ] **Bulk care task actions** — New garden setup generates hundreds of care tasks; need bulk select/edit/complete/delete

## Workflow/Process Improvements

- [ ] Audit git history and frequent patterns to identify recurring issues
- [ ] Update Claude Code skills or brain memory to fix root causes of workstream inefficiencies
