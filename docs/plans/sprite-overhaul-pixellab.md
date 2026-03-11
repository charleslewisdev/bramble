# Sprite & Tile Overhaul — PixelLab Generation Plan

> Reference doc for issue #12. Use this when starting the PixelLab generation session.

## Account Info

- **Plan**: Tier 1 Pixel Apprentice ($12/mo, ~2,000 images)
- **MCP server**: Already configured in Claude Code (`pixellab` via HTTP)
- **API token**: Stored in `.claude.json` (project-scoped)
- **Estimated budget usage**: ~$6-8 of $12 (plants + tiles + iteration)

## MCP Tools Available

| Tool | Purpose | Key Params |
|------|---------|------------|
| `create_map_object` | **Plant sprites** — single objects with transparent bg | description, width, height, view, outline, shading, detail, background_image |
| `create_topdown_tileset` | **Terrain tiles** — Wang tilesets with auto-transitions | lower_description, upper_description, transition_size, tile_size, view |
| `get_topdown_tileset` | Check tileset status + download PNG | tileset_id |
| `create_character` | Multi-direction characters (for animations) | description, n_directions, size, proportions |
| `animate_character` | Walk/idle/run animations on existing characters | character_id, template_animation_id |
| `get_map_object` / `get_character` | Check status + download base64 PNG | object_id / character_id |

### Which tool for what

- **Plant sprites**: `create_map_object` — single-view sprites with transparent backgrounds
- **Terrain tiles**: `create_topdown_tileset` — generates 16-23 Wang tiles with seamless transitions per tileset
- **House**: `create_map_object` — generate as a standalone object (no dedicated building tool)
- **Animations** (stretch goal): `create_character` + `animate_character`
- All tools are **non-blocking** — return job IDs, process in 15s-100s, poll with `get_*`

### How style reference works

The first sprite we generate and approve becomes the **style anchor** — not a template that gets reskinned, but an art direction reference. When passed as `background_image` to subsequent `create_map_object` calls, PixelLab's AI analyzes the frozen reference pixels and matches **colors, shading style, outline weight, and detail level** while generating a completely different object from the new prompt. Each plant type gets its own unique design that looks like it belongs in the same world.

For tiles, `create_topdown_tileset` supports chaining via `base_tile_id` — generate grass first, then use its base tile ID when generating soil, stone, etc. so all terrain types share a cohesive palette.

## Art Direction

### Style Goals
- **Tamagotchi-meets-garden**: Cute, character-like plants with personality
- **Consistent across all types**: Same outline weight, shading style, detail level, palette warmth
- **Readable at small sizes**: Must look good at 28px (sidebar) through 96px (detail page)
- **Transparent backgrounds**: All plant sprites on alpha, composited in app
- **Warm Stardew Valley palette**: Earthy, inviting terrain tiles

### Technical Specs — Plant Sprites
- **Canvas size**: 32x32 pixels (up from current 16x16)
- **View**: `high top-down` or `low top-down` — test both, pick one for all
- **Outline**: Single color black outline (retro pixel art feel)
- **Shading**: Basic to medium (not flat, not over-rendered)
- **Detail**: Medium
- **Background**: Transparent (always)

