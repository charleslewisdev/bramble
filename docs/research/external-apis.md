# External APIs & Data Sources Research

Researched March 2026. All APIs were live-tested or verified operational unless noted otherwise.

---

## 1. Plant Database APIs

### Perenual API -- RECOMMENDED PRIMARY

| Detail | Value |
|--------|-------|
| **URL** | `https://perenual.com/api/` |
| **Docs** | https://www.perenual.com/docs/plant-open-api |
| **API Key** | Required (free registration) |
| **Free Tier** | 100 requests/day |
| **Data Format** | JSON |
| **Status** | Active, maintained |

**What it provides:**
- 10,000+ plant species with images
- Care data: watering, sunlight, growth rate, maintenance level
- Hardiness zones (species 1-3000 on free tier)
- Care guides & FAQ (species 1-3000 on free tier)
- Plant disease data (1-100+ on free tier)
- Plant identification API (AI-based, separate endpoint)

**Gotchas:**
- Free tier limits some endpoints to species ID 1-3000 only
- Hardiness map and care guides restricted to first 3000 species on free tier
- 100 requests/day is tight for bulk initial data loading -- need to cache aggressively
- Paid tiers: $19/mo (10K/day), $49/mo (100K/day)

**Verdict:** Best free option for structured plant care data. 100 req/day is fine for ongoing use after initial seed data is loaded. Plan to seed from source-data files first, use API for enrichment.

---

### Trefle API -- BACKUP / SUPPLEMENTARY

| Detail | Value |
|--------|-------|
| **URL** | `https://trefle.io/api/v1/` |
| **Docs** | https://docs.trefle.io/ |
| **API Key** | Required (free registration, get access token) |
| **Free Tier** | 60 requests/minute (no daily cap mentioned) |
| **Data Format** | JSON |
| **Status** | Operational but reliability concerns |

**What it provides:**
- 400K+ plant species (much larger dataset than Perenual)
- Scientific taxonomy (family, genus, species)
- Images categorized: flower, leaf, habit, fruit, bark
- Growth data: light (0-10 scale), soil adaptation, atmospheric humidity
- Native distribution, edibility, toxicity
- Synonyms, common names

**Gotchas:**
- Has had multiple outages/downtime periods historically (was down for extended period ~2021)
- GitHub issues show ongoing bugs reported through 2024-2025
- Rate limit is per-minute (60/min) not per-day, so bulk loading is feasible
- API responded with 401 on test (alive, needs valid token)
- Community/volunteer maintained -- no commercial backing

**Verdict:** Larger dataset but less reliable. Good supplementary source for taxonomy and distribution data. Don't depend on it as sole source.

---

### Flora API

| Detail | Value |
|--------|-------|
| **URL** | `https://api.floraapi.com/` |
| **Docs** | https://floraapi.com/ |
| **API Key** | Required (free registration, no credit card) |
| **Free Tier** | 1,000 requests/month |
| **Data Format** | JSON |
| **Status** | Active |

**What it provides:**
- 30,000+ US plant species
- County-level distribution data
- Native vs. invasive identification
- Conservation status (paid tier)
- Bloom timing by month (paid tier)

**Gotchas:**
- US-only plant data
- County-level distribution and conservation status locked behind $19/mo+ tiers
- 1,000/month is very limited
- Relatively new API

**Verdict:** Useful for US native/invasive status data. County-level distribution is unique but paywalled. Low priority.

---

### USDA Plants Database -- NO API

| Detail | Value |
|--------|-------|
| **URL** | https://plants.usda.gov/ |
| **API** | None (no official REST API) |
| **Status** | Website active, no programmatic access |

**What it provides (web only):**
- Comprehensive US plant data
- Distribution maps, characteristics, images
- Invasive/noxious status
- Wetland indicator status

**Gotchas:**
- No official API exists despite years of community requests (GitHub issue from 2017 still open)
- Third-party wrappers (e.g., `plantsdb.xyz`) are defunct
- R packages exist but aren't useful for a Node.js app
- Would require scraping (fragile, not recommended)

**Verdict:** Not usable as a programmatic data source. Reference only.

---

### OpenFarm -- DEAD

| Detail | Value |
|--------|-------|
| **URL** | https://openfarm.cc (was) |
| **Status** | **Shut down April 2025** |

OpenFarm servers were shut down in April 2025 after 10+ years. The codebase is archived on GitHub (read-only). Had excellent growing guide data (spacing, depth, watering, soil, companions) but is no longer available as a live API.

**Verdict:** Dead. Not usable. The GitHub data dump might be worth mining for seed data if the schema is compatible.

---

### Plant API Recommendation Summary

| Priority | API | Use Case |
|----------|-----|----------|
| **Primary** | Perenual | Care data, images, hardiness, diseases |
| **Secondary** | Trefle | Taxonomy, larger species coverage, toxicity |
| **Niche** | Flora API | US native/invasive status |
| **Dead** | OpenFarm | N/A (shut down) |
| **No API** | USDA Plants | Reference only |

