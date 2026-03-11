# Garden Map v2: Stardew Valley-Style Redesign

## Goal

Replace the current 1:1 foot-to-tile literal property rendering with a stylized, abstract RPG-style garden map inspired by Stardew Valley and Pokemon. The map should feel personal, charming, and alive — not like a blueprint.

## Architecture

Single scrollable/pannable PixiJS map with abstract tile grid. Zones are generously sized for visual appeal rather than spatially accurate. The house is a cute pixel art building centerpiece. Paths connect zones naturally. Weather, time of day, and seasonal wildlife animate the scene.

## Design Decisions

All confirmed during brainstorming session:

- **Style**: Stardew Valley / Pokemon RPG overworld (option A)
- **Navigation**: Single scrollable map, pan/zoom (option A)
- **Scale**: Completely abstract grid — zones sized for visual appeal, not real dimensions (option C)
- **House**: Pixel art building with roof, door, windows — ¾ perspective centerpiece (option A)
- **Environment**: Paths + natural transitions between zones, wildflowers/rocks in unused areas (option B, with option A props as future enhancement)
- **Special features**: Unique tile types per zone — pergola wood planks, container pots, patio stone, sidewalk concrete (option A)

## Schema Support (Implemented)

New zone fields:
- `zoneType`: bed | container | raised_bed | lawn | patio | path
- `climbingStructure`: trellis | arbor | pergola | wall_mount | fence (nullable)
- `hasPatio`: boolean — patio furniture present

New structure roof types:
- `pergola` | `gazebo` | `open` | `canopy` — light-permeable structures

## Map Layout Algorithm

Instead of 1 tile = 1 foot, the map generator should:

1. **Start with the house** as the visual center (~12x10 tiles for a 2-story house)
2. **Allocate zone tiles** based on relative importance/size, not real dimensions
   - Small zones (Rosemary Tree, Blue Ceramics): 4x4 to 6x6 tiles
   - Medium zones (Shade Garden, Bed 3, SW Corner): 6x6 to 8x8 tiles
   - Large zones (Front Bed, Tree Row, North Side Yard): 8x6 to 10x8 tiles
   - Use zone `width` and `depth` as relative hints, scaled to a common range
3. **Position zones** around the house based on their `posX`/`posY` relative positions
   - Zones with low posY = north of house, high posY = south
   - Zones with low posX = west, high posX = east
   - The algorithm places zones in the correct quadrant, not at exact coordinates
4. **Generate paths** (dirt/stone) between adjacent zones and from house door to nearest zone
5. **Fill gaps** with grass, wildflowers, rocks, and natural transitions

Target map size: ~60x50 tiles (vs current 56x76). Landscape orientation.

## House Rendering

Pixel art house sprite (not tile-painted):
- ¾ perspective: front face + roof visible
- 2-story hip roof rendered as a pre-built sprite/texture
- Door on the front face (facing compass orientation)
- 2-3 windows per floor
- Chimney detail
- Shadow cast to the appropriate side based on sun position

## Zone Tile Types

Each `zoneType` gets distinct ground tiles:

| zoneType | Ground Tiles | Visual |
|----------|-------------|--------|
| bed | Tilled soil, mulch | Dark brown, tilled rows |
| container | Stone/paver base | Gray stone with pot sprites on top |
| raised_bed | Wooden border + soil | Wood frame, raised soil inside |
| lawn | Clover/grass blend | Lighter green, clover patches |
| patio | Stone pavers | Gray/brown stone pattern |
| path | Dirt/gravel | Worn trail look |

## Climbing Structures

When a zone has `climbingStructure` set:
- **trellis**: Vertical lattice sprite behind plants, vines growing up
- **arbor**: Arched frame over zone entrance
- **pergola**: Overhead beam sprites (partially transparent) with vine overlay
- **wall_mount**: Vertical trellis against a wall/fence edge
- **fence**: Picket/wire fence border around zone

## Special Structure Rendering

