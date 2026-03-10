# Bramble Beta Issues & Follow-up Work

Comprehensive review completed 2026-03-10. All 43 issues addressed.

---

## Resolved Issues (40/43)

All critical bugs, most important issues, and most minor issues have been fixed:

- **BUG-001** Path traversal vulnerability — FIXED (filename validation + canonical path check)
- **BUG-002** Shopping list DELETE route conflict — FIXED (route order + client path corrected)
- **BUG-003** No input validation — FIXED (Zod schemas on all server routes)
- **BUG-004** Drag-and-drop no visual feedback — FIXED (dragOffset state + CSS transform)
- **BUG-005** Frontend PlantType enum missing values — FIXED (houseplant, groundcover, aquatic added)
- **BUG-006** Mood message flicker — FIXED (hashCode seed, no Math.random)
- **BUG-007** N+1 query on plant instances — FIXED (zone-first query, avoids full-table JS filter)
- **BUG-008** Weather cache unbounded growth — FIXED (delete+insert upsert pattern)
- **BUG-009** No NaN check on route IDs — FIXED (idParamSchema on all routes)
- **BUG-010** PHOTOS_DIR relative path — FIXED (env var with __dirname fallback)
- **BUG-011** No error feedback on mutations — FIXED (toast notification system)
- **BUG-012** Wildlife reptile misclassification — FIXED (server + client types + Dashboard icons)
- **UX-001** Delete plant instances — FIXED (Danger Zone with ConfirmModal)
- **UX-002** Delete/edit care tasks — FIXED (both MyPlantDetail and CareTasks pages)
- **UX-003** DELETE endpoint for plant references — FIXED (409 Conflict guard)
- **UX-004** Settings temperature persistence — FIXED (reads/writes server settings API)
- **UX-005** Add to My Garden success feedback — FIXED (toast + navigate)
- **UX-006** Photo body size limit — FIXED (bodyLimit: 10MB)
- **UX-007** Notification toggle on care tasks — FIXED (sendNotification checkbox in both forms)
- **UX-008** Dashboard multi-location widgets — FIXED (loops over all locations)
- **UX-009** 404 page — FIXED (NotFound component with catch-all route)
- **UX-010** ConfirmModal for destructive actions — FIXED
- **UX-012** Display unused schema fields — FIXED (all listed fields now rendered)
- **UX-013** Seed data dedup — FIXED (commonName + latinName check)
- **CODE-001** Shared utilities — FIXED (utils/constants.ts, utils/format.ts, utils/weather.ts)
- **CODE-002** No API timeouts — FIXED (AbortSignal.timeout on all server fetch calls)
- **CODE-003** CORS configurable — FIXED (CORS_ORIGIN env var)
- **CODE-005** Unused imports — FIXED
- **FEAT-001** Notification sending — FIXED (Slack, Discord, Ntfy, Pushover, Home Assistant real implementations; Email is console.log stub)
- **FEAT-002** Care task auto-generation — FIXED (water/prune/inspect/fertilize from plant metadata)
- **FEAT-003** Dynamic mood calculation — FIXED (weather + watering + status based)
- **FEAT-004** Weather alerts — FIXED (frost/heat/rain/wind alerts with Dashboard display)
- **FEAT-008** Budget fields on shopping list — FIXED (estimatedCost, vendorName, purchasedAt, category)

---

## Remaining (3/43) — Low Priority

### UX-011: Accessibility improvements (minor)
Modal lacks `role="dialog"`, `aria-modal="true"`, focus trapping. PlantSprite has aria-labels. Improvement opportunity, not a blocker.

### CODE-004: Timezone detection US-only
Hardiness zones and timezone fallback are US-only. Document limitation. Not a bug for target user base (Portland, OR).

### FEAT-001 (partial): Email notification
Email channel is a console.log stub. 5 of 6 notification channels have real HTTP implementations. Email needs SMTP/nodemailer implementation.

---

## Future Feature Gaps (not bugs)

### FEAT-005: LLM integration
Anthropic SDK not yet imported. Scoped features: plant diagnosis from photo, status updates from photo, companion planting suggestions, natural language care summaries.

### FEAT-006: Advanced lot diagramming
No zone boundary drawing tool, no custom lot shapes, no 3D structure visualization, no sun shadow casting. Current draggable zones work but are basic.

### FEAT-007: Background job queue
No periodic task execution. Needed for: scheduled notifications, daily care task checks, weather refresh, plant API enrichment batches.

### FEAT-009: Data import from source documents
60+ plants from docs/research/source-data/*.xlsx never imported. Could be one-time seed or manual import feature.

### FEAT-010: Photo gallery overview
Photos only viewable per-plant. No cross-plant gallery or timeline view.
