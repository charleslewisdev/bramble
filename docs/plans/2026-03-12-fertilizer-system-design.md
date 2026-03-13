# Fertilizer System — Inventory-Lite with Composting Guide

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give users fertilizer guidance on care tasks, a simple inventory checklist in a new "Shed" page, contextual shopping list nudges, and a Composting Guide in a new "Almanac" section.

**Architecture:** New `fertilizers` table for inventory, new columns on `plant_references` for guidance, new "Shed" and "Almanac" nav sections. Passive nudge on care task detail when preferred fertilizer type is missing from inventory.

**Tech Stack:** Drizzle ORM (SQLite), Fastify routes, React + TanStack Query frontend

---

## Data Model

### New table: `fertilizers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | integer PK | autoincrement |
| `locationId` | FK → locations | scoped to location |
| `name` | text, required | e.g. "Fox Farm Big Bloom", "Rabbit poop compost" |
| `type` | enum | `liquid`, `granular`, `slow_release`, `compost`, `compost_tea`, `fish_emulsion`, `other` |
| `npkN` | real, nullable | Nitrogen value |
| `npkP` | real, nullable | Phosphorus value |
| `npkK` | real, nullable | Potassium value |
| `organic` | boolean | default false |
| `status` | enum | `have_it`, `running_low`, `out` |
| `notes` | text, nullable | Application tips, dilution ratios |
| `createdAt` | text | ISO timestamp |
| `updatedAt` | text | ISO timestamp |

Indexes: `locationId`.

### New columns on `plant_references`

| Column | Type | Notes |
|--------|------|-------|
| `fertilizerType` | same enum, nullable | Preferred fertilizer type |
| `fertilizerNpk` | text, nullable | Ideal ratio as string "10-10-10" |
| `fertilizerFrequency` | text, nullable | "Monthly during growing season" |
| `fertilizerNotes` | text, nullable | "Acid-loving, avoid alkaline" |

### Fertilizer type enum values

`liquid` | `granular` | `slow_release` | `compost` | `compost_tea` | `fish_emulsion` | `other`

---

## API Routes

### `GET /api/locations/:locationId/fertilizers` — list all
### `POST /api/locations/:locationId/fertilizers` — create
### `PUT /api/locations/:locationId/fertilizers/:id` — update
### `DELETE /api/locations/:locationId/fertilizers/:id` — delete

Standard CRUD. Scoped to location like zones and structures.

---

## Frontend

### Navigation Changes

Add two new top-level nav items:
- **Shed** — `/locations/:id/shed` — inventory page (fertilizers first, extensible later)
- **Almanac** — `/almanac` — reference guides (not location-scoped)

### Shed Page

- Tab-based layout, starting with a single "Fertilizers" tab (room for "Tools", "Soil" later)
- Fertilizer list as cards/rows showing: name, type badge, NPK (if set), organic badge, status pill (`have_it` green / `running_low` amber / `out` red)
- Add/edit modal with all fields
- Empty state: "Your shed is empty. Add fertilizers you own to get reminders when plants need feeding."

### Care Task Fertilize Nudge

When viewing a fertilize care task detail:
1. Look up the plant reference's `fertilizerType`
2. Query the user's fertilizer inventory for that type with `status !== 'out'`
3. If no match found, show inline note: "You don't have any [type] fertilizer — add to shopping list?"
4. One-tap adds a shopping list item with category "fertilizer" and the plant reference's fertilizer notes as the item name

### Almanac Page

- Simple list of guide cards, each linking to a detail page
- First guide: "Composting Guide" — `/almanac/composting`
- Guide content stored as a React component (not DB-driven) — it's curated reference material
- Styled consistently with the rest of the app (dark theme, Space Grotesk headings)

### Composting Guide Content

Sections:
1. **Compost vs. Fertilizer** — when to use which, or both
2. **Compost Types & NPK** — table of common types (finished compost, worm castings, rabbit manure, chicken manure, horse manure, mushroom compost) with approximate NPK ranges
3. **Rabbit Poop Compost** — cold compost properties, direct application, aging, benefits
4. **Compost Tea** — what it is, aerated vs non-aerated, how to make it, application methods
5. **Application Methods** — topdressing vs tilling in, how much to apply, timing
6. **Which Plants Love Compost** — heavy feeders, and plants to be careful with

---

## Care Task Generation Changes

Update `generateDefaultCareTasks()` in `care-tasks.ts`:
- Currently only generates fertilize tasks for plants with `bloomTime`
- Expand: if `fertilizerType` or `fertilizerFrequency` is set on the plant reference, generate a fertilize task with specific guidance
- Include `fertilizerNotes` in the task description
- Include NPK ratio and type in the `plantMessage` field for the tamagotchi personality

---

## Seed Data

### Fertilizer references on existing plants

Update the 15 pre-loaded plant references with appropriate fertilizer fields:
- Heavy feeders (roses, hydrangeas, blueberries): specific NPK and type
- Light feeders (succulents, native groundcovers): "No fertilizer needed" in notes
- Acid-loving plants: note about avoiding alkaline fertilizers

### Common fertilizer presets

No pre-populated inventory — the shed starts empty. But the "add fertilizer" modal could offer quick-fill presets for common products (stretch goal, not MVP).

---

## Out of Scope

- NPK matching algorithm (fuzzy "close enough" logic) — not needed for inventory-lite
- Auto-ordering fertilizer
- Soil testing integration
- Per-zone soil amendment tracking
- Seasonal NPK variation per plant (captured in `fertilizerNotes` text for now)