### Technical Specs — Terrain Tiles
- **Tile size**: 16x16 pixels (matches current TILE_SIZE; can test 32x32)
- **View**: `high top-down` (consistent with plant sprites)
- **Outline**: Lineless or selective (terrain shouldn't have heavy outlines)
- **Shading**: Basic to medium
- **Detail**: Medium

## Generation Plan

### Phase 1: Plant Style Exploration (~50 generations)

Generate flower sprites with varied prompts to nail the aesthetic:

```
Prompt experiments (vary one thing at a time):
- "cute pixel art flower in a pot, tamagotchi style, happy expression"
- "small pixel art flower character, chibi, kawaii garden plant"
- "pixel art potted flower with face, retro game style"
- "tiny cute flower sprite, green leaves, red petals, character personality"
```

Parameters to test:
- `view`: "high top-down" vs "low top-down" (front-facing may work better for personality)
- `detail`: "low" vs "medium" vs "high"
- `shading`: "flat" vs "basic" vs "detailed"
- Size: 32x32 (default target)

> **🔒 USER REVIEW GATE 1**: Present ~10 best results to user. User picks ONE sprite as style anchor. No further plant generation until approved.

### Phase 2: Tile Style Exploration (~20 generations)

Generate terrain tilesets to find the right ground aesthetic:

```
Tileset experiments:
- Grass base: "lush green grass, garden lawn" (lower) → "dark rich garden soil" (upper)
- Try transition_size: 0.0, 0.25, 0.5
- Try shading: "basic shading" vs "medium shading"
- Try 16x16 vs 32x32 tile sizes
```

> **🔒 USER REVIEW GATE 2**: Present tileset options. User picks terrain style. This sets the base_tile_id chain for all subsequent tilesets.

### Phase 3: Generate All 12 Base Plant Types (~100 generations)

Using the approved style anchor as `background_image`, generate ~8 attempts per type:

| # | Type | Prompt Direction | Notes |
|---|------|-----------------|-------|
| 1 | flower | Potted flower, red/pink petals, green leaves | Style anchor — already done in Phase 1 |
| 2 | shrub | Small bushy plant, rounded foliage mass | Dense leaf clusters |
| 3 | tree | Miniature tree, visible trunk + canopy | Classic lollipop or oak shape |
| 4 | herb | Small herb bunch, thin stems, leafy | Basil/parsley vibes |
| 5 | fern | Fern fronds, feathery leaves | Distinctive frond shape |
| 6 | succulent | Rosette succulent, thick fleshy leaves | Echeveria-like |
| 7 | cactus | Small barrel or columnar cactus | Optional flower on top |
| 8 | vine | Climbing vine on small trellis | Trailing tendrils |
| 9 | grass | Ornamental grass clump, tall blades | Fountain grass feel |
| 10 | bulb | Bulb plant with flower emerging from soil | Tulip/allium shape |
| 11 | vegetable | Tomato or veggie plant with visible fruit | Red fruit on green plant |
| 12 | fruit | Small fruit tree or berry bush | Visible berries/fruit |

> **🔒 USER REVIEW GATE 3**: Present best candidate for each of the 12 types. User approves the full set or requests re-rolls for specific types.

### Phase 4: Generate All Terrain Tilesets (~40 generations)

Using the approved grass tileset as the chain root, generate connected tilesets:

| # | Tileset | Lower Terrain | Upper Terrain | Transition | Use |
|---|---------|--------------|---------------|------------|-----|
| 1 | Grass base | (standalone) | — | — | Default ground, lawns |
| 2 | Grass → Soil | Grass (base_tile_id from #1) | Dark garden soil | 0.25 | Garden beds |
| 3 | Grass → Mulch | Grass | Dark mulch with wood chips | 0.25 | Mulched beds |
| 4 | Grass → Stone | Grass | Gray stone pavers | 0.5 | Patios, paths |
| 5 | Grass → Gravel | Grass | Loose gravel path | 0.25 | Gravel paths |
| 6 | Grass → Sidewalk | Grass | Concrete sidewalk | 0.5 | Street sidewalks |
| 7 | Grass → Water | Grass | Pond water | 0.5 | Bog garden |
| 8 | Grass → Wood | Grass | Wooden planks | 0.5 | Raised bed borders |

> **🔒 USER REVIEW GATE 4**: Present all tilesets. User approves or requests re-generation for specific terrain types.

### Phase 5: House & Structure Sprites (~30 generations)

Generate standalone map objects for structures:

| Object | Tool | Notes |
|--------|------|-------|
| House (top-down) | `create_map_object` | Multi-tile, ~64x48 or larger, hip roof |
| Pergola | `create_map_object` | Open wooden structure, semi-transparent beams |
| Gazebo | `create_map_object` | Pointed roof, open sides |
| Fence sections | `create_map_object` | Horizontal + vertical + corner pieces |
| Raised bed border | `create_map_object` | Wood frame, top-down view |

> **🔒 USER REVIEW GATE 5**: Present structure sprites. These are the most visible elements — user approves before integration.

### Phase 6: Species-Specific Variants (Optional, ~100 generations)

For plant types where the user has multiple species that should look distinct:

| Type | Species Variants Needed |
|------|------------------------|
| flower | Rose, Dahlia, Sunflower, Lavender, Hydrangea, Petunia |
| shrub | Boxwood, Azalea, Fothergilla, Lilac |
| tree | Japanese Maple, Redbud, Dogwood |
| herb | Rosemary, Basil, Mint |
| succulent | Echeveria, Sedum, Aloe |
| bulb | Tulip, Allium, Daffodil, Crocus |
| vine | Clematis, Honeysuckle, Wisteria |

These are **optional** — we can start with just the 12 base types and add species variants later. The `spriteType` field on plant references already maps multiple species to a single sprite type.

### Phase 7: Animations (Stretch Goal, ~50 generations)

If time/budget allows, generate 2-4 frame idle animations for each base type:
- Gentle sway for flowers, herbs, grasses
- Subtle leaf movement for trees, shrubs
- Slight bob for succulents, cacti

Use `create_character` → `animate_character` pipeline for this.

## Implementation Plan (After Asset Generation)

### Step 1: Save PNGs
- Create `web/public/sprites/plants/` directory for plant sprites
- Create `web/public/sprites/tiles/` directory for terrain tilesets
- Create `web/public/sprites/structures/` directory for house, pergola, etc.
- Plant sprites: `{plantType}.png` (e.g., `flower.png`, `shrub.png`)
- Species variants: `{plantType}-{species}.png` (e.g., `flower-rose.png`)
- Tilesets: `{terrain}.png` spritesheet + `{terrain}.json` metadata
- Structures: `{structure}.png` (e.g., `house.png`, `pergola.png`)

### Step 2: Update PlantSprite.tsx
- Replace hardcoded pixel arrays with `<img>` tags loading PNGs
- Keep mood tinting via CSS filters or canvas manipulation
- Keep mood overlays (sparkles, water drops, zzz) as SVG overlays on top of PNG
- Keep deterministic mood message system unchanged

### Step 3: Update sprite-textures.ts
- Load PNG textures instead of drawing with Graphics API
- Use PixiJS `Assets.load()` for texture loading
- Apply mood tinting via PixiJS `ColorMatrixFilter` or tint property
- Keep texture cache pattern

### Step 4: Update tiles.ts
- Replace procedural tile generation with tileset PNG loading
- Parse Wang tile metadata for autotile selection
- Keep seeded randomness for tile variant selection
- Map zone types → tileset terrain types

### Step 5: Update house-sprite.ts
- Replace procedural house drawing with PNG texture loading
- Keep roof type selection logic (map to different house PNGs if we generate variants)
- Keep shadow generation (or generate shadow as part of the sprite)

### Step 6: Palette Swapping for Bloom Colors
- Use canvas `ImageData` manipulation or the `palette-swap` npm package
- Define 4-6 bloom color palettes (red, blue, purple, yellow, pink, white)
- Map plant reference `bloomColor` field → palette variant
- One flower PNG + palette swap = multiple bloom colors at runtime

### Step 7: Remove Duplicated Pixel Data
- Delete all `SPRITE_DATA` objects from PlantSprite.tsx
- Delete `createPlantGraphics` pixel-drawing code from sprite-textures.ts
- Delete procedural tile generators from tiles.ts
- Delete procedural house drawing from house-sprite.ts
- Single source of truth: PNG files in `/sprites/`

### Step 8: Update Mapped Types
- `houseplant` → either own sprite or keep mapping to `flower`
- `groundcover` → either own sprite or keep mapping to `grass`
- `aquatic` → either own sprite or keep mapping to `fern`

## Current System Reference

### What to Preserve
- **Mood system**: 7 moods (happy, thirsty, cold, hot, wilting, sleeping, new)
- **Mood overlays**: Sparkles, water drops, heat waves, zzz text
- **Mood tinting**: Color shifts per mood (can switch from hex mapping to CSS/PixiJS filters)
- **Mood messages**: 4-6 messages per mood, deterministic hash selection
- **Size flexibility**: Used at 28px, 40px, 48px, 64px, 80px, 96px across the app
- **Garden map integration**: 16px base × 2.5 scale = 40px in-world (will become 32px × 1.25 = 40px)
- **Alpha states**: 0.75 for planned plants, 0.7 for sleeping
- **Map generation logic**: Zone positioning, collision avoidance, path generation, sidewalk painting
- **Seeded randomness**: Deterministic tile variation per coordinate

### What Changes
- 16×16 plant sprites → 32×32 PNG assets
- Code-generated pixels → PNG file assets (plants, tiles, structures)
- SVG rect rendering → `<img>` with CSS filters for mood
- Graphics API drawing → PixiJS Texture loading with tint filters
- Procedural tile patterns → Wang tileset PNGs with autotile selection
- Procedural house drawing → PNG texture(s)
- `PLANT_SPRITE_SCALE` changes from 2.5 to ~1.25 (to maintain ~40px in-world size)

### Key Files to Modify
- `web/src/components/sprites/PlantSprite.tsx` — main sprite component
- `web/src/components/garden-map/sprite-textures.ts` — PixiJS texture system
- `web/src/components/garden-map/tiles.ts` — tile generation → tile loading
- `web/src/components/garden-map/house-sprite.ts` — house generation → house loading
- `web/src/components/garden-map/map-generator.ts` — tileset integration, autotile logic
- `web/src/components/garden-map/GardenCanvas.tsx` — scale constants, texture loading

## Cost Summary

| Phase | Generations | Est. Cost |
|-------|------------|-----------|
| 1. Plant style exploration | ~50 | $0.40 |
| 2. Tile style exploration | ~20 | $0.30 |
| 3. Base plant types (12) | ~100 | $0.80 |
| 4. Terrain tilesets (8) | ~40 | $0.60 |
| 5. House & structures | ~30 | $0.45 |
| 6. Species variants (optional) | ~100 | $0.80 |
| 7. Animations (stretch) | ~50 | $0.70 |
| **Total** | **~390** | **~$4.05** |
| Buffer (iteration/re-rolls) | ~300 | $2.40 |
| **Grand total** | **~690** | **~$6.45** |

Well within the $12 plan. Cancel after first month.

## Session Workflow

1. Start Claude Code → PixelLab MCP tools should be available
2. Open this doc as reference
3. **Phase 1**: Generate plant style variations → present to user → lock style
4. **Phase 2**: Generate tile style variations → present to user → lock terrain style
5. **Phase 3**: Batch-generate all plant types with locked style → user review
6. **Phase 4**: Chain-generate all terrain tilesets → user review
7. **Phase 5**: Generate house & structures → user review
8. **Phase 6-7**: Optional species variants and animations
9. Save all approved PNGs to project
10. Wire assets into sprite/tile/map systems (implementation steps 1-8)
