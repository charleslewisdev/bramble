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

## MCP Server (`mcp/`)

The `mcp/` package is a Model Context Protocol server that wraps the Bramble REST API, allowing AI tools (Claude.ai, etc.) to interact with the garden data.

### MCP Sync Rule

**When you add, remove, or change an API route in `server/src/routes/`, you MUST update the corresponding MCP tool in `mcp/src/index.ts`.** This includes:
- New endpoints → add a new `server.tool()` call
- Changed request/response shape → update the tool's schema and API call
- Removed endpoints → remove the corresponding tool
- New query parameters → add them to the tool's zod schema

The MCP tools are a 1:1 mapping of the API — `mcp/src/api.ts` contains the HTTP client functions and `mcp/src/index.ts` defines the tool schemas. Keep both in sync.

### Transports

**Stdio** (Claude Code / local): the `mcp/` package, no config needed
```bash
BRAMBLE_URL=http://10.0.0.4:3333 BRAMBLE_API_KEY=brk_... pnpm --filter bramble-mcp dev
```

**HTTP** (Claude.ai / remote connectors): mounted on the Fastify server at `/mcp`
- Same port as the API — no separate process or port
- Endpoint: `http://<host>:3000/mcp` (or whatever `PORT` is set to)
- Auth: DB-backed API keys (brk_ prefix) — same keys used for REST API and MCP
- `BRAMBLE_API_KEY` env var is used by MCP tools for internal API calls back to the REST API — the value must be a valid brk_ key from the DB
- **For Claude.ai access:** Use `mcp-auth-proxy` + Keycloak externally (see `docs/mcp-hosting-setup.md` and the `mcp-hosting` skill). Bramble does NOT implement OAuth — the proxy handles it.

### Tool files

- `mcp/src/tools.ts` — tool definitions (schemas + handlers)
- `mcp/src/api.ts` — HTTP client functions mapping to Bramble API routes
- `mcp/src/server.ts` — shared server factory (used by both stdio and Fastify)
- `mcp/src/index.ts` — stdio entry point (Claude Code local use)
- `server/src/plugins/mcp.ts` — Fastify plugin mounting MCP HTTP transport

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