Structures with light-permeable roof types:
- **pergola**: Wooden beam grid overhead, dappled shadow underneath, vine-covered if adjacent zone has `climbingStructure: "pergola"`
- **gazebo**: Octagonal/round canopy with pillars, visible seating if zone `hasPatio`
- **open**: Minimal posts with no roof
- **canopy**: Fabric/shade cloth look

When `hasPatio` is true on a zone, render small furniture sprites: table, chairs, bench.

## Weather & Ambient Effects

Pull from the existing weather API data already available to the map page:

### Current Weather Overlay
- **Rain**: Animated rain particle drops across the map, puddle sprites on paths
- **Snow**: Snowflake particles, white dusting on ground tiles
- **Overcast**: Slight gray tint overlay, dimmer colors
- **Sunny**: Golden light, lens flare particles, bright saturated colors
- **Windy**: Plant sprites sway more aggressively, leaf particles drift across

### Seasonal Palette
Based on current month:
- **Spring** (Mar-May): Bright greens, flower buds, cherry blossom particles
- **Summer** (Jun-Aug): Deep greens, full blooms, heat shimmer
- **Fall** (Sep-Nov): Amber/orange tint, falling leaf particles, some bare branches
- **Winter** (Dec-Feb): Muted palette, bare deciduous plants, frost effect on ground

### Day/Night Cycle
Already partially implemented via AmbientOverlay — enhance:
- Sunrise/sunset warm tints
- Night: firefly particles, dimmed colors, warm window glow from house
- Golden hour: warm orange wash

## Wildlife & Garden Friends

Animated critters that appear based on season, time of day, and weather. Data already exists in the app (Garden Visitors section on dashboard shows pollinators, birds, beneficial insects, amphibians).

### Critter Types (tiny pixel sprites, 8x8 or 12x12)
- **Butterflies**: Drift across map in spring/summer daytime. 2-3 frame wing animation.
- **Bees/bumblebees**: Hover near flowering zones. Tiny buzz path animation.
- **Hummingbirds**: Quick dart movements between flower zones. Hover animation.
- **Birds** (robin, goldfinch, bluebird): Sit on fence/trellis sprites, occasionally hop. Fly away on click.
- **Ladybugs**: Crawl slowly on zone edge tiles.
- **Toads**: Sit near moist/shaded zones at dusk. Occasional hop.
- **Fireflies**: Night-only, gentle glow pulse particles near zones.

### Spawn Rules
- Only spawn critters appropriate to current season + time
- Rainy weather: fewer flying critters, more toads
- Night: fireflies only, no daytime critters
- Density: 3-6 critters visible at once, spawn/despawn organically
- Don't block plant interaction — critters are non-interactive background decoration

## Plant Sprites

Keep existing mood-based sprites and animations but:
- Scale sprites to ~2-3 tiles tall (currently too small at 1:1 scale)
- Add shadow beneath each plant sprite
- Seasonal variants: deciduous plants lose leaves in winter, flowers bloom in appropriate months
- Container plants sit in visible pot sprites

## HUD Updates

Keep existing HUD (location bar, zoom controls, plant count) but add:
- Current weather icon + temp in top bar (already there)
- Season indicator
- Time of day indicator (sun position arc)
- Critter count ("3 visitors today")

## Implementation Priority

### Phase 1: Core Map Rewrite
1. Abstract layout algorithm (zone sizing + positioning)
2. New tile set (zone-type-aware ground tiles)
3. House sprite (¾ perspective pixel art)
4. Path generation between zones
5. Plant sprite scaling and shadows

### Phase 2: Weather & Atmosphere
6. Weather particle effects (rain, snow, wind, sun)
7. Seasonal palette shifting
8. Enhanced day/night cycle with house window glow

### Phase 3: Wildlife
9. Critter sprite sheets (butterfly, bee, bird, ladybug, toad, firefly)
10. Spawn/despawn system with season/time/weather rules
11. Simple movement AI (drift, hop, hover, crawl patterns)

### Phase 4: Polish & Props (Future)
12. Decorative props (garden hose, watering can, bird bath, etc.)
13. Climbing structure visual overlays
14. Furniture sprites for patio zones
15. Structure-specific rendering (pergola beams, gazebo canopy)
