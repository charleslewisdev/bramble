# Plant Journal & Photo System Design

## Summary

Add a per-plant care journal (timeline of observations, care completions, milestones, and photos) with thumbnail generation, Docker photo persistence fix, and `status_check` care task type for periodic prompts.

## Decisions

- **Hybrid journal**: Care task completions auto-create entries; users can also add freeform observations anytime
- **Photo storage**: Base64 upload (existing) + server-side thumbnail generation via `sharp`
- **Scope**: Plant-level journal only for now; schema supports zone/location-level for future
- **Status checks**: New `status_check` care task type — recurring tasks generated per plant
- **Bug fixes included**: Docker photo persistence (PHOTOS_DIR env), missing GET /api/photos endpoint

## Data Model

### New: `journalEntries` table
| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | auto-increment |
| plantInstanceId | FK nullable | plant-level entries |
| zoneId | FK nullable | future zone-level |
| locationId | FK nullable | future location/"what is this?" photos |
| entryType | enum | observation, status_check, care_log, milestone, identification |
| title | text nullable | auto-generated for care logs |
| body | text nullable | freeform notes |
| careTaskLogId | FK nullable | links to care task log when auto-generated |
| createdAt | text | ISO timestamp |
| updatedAt | text | ISO timestamp |

### New: `journalPhotos` join table
| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | auto-increment |
| journalEntryId | FK | required |
| plantPhotoId | FK | required |
| sortOrder | integer | default 0 |

### Modified: `plantPhotos` table
- Add `thumbnailFilename` (text, nullable) — generated on upload

### Modified: `careTasks.taskType` enum
- Add `status_check` to the enum

## API Changes

### New endpoints
- `GET /api/journal?plantInstanceId=X` — list journal entries for a plant (paginated)
- `POST /api/journal` — create freeform journal entry (with optional photos)
- `GET /api/journal/:id` — get single entry with photos
- `PUT /api/journal/:id` — update entry
- `DELETE /api/journal/:id` — delete entry (photos stay in plantPhotos)
- `GET /api/photos?plantInstanceId=X` — **fix**: implement missing list endpoint
- `GET /api/photos/file/:filename` — now also serves thumbnail variants

### Modified endpoints
- `POST /api/photos` — now generates thumbnail on upload
- `POST /api/care-tasks/:id/log` — now auto-creates a journal entry on completion

### Docker
- Add `ENV PHOTOS_DIR=/data/photos` to Dockerfile
- Add `PHOTOS_DIR=/data/photos` to docker-compose.yml

## Frontend

### New: Journal tab on MyPlantDetail
- Timeline view (newest first) showing all entry types
- Inline photo thumbnails, tap to expand
- "Add observation" button — text + photo upload
- Care log entries show task type icon + notes
- Status check entries prompt for status update

### Modified: Photo gallery
- Use thumbnails in grid, full image in lightbox
- Photos now associated with journal entries
