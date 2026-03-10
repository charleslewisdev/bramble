# Bramble MVP Design

## Vision
Self-hosted garden management app with tamagotchi/pet-like personality. Plants are treated as little characters — they have nicknames, pixel art sprites, and speak in first person ("I'm thirsty!"). Inspired by PostHog's bold developer-friendly brand and pixel-agents aesthetic.

## Core Features (MVP)

### 1. Locations
- Users create one or more locations (home, community garden, etc.)
- Each location has: name, address (optional), lat/lng (geocoded or manual), timezone
- Auto-enrichment: hardiness zone, frost dates from coordinates
- Site profile: lot dimensions, compass orientation (manual input)
- Structures: buildings with footprint, height, stories, roof type (manual input)
- Renders a simple 2D preview from the entered data

### 2. Zones
- Named garden areas within a location
- Position on lot grid (origin point, width, depth)
- Attributes: sun exposure, soil type, moisture level, wind exposure, indoor flag
- Microclimate notes (free text)

### 3. Plant Reference Database
- Local-first SQLite database of plant species
- Fields: common name, latin name, cultivar, care requirements (sun, water, soil), hardiness zones, bloom time, mature size, growth habit
- Safety ratings: dogs, cats, children (safe/caution/toxic/highly toxic + notes)
- Source tracking (API origin or user-added)
- Search/browse interface
- API fallback: search external plant APIs if not in local DB, cache results

### 4. Plant Instances (My Plants)
- User's specific plants linked to reference + zone
- Nickname (the tamagotchi name!)
- Status: planned / planted / established / struggling / dormant / dead / removed
- Planted date, removed date
- Notes, photos with timestamps
- Container flag + description
- Pixel art sprite based on plant type + current mood/status
- First-person status messages ("I'm doing great!" / "I could use some water...")

### 5. Care Tasks
- Linked to plant instance, zone, or location
- Task types: water, fertilize, prune, mulch, harvest, protect, move, custom
- Schedule: one-off date or recurrence (interval + active months)
- Completion tracking (done/skipped log with timestamps)
- Future: condition-driven tasks from weather data

### 6. Shopping List
- Free-text items with quantity and checkbox
- Optional link to plant reference (pre-fills from "add to list" action)
- Optional notes field
- Simple, just a checklist

### 7. Dashboard
- What needs attention today/this week
- Plant mood overview (pixel sprites showing status)
- Weather summary for each location
- Upcoming care tasks
- Recently added plants

## Tech Stack
- **Runtime**: Node.js 22, TypeScript strict ESM
- **Package Manager**: pnpm workspaces
- **Backend**: Fastify + Drizzle ORM + better-sqlite3
- **Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query, React Router
- **Deployment**: Docker on unRAID
- **External APIs**: Open-Meteo (weather, no key), Nominatim (geocoding, no key), SunCalc (local calculation), plant DB APIs TBD

## Data Model

See schema.ts for full Drizzle schema. Core entities:
- Location, Structure, Zone
- PlantReference, PlantInstance, PlantPhoto
- CareTask, CareTaskLog
- ShoppingListItem
- NotificationChannel (future)
- WeatherCache

## UX Direction
- **Tamagotchi/pixel-pet personality** throughout
- Plants have moods, speak in first person
- Pixel art sprites for plant types (succulent, fern, flower, tree, herb, vine, cactus, grass, shrub, aquatic)
- PostHog-inspired bold design: strong colors, playful typography, personality in copy
- Dark mode as default (gardens apps are always bright green — we're different)
- Dense but not cluttered — show what matters now
- Zone-first navigation alongside plant list
- Glanceable safety indicators everywhere

## Project Structure
```
bramble/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── docker-compose.yml
├── Dockerfile
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Fastify app entry
│       ├── db/
│       │   ├── schema.ts        # Drizzle schema
│       │   ├── index.ts         # DB connection
│       │   ├── migrate.ts       # Migration runner
│       │   └── seed.ts          # Seed data
│       ├── routes/
│       │   ├── locations.ts
│       │   ├── zones.ts
│       │   ├── plants.ts
│       │   ├── care-tasks.ts
│       │   └── shopping-list.ts
│       └── services/
│           ├── geocoding.ts     # Nominatim
│           ├── weather.ts       # Open-Meteo
│           ├── sun.ts           # SunCalc local
│           └── plant-lookup.ts  # External plant DB search
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                 # TanStack Query hooks
│       ├── components/
│       │   ├── layout/
│       │   ├── plants/
│       │   ├── sprites/         # Pixel art plant sprites
│       │   └── ui/
│       ├── pages/
│       └── lib/
└── shared/                      # Shared types (future)
```
