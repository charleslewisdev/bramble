# Bramble Backlog Items

Captured 2026-03-10 from user feedback session. Updated end of garden map v2 session.

## Garden Map

- [x] **Verify WebGL fix on user's browser** — Context lost still fires but app handles it gracefully. Single-context approach works.
- [x] **Verify house sprite rendering** — Confirmed working on user's browser after v2 deploy.
- [x] **Verify plant grid spacing** — Confirmed good. Tightened to PLANT_SLOT_SIZE=36px with negative inset for denser layout.
- [x] **Verify plant click/popover** — Fixed: pixi-viewport consumed pointertap events. Switched to manual hit testing via viewport 'clicked' event.
- [ ] **WebGL fallback rendering** — If WebGL truly can't work on user's browser, consider a Canvas 2D fallback renderer. PixiJS v8 removed built-in canvas renderer; would need `@pixi/canvas-renderer` or a custom 2D canvas approach.

## UI/UX Fixes

- [x] **Amphibian capitalization** — Added "Amphibians" to categoryLabels in Dashboard
- [x] **Yellow dots on plant sprites** — Added `showOverlay` prop to PlantSprite; disabled in PlantBrowser reference views
- [x] **Plant tag/chip inconsistency** — Created `Chip` component; standardized SafetyBadge, StatusBadge, and inline badges to consistent sizing
- [x] **Sprite selection on plants** — Clickable sprite in MyPlantDetail opens 4x3 picker; spriteOverride column on plant instances
- [x] **Bulk care task actions** — Checkbox selection, sticky bulk bar with Complete All/Skip All/Delete All; bulk server endpoints

## Workflow/Process Improvements

- [ ] Audit git history and frequent patterns to identify recurring issues
- [ ] Update Claude Code skills or brain memory to fix root causes of workstream inefficiencies
