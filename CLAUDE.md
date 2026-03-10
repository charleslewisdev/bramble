# Bramble

Self-hosted garden management, care, research, and planning app. Tracks plants, zones, care tasks, and property data. Integrates with weather services, sun/daylight APIs, and notification channels. Future LLM integration via Anthropic API for contextual plant advice.

## Tech Stack

- **Runtime**: Node.js 22, TypeScript (strict), ESM modules
- **Database**: SQLite via Drizzle ORM + better-sqlite3
- **Backend**: TBD (Express or Fastify)
- **Frontend**: React 19, Vite, Tailwind CSS, TanStack Query
- **Deployment**: Docker on unRAID, SQLite volume mount
- **Future**: Anthropic SDK for scoped LLM features

## Core Concepts

### Data Model (high-level)

- **Property** — lot dimensions, orientation, structure footprint, sun exposure patterns
- **Zone** — named garden areas (beds, side yards, containers) with microclimate data
- **Plant** — species, cultivar, latin name, care requirements, toxicity, status, photos
- **Care Task** — seasonal/monthly calendar entries tied to plants and zones
- **Budget Item** — vendor, price, status, phase
- **Safety Rating** — per-plant toxicity for dogs, cats, children

### Key Design Principles

1. **Self-hosted first** — runs on your hardware, data stays local
2. **Deterministic core** — LLM features are optional augmentation, not dependency
3. **Zone-based thinking** — garden beds/zones are first-class entities alongside plants
4. **Notification flexibility** — Slack, Discord, Email, Pushover, Ntfy, Home Assistant
5. **External data integration** — weather, sun position, frost dates, property info

### Notification Channels

Notifications are decoupled from the app — no mobile app needed:
- Slack (webhook)
- Discord (webhook)
- Email (Gmail/SMTP)
- Pushover
- Ntfy (self-hostable)
- Home Assistant (optional)

### LLM Integration (future)

Specifically-scoped Anthropic API integrations:
- "What's wrong with my plant?" — photo + context analysis
- "Update this plant's status based on this photo"
- "What plants would go well in this zone?" — companion planting with full context
- Natural language care summaries

All core app functionality works without LLM access.

### External Integrations

- Weather data (current + forecast) — free APIs
- Sun position / daylight hours by location
- Frost date tracking
- Property information (lot dimensions, orientation)
- Plant database APIs for species research
- Periodic scraping to keep local database updated

## Skill Directory

| Area | Skill | What it covers |
|------|-------|----------------|
| **Session start** | `start-session` | Branch context, plan docs, brain query |
| **Database** | Drizzle docs + `sqlite-raw-performance` | Schema design, query patterns |
| **Docker** | `docker-best-practices` | Container build, deployment to unRAID |
| **Git workflow** | `git-preferences` | Branch naming, commit conventions |
| **Frontend** | `frontend-design` | UI components, design quality |
| **Styling** | `tailwind-css-patterns` | Tailwind utilities and patterns |
| **Testing** | `vitest` | Test conventions |
| **Brain** | `brain-integration` | Persistent knowledge store |

## Development Lifecycle

### Starting a session

Run `/start-session` at the beginning of every session.

### Lifecycle Gates

**Before creating a PR:**
- All tests pass
- Lint clean
- TypeScript compiles: `npx tsc --noEmit`
- Self-review completed

## Project Structure

```
docs/
  design/          # Project brief, architecture decisions
  research/        # Competitive landscape, reference data
    source-data/   # Original files from garden planning sessions
```

## Reference Data

The `docs/research/source-data/` directory contains exported garden planning data (xlsx, html, docx) from Claude chat sessions. These files document:
- 60+ plants across all garden zones with full care details
- Interactive yard maps (SVG)
- Care calendars, toxicity references, budgets, shopping lists
- Bog garden concept, fruiting tree comparison

These serve as both seed data and requirements documentation for the data model.