---

## 2. Weather APIs

### Open-Meteo -- RECOMMENDED (STRONGLY)

| Detail | Value |
|--------|-------|
| **URL** | `https://api.open-meteo.com/v1/forecast` |
| **Docs** | https://open-meteo.com/en/docs |
| **API Key** | **Not required** |
| **Free Tier** | 10,000 calls/day (non-commercial) |
| **Data Format** | JSON |
| **Status** | Active, excellent, open source |

**What it provides:**
- Current weather conditions
- Hourly and daily forecasts (up to 16 days)
- 80 years of historical weather data
- Sunrise, sunset, daylight duration, sunshine duration
- Precipitation, humidity, wind, UV index, soil temperature/moisture
- Air quality data
- Marine weather
- Built-in geocoding endpoint
- Multiple weather models (NOAA GFS, ECMWF IFS, DWD ICON, etc.)

**Live test confirmed working** (Portland, OR):
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=45.50&longitude=-122.65
  &current=temperature_2m,precipitation
  &daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration
  &timezone=America/Los_Angeles
```

**Gotchas:**
- Non-commercial use only on free tier (Bramble is self-hosted personal use, so fine)
- No strict auth, but they ask for appropriate credit/attribution
- For >10K calls/day, subscription needed
- Sub-10ms response times in testing

**Verdict:** Perfect for Bramble. No API key, generous limits, excellent data coverage including sunrise/sunset/daylight (eliminates need for separate sun API). Open source. Already has Home Assistant integration.

---

### OpenWeatherMap -- NOT RECOMMENDED (inferior to Open-Meteo)

| Detail | Value |
|--------|-------|
| **URL** | `https://api.openweathermap.org/data/2.5/` |
| **API Key** | Required |
| **Free Tier** | 1,000 calls/day, 60 calls/minute |
| **Data Format** | JSON |
| **Status** | Active, commercial |

**What it provides:**
- Current weather, 5-day forecast (free)
- One Call API 3.0: 1,000 calls/day free (current + hourly + daily + alerts)
- Historical data (paid)
- Air pollution data
- Geocoding

**Gotchas:**
- Requires API key and account registration
- API 2.5 was deprecated/closed in 2024
- One Call 3.0 requires credit card on file (charges if you exceed 1K/day)
- Less data than Open-Meteo on free tier

**Verdict:** No reason to use this over Open-Meteo. More restrictive, requires key, credit card risk.

---

## 3. Geocoding

### Nominatim (OpenStreetMap) -- RECOMMENDED

| Detail | Value |
|--------|-------|
| **URL** | `https://nominatim.openstreetmap.org/search` |
| **API Key** | **Not required** |
| **Free Tier** | 1 req/second, ~2,500/day soft limit |
| **Data Format** | JSON, XML, GeoJSON |
| **Status** | Active, stable, well-maintained |

**Live test confirmed working** (returned exact property coordinates):
```
GET https://nominatim.openstreetmap.org/search
  ?q=123+Garden+St+Portland+OR
  &format=json&limit=1
  Headers: User-Agent: BrambleApp/1.0
```
Response: `lat: 45.5000000, lon: -122.6500000` (correct)

**Requirements:**
- Must set a custom `User-Agent` header (generic library defaults rejected)
- Must provide attribution to OpenStreetMap
- Max 1 request/second
- No bulk/batch geocoding on public instance

**Gotchas:**
- Rate limits are strict -- will block you if exceeded
- For Bramble this is perfect: we only need to geocode the property address once
- Can also do reverse geocoding (coordinates to address)
- Can self-host Nominatim for unlimited use

**Verdict:** Ideal. Bramble only needs one geocoding call ever (property setup). No API key needed, just a User-Agent header.

### Open-Meteo Geocoding -- ALTERNATIVE

Open-Meteo also includes a geocoding endpoint at `https://geocoding-api.open-meteo.com/v1/search`. City-level only (not street address), but useful as a fallback.

---

## 4. Sun Position / Daylight

### SunCalc (npm library) -- RECOMMENDED for sun position

| Detail | Value |
|--------|-------|
| **npm** | `suncalc` (v1.9.0) |
| **GitHub** | https://github.com/mourner/suncalc |
| **API Key** | N/A (local library, no network calls) |
| **Status** | Stable, mature, widely used |

**What it calculates from lat/lng + date:**
- Sun position (azimuth + altitude in radians)
- Sunlight phases: sunrise, sunset, solar noon, golden hour, dawn, dusk, nadir, night
- Moon position, illumination, rise/set times

**Key functions:**
- `SunCalc.getTimes(date, lat, lng)` -- all sun event times for a day
- `SunCalc.getPosition(date, lat, lng)` -- sun azimuth + altitude at specific time

