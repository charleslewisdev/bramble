# Bramble — Project Brief

## What Is It

Bramble is a self-hosted garden management, care, research, and planning application. It tracks every plant, zone, and care task across your entire property. It integrates with weather services, sun/daylight data, and property information to provide contextual care recommendations. It sends notifications through your preferred channels when your garden needs attention.

## Why Build It

Existing garden apps are either:
- Subscription SaaS ($5-10/mo) for basic features
- Single-purpose (just planning, just identification, just reminders)
- Mobile-only with no rich diagramming/mapping tools
- Not self-hostable
- Not AI-enabled for contextual advice

Bramble combines all of these into one self-hosted app that runs on your own hardware.

## Core Features

### Plant Inventory & Database
- Track all plants: species, cultivar, location, status, care needs
- Toxicity flags (dogs, cats, children)
- Growth stage tracking with photo history
- Searchable plant knowledgebase for research

### Zone & Property Management
- Interactive yard map / layout diagramming tool
- Named zones with sun exposure, soil type, microclimate data
- Container tracking with dimensions and placement
- Property structure awareness (lot size, orientation, buildings)

### Care Calendar & Notifications
- Seasonal/monthly care task calendar per plant and zone
- Automatic care reminders based on plant data + weather conditions
- Notification integrations:
  - Slack (webhook)
  - Discord (webhook)
  - Email (Gmail/SMTP)
  - Pushover
  - Ntfy (self-hostable)
  - Home Assistant (optional)

### Planning & Budgeting
- Project planning with phases and timelines
- Budget tracking by vendor, phase, and status
- Shopping lists with vendor info

### External Data Integrations
- Weather data (current + forecast)
- Sun position / daylight hours by location
- Frost date tracking
- Property information (lot dimensions, orientation)
- Plant database APIs for species research
- Periodic scraping to keep local database updated

### LLM Integration (Future)
- Anthropic API (Claude) for specifically-scoped features:
  - "What's wrong with my plant?" — photo + context analysis
  - "Update this plant's status based on this photo"
  - "What plants would go well in this zone?" — companion planting with context
  - "What should I do this week?" — natural language care summaries
- All core functionality is deterministic — LLM is augmentation, not dependency

## Tech Stack

- **Runtime**: Node.js 22, TypeScript (strict ESM)
- **Backend**: Express or Fastify, REST API
- **Database**: SQLite (Drizzle ORM or better-sqlite3)
- **Frontend**: React 19, Vite, Tailwind CSS
- **Deployment**: Docker on unRAID (self-hosted)
- **Future**: Anthropic SDK for LLM features

## Design Principles

1. **Self-hosted first** — runs on your hardware, your data stays local
2. **Deterministic core** — LLM features are optional augmentation
3. **Zone-based thinking** — garden beds/zones are first-class entities, not just individual plants
4. **Notification flexibility** — push to any service, not locked to a mobile app
5. **Data-rich** — integrate external sources to build a complete picture
6. **Dog/baby safe** — toxicity awareness is built into the data model, not an afterthought
