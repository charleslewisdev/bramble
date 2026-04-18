# Almanac CRUD — Design

**Date:** 2026-04-17
**Scope:** Convert the Almanac from a hardcoded JSX link-grid + single CompostingGuide page into a full CRUD personal knowledge base, with tags, inline images, a markdown editor (MDXEditor), and MCP tools so Claude can author entries directly.

## Motivation

Today the Almanac is one route with a single 343-line JSX file (`web/src/pages/almanac/CompostingGuide.tsx`). Every new topic would require a code change. The user wants a living knowledge base: plans, notes, documentation — authored and edited inside the app, with data living in the same SQLite DB as the rest of Bramble.

## Decisions (validated with user)

- **Storage format:** Markdown. Portable, greppable, small rows, future-proof.
- **Editor:** MDXEditor — markdown under the hood, WYSIWYG-style toolbar (headings, bold, lists, tables, links, images, code blocks).
- **Organization:** Many-to-many tags. Sort index by `updated_at` desc. Tag pills at top of index filter the list.
- **Images:** Upload + serve locally, parallel to the existing `plant_photos` pattern. Referenced inside the markdown via stable URLs.
- **Image timing:** Stub-on-open — clicking "New Entry" immediately POSTs an `"Untitled"` stub so images can be uploaded before the first manual save.
- **MCP:** Full CRUD tools (`list_almanac_entries`, `get_almanac_entry`, `create_almanac_entry`, `update_almanac_entry`, `delete_almanac_entry`, `list_almanac_tags`). Image upload is REST-only (binary MCP is awkward).
- **Existing Composting content:** Seeded into the DB as the first entry with the `composting` tag. The hardcoded `CompostingGuide.tsx` is deleted.

## Data model

Four new tables. All integer PKs, cascade deletes.

```
almanac_entries
  id             integer pk autoincrement
  slug           text unique not null     -- url-safe, auto-derived from title; uniqued with -2/-3 suffix
  title          text not null
  excerpt        text                     -- short summary for index cards (optional)
  content        text not null default ""
  created_by     integer fk users.id
  created_at     text (iso)
  updated_at     text (iso)

almanac_tags
  id             integer pk
  name           text unique not null     -- lowercased, trimmed

almanac_entry_tags                        -- join
  entry_id       fk → almanac_entries (on delete cascade)
  tag_id         fk → almanac_tags     (on delete cascade)
  primary key    (entry_id, tag_id)

almanac_images
  id             integer pk
  entry_id       fk → almanac_entries (on delete cascade) not null
  filename       text not null
  mime_type      text not null
  size           integer not null
  created_at     text (iso)
```

Indexes: `almanac_entries.slug` (unique), `almanac_entry_tags.entry_id`, `almanac_entry_tags.tag_id`, `almanac_images.entry_id`.

Orphan tags (no entries) are cleaned on entry update/delete to keep the tag picker tidy.

## API

Prefix: `/api/almanac`. Auth: `requireAuth` on all routes; `requireRole("gardener")` on destructive operations (matches the project convention).

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/almanac`                | List entries. Optional `?tag=<name>` filter. Sort: `updated_at desc`. Returns `{ entries, tags }` where `tags` is the full set of tags with entry counts. |
| GET  | `/api/almanac/tags`           | List tags with counts. |
| GET  | `/api/almanac/:slug`          | Get single entry by slug (includes tags + images). |
| POST | `/api/almanac`                | Create. Accepts `{ title, content?, excerpt?, tags? }`. Auto-generates slug. Stub-on-open: title defaults to `"Untitled"`. |
| PATCH| `/api/almanac/:id`            | Update. Any subset of `title/content/excerpt/tags`. Changing title does NOT change slug (URL stability). Replaces tag set. |
| DELETE| `/api/almanac/:id`           | Delete (cascades to tags + images). |
| POST | `/api/almanac/:id/images`     | Upload image (base64, ≤10MB). Returns `{ id, url }` — the URL is a ready-to-insert markdown image link. |
| GET  | `/api/almanac/images/:filename` | Serve image bytes. Path-traversal guarded like `/api/photos/file/:filename`. |
| DELETE| `/api/almanac/images/:id`    | Delete image row + file. |

Slug generation: lowercase, spaces → hyphens, strip non-`[a-z0-9-]`, collapse repeats, trim hyphens. On collision, append `-2`, `-3`, etc.

## MCP tools

One-to-one with the above CRUD, minus images.

- `list_almanac_entries(tag?)` — returns `[{ id, slug, title, excerpt, tags, updated_at }]`
- `get_almanac_entry(slug)` — full entry including markdown content
- `create_almanac_entry({ title, content, excerpt?, tags? })`
- `update_almanac_entry({ id, title?, content?, excerpt?, tags? })`
- `delete_almanac_entry({ id })`
- `list_almanac_tags()` — returns `[{ name, count }]`

## Frontend

Routes in `App.tsx`:

- `/almanac`             → index page (grid of cards + tag pill filter)
- `/almanac/new`         → editor; POSTs stub on mount, then redirects to `/almanac/<slug>/edit`
- `/almanac/:slug`       → read view (rendered markdown)
- `/almanac/:slug/edit`  → editor loaded with the entry

Pages:

- `Almanac.tsx` (replace): fetch from API, render cards, tag filter pills, "New Entry" button.
- `AlmanacEntry.tsx` (new): read view. `react-markdown` + `remark-gfm` for tables/GFM. Edit/Delete buttons.
- `AlmanacEditor.tsx` (new): MDXEditor with plugins for headings, lists, tables, links, code blocks, and image upload (hooked to `/api/almanac/:id/images`). Debounced autosave.

Delete uses a confirmation dialog consistent with other destructive UI in the app.

`CompostingGuide.tsx` is deleted. Its route `/almanac/composting` is redirected to `/almanac/composting-guide` (the slug the seed will produce) — or just dropped; the index page is the new entry point.

## Dependencies added

- **Web:** `@mdxeditor/editor` (the editor), `react-markdown`, `remark-gfm` (read view).
- **Server:** none — reuses existing patterns.

## Migration & seeding

1. Drizzle migration creating all four tables + indexes.
2. Seed step (idempotent — checks for existing entry with slug `composting-guide`): inserts the current Composting content converted to markdown, tagged `composting`.

Markdown equivalent of CompostingGuide.tsx keeps the same seven sections, converts the two DataTables to GFM tables, and preserves the inline captions/notes as blockquotes.

## Testing

**Server (TDD):**
- Route tests in `server/src/routes/almanac.test.ts` following the in-memory-DB pattern used in `care-tasks.test.ts` / `shopping-list.test.ts`.
- Cover: create (slug generation, collision → suffix), list (with + without tag filter), get by slug, update (tag replace, no slug change on title edit), delete (cascade), auth (401 without session), role (403 for non-gardener delete).

**MCP:** smoke-test the tool schemas compile; actual HTTP is hit by the existing MCP integration path.

**Web:** editor-heavy; relies on manual verification in dev. Index + read view rendering verified in browser.

## Rollout

Single PR against `main`. Feature is additive except for the deleted CompostingGuide (which is recreated from the seed). No data migration for existing users since Almanac has no user data today.
