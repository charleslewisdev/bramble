# Garden Map — Interactive Pixel Art Property View

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full-page interactive pixel art map for each Location — a top-down RPG-style view where plants are living sprites with mood-driven animations, all rendered over an auto-generated tile map of the property.

**Architecture:** PixiJS v8 with @pixi/react for WebGL-accelerated tile rendering inside React. Property data (lot dimensions, zones, structures) auto-generates the tile map — no external editor needed. Plant sprites render as PixiJS textures converted from the existing SVG pixel data. React DOM overlays handle UI panels on sprite click. pixi-viewport provides pan/zoom.

**Tech Stack:** pixi.js v8, @pixi/react, pixi-viewport, existing React 19 + Vite 6 + TanStack Query

---

## Task 1: Install Dependencies

**Files:**
- Modify: `web/package.json`

**Steps:**
1. Install pixi.js, @pixi/react, pixi-viewport
2. Verify Vite dev server still starts

---

## Task 2: Route + Page Shell

**Files:**
- Modify: `web/src/App.tsx` — add route `/locations/:id/map`
- Modify: `web/src/components/layout/Sidebar.tsx` — (later, add Garden Map link)
- Create: `web/src/pages/GardenMap.tsx` — page shell with loading states

**Steps:**
1. Create GardenMap page that loads location + zones + structures + plants
2. Add route to App.tsx
3. Full-viewport layout (no sidebar padding on this page)

---

## Task 3: Tile System — Types, Colors, Patterns

**Files:**
- Create: `web/src/components/garden-map/tiles.ts`

**Steps:**
1. Define tile type enum: GRASS, SOIL, PATH, SIDEWALK, STRUCTURE, WATER, FENCE, EMPTY
2. Define color palettes per tile type (2-3 variations for visual variety)
3. Define 16x16 pixel patterns for each tile type
4. Function to generate a tile texture from a tile type + variation seed

---

## Task 4: Map Generator — Property Data → Tile Grid

**Files:**
- Create: `web/src/components/garden-map/map-generator.ts`

**Steps:**
1. Take location (lot dimensions), zones, structures, sidewalks as input
2. Calculate tile grid dimensions (1 tile = 1 foot, 16px per tile)
3. Fill base layer with GRASS
4. Paint sidewalks as SIDEWALK tiles
5. Paint structures as STRUCTURE tiles
6. Paint zones as SOIL tiles (garden beds)
7. Add FENCE borders around zones
8. Return 2D tile grid array

---

## Task 5: PixiJS Canvas Component

**Files:**
- Create: `web/src/components/garden-map/GardenCanvas.tsx`

**Steps:**
1. Create PixiJS Application inside React component
2. Wrap with pixi-viewport for pan/zoom/pinch
3. Handle resize (fill parent container)
4. Pixel-perfect rendering (image-rendering: pixelated, integer scaling)
5. Dark background matching app theme

---

## Task 6: Tile Map Renderer

**Files:**
- Create: `web/src/components/garden-map/TileMapLayer.tsx`

**Steps:**
1. Generate tile grid from property data
2. Create PixiJS textures for each tile type
3. Render tiles as sprites in a container
4. Optimize: batch tiles into a single render texture for static layer

---

## Task 7: Plant Sprite Textures

**Files:**
- Create: `web/src/components/garden-map/sprite-textures.ts`

**Steps:**
1. Port getPlantPixels() pixel data from PlantSprite.tsx to raw pixel arrays
2. Function: render 16x16 pixel data to an offscreen canvas
3. Apply mood tint colors (reuse moodTint logic)
4. Create PixiJS Texture from canvas
5. Cache textures by type+mood combo

---

## Task 8: Plant Sprite Placement

**Files:**
- Create: `web/src/components/garden-map/PlantSpriteLayer.tsx`

**Steps:**
1. For each plant instance with a zone, calculate world position within zone bounds
2. Distribute plants within zone area (grid layout within zone, avoiding overlap)
3. Render each plant as a PixiJS Sprite with its type+mood texture
4. Scale sprites appropriately for tile size (1.5-2x tile size so they stand out)
5. Set eventMode: 'static' for click handling