**No dependencies.** Pure math based on astronomical formulas. Zero network calls.

**Also available:** `suncalc3` (enhanced fork with additional features)

### Open-Meteo -- RECOMMENDED for daylight duration

Open-Meteo provides `sunrise`, `sunset`, `daylight_duration`, and `sunshine_duration` in daily forecast data (confirmed working above). This means you don't need SunCalc for basic sunrise/sunset, but SunCalc is better for:
- Real-time sun position/azimuth (for shade mapping)
- Detailed solar phases (golden hour, civil twilight, etc.)
- Offline calculation without API calls

**Verdict:** Use both. Open-Meteo for daily sunrise/sunset in weather data. SunCalc for detailed sun position calculations (shade analysis, zone sun exposure mapping).

---

## 5. USDA Hardiness Zones

### phzmapi.org -- RECOMMENDED

| Detail | Value |
|--------|-------|
| **URL** | `https://phzmapi.org/{ZIPCODE}.json` |
| **API Key** | **Not required** |
| **Free Tier** | Static files, no rate limit concerns |
| **Data Format** | JSON |
| **Status** | Active |

**Live test confirmed working** (Portland 97000):
```json
{
  "zone": "9a",
  "temperature_range": "20 to 25",
  "coordinates": {"lat": "45.500000", "lon": "-122.650000"}
}
```

Built from the official 2023 USDA Plant Hardiness Zone Map data combined with ZIP location data. Static JSON files served per ZIP code -- essentially a CDN of pre-computed lookups.

**Gotchas:**
- ZIP code only (no coordinate-based lookup)
- US-only
- Not an official USDA service (community-maintained by waldoj/frostline)
- Data based on 2023 USDA map (most current available)

### Frostline (waldoj/frostline on GitHub)

The underlying dataset/parser behind phzmapi.org. Can be used to:
- Download GeoJSON shapefiles of all hardiness zones
- Build a local lookup from coordinates using point-in-polygon
- Self-host the API

**Verdict:** phzmapi.org is perfect for Bramble. One call at property setup to get the zone. Cache locally. For coordinate-based lookup, use the frostline GeoJSON with a point-in-polygon library.

---

## 6. Frost Date Data

### Best approach: Static dataset from NOAA Climate Normals

There is **no free, keyless frost date API**. Options:

**Option A: NOAA Climate Data Online (CDO) API**
- URL: `https://www.ncei.noaa.gov/cdo-web/api/v2/`
- API key required (free registration)
- Provides 30-year averages (1991-2020) from ~15,000 US weather stations
- Includes frost/freeze dates, growing degree days
- CSV/JSON responses
- Rate limit: 5 requests/second, 10,000/day

**Option B: Pre-computed dataset (RECOMMENDED)**
- Download NOAA Climate Normals frost date data once
- Store in SQLite as a lookup table (station -> avg first/last frost)
- Map property location to nearest station using coordinates
- Data source: https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals
- Available as bulk CSV download

**Option C: Scrape from web tools**
- almanac.com, garden.org, davesgarden.com all provide frost dates by ZIP
- Not recommended (fragile, ToS issues)

**Verdict:** Download NOAA Climate Normals frost/freeze data as a one-time bulk CSV import into SQLite. Map property to nearest weather station by distance. No ongoing API calls needed.

---

## Implementation Priority Matrix

| Priority | Integration | Approach | API Key? | Ongoing Calls? |
|----------|------------|----------|----------|----------------|
| **P0** | Weather | Open-Meteo | No | Yes (daily) |
| **P0** | Geocoding | Nominatim | No | One-time |
| **P0** | Hardiness Zone | phzmapi.org | No | One-time |
| **P0** | Sun Position | SunCalc (npm) | N/A | Local calc |
| **P1** | Plant Data | Perenual | Yes (free) | As needed |
| **P1** | Frost Dates | NOAA bulk CSV | No | One-time import |
| **P2** | Plant Taxonomy | Trefle | Yes (free) | As needed |
| **P3** | Native/Invasive | Flora API | Yes (free) | As needed |

---

## Architecture Notes for Bramble

1. **Cache everything.** Most external data changes rarely. Weather is the only frequent call.
2. **Seed from source-data first.** The 60+ plants in `docs/research/source-data/` should be the primary data source. APIs supplement and enrich.
3. **Graceful degradation.** All features must work offline. API data is enhancement only (per CLAUDE.md design principles).
4. **One-time setup calls.** Geocoding, hardiness zone, and frost dates only need to run during property setup. Store results in SQLite.
5. **Rate limit awareness.** Perenual at 100/day means bulk enrichment needs to be spread across days or done during initial setup with delays.
6. **Open-Meteo covers multiple needs.** Weather + sunrise/sunset + daylight duration + historical data -- one API, no key.