---

## Task 9: Click Interaction + Info Panel

**Files:**
- Create: `web/src/components/garden-map/PlantInfoPanel.tsx`
- Modify: `web/src/pages/GardenMap.tsx`

**Steps:**
1. On plant sprite click, emit plant ID to React state
2. Convert world coords to screen coords for panel positioning
3. Render React DOM overlay panel with plant details:
   - Nickname / common name
   - Status badge + mood message
   - Zone name
   - Last watered / next care task
   - Link to full plant detail page
4. Click elsewhere or press Escape to dismiss

---

## Task 10: Idle Animations

**Files:**
- Create: `web/src/components/garden-map/animations.ts`

**Steps:**
1. Gentle bounce animation for healthy plants (sine wave on Y position)
2. Swaying animation for trees/shrubs (slight rotation oscillation)
3. Sparkle particle effect for "happy" mood
4. Use PixiJS Ticker for animation loop
5. Randomize animation phase per plant so they don't all bounce in sync

---

## Task 11: Mood-Specific Visual Effects

**Files:**
- Modify: `web/src/components/garden-map/animations.ts`
- Modify: `web/src/components/garden-map/PlantSpriteLayer.tsx`

**Steps:**
1. Thirsty: blue droplet particles falling beside plant + slight wilt lean
2. Hot: orange heat shimmer particles rising
3. Cold: slight blue tint + shiver (rapid small x oscillation)
4. Wilting: brown tint + droopy lean + no bounce
5. Sleeping: reduced alpha + no animation + "zzz" text particles
6. New: green sparkle particles
7. Planned: ghost/transparent sprite with dashed outline

---

## Task 12: Zone Labels + Decorations

**Files:**
- Create: `web/src/components/garden-map/ZoneLabels.tsx`

**Steps:**
1. Render zone names as pixel-font text (PixiJS BitmapText or regular Text)
2. Position labels at top-center of each zone
3. Semi-transparent background behind text for readability
4. Zone border decoration (colored outline matching zone.color)

---

## Task 13: Map Controls HUD

**Files:**
- Create: `web/src/components/garden-map/MapHUD.tsx`

**Steps:**
1. Zoom in/out buttons (+ / -)
2. Recenter/fit-to-view button
3. Current zoom level indicator
4. Location name header
5. Weather widget (temperature + conditions icon)
6. Plant count + health summary
7. Toggle buttons: show/hide zone labels, show/hide zone borders
8. Back button (to location detail)
9. All rendered as React DOM overlays, not inside the canvas

---

## Task 14: Minimap

**Files:**
- Create: `web/src/components/garden-map/Minimap.tsx`

**Steps:**
1. Small overview of entire property in corner (150x100px)
2. Render as a scaled-down version of the tile map
3. Viewport rectangle indicator showing current view
4. Click on minimap to navigate
5. Semi-transparent background

---

## Task 15: Day/Night Ambient Overlay

**Files:**
- Create: `web/src/components/garden-map/AmbientOverlay.tsx`

**Steps:**
1. Use sun data API (sunrise/sunset) for current location
2. Calculate time-of-day tint:
   - Dawn: warm orange overlay, low opacity
   - Day: no overlay
   - Dusk: warm purple/orange overlay
   - Night: dark blue overlay, stars
3. Apply as a semi-transparent full-screen color filter
4. Optional toggle to disable

---

## Task 16: Entry Points + Navigation

**Files:**
- Modify: `web/src/pages/LocationDetail.tsx` — add "View Garden Map" button
- Modify: `web/src/pages/LocationList.tsx` — add map icon per location
- Modify: `web/src/components/layout/Sidebar.tsx` — add Garden Map nav if applicable

**Steps:**
1. Add prominent "Garden Map" button on LocationDetail page
2. Add map icon button on LocationList cards
3. Consider sidebar link for quick access

---

## Implementation Order

Tasks 1-2 (foundation) → Tasks 3-6 (tile map rendering) → Tasks 7-8 (plant sprites) → Task 9 (interactivity) → Tasks 10-11 (animations) → Tasks 12-13 (UI) → Tasks 14-15 (polish) → Task 16 (navigation)
