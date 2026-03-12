# Map Enclosures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add property boundary fences, enclosure overlays for greenhouse/covered zones, and a unified "peek" interaction to view indoor/enclosed plants on the garden map.

**Architecture:** Procedural overlays rendered via PixiJS Graphics API on a new layer between zones and plants. Peek state managed as React state in GardenCanvas, with 300ms alpha fade transitions. Property fences painted as tile types in map-generator.

**Tech Stack:** PixiJS 8, React 19, TypeScript

---

### Task 1: Property boundary fences

Paint fence tiles around the map perimeter so every location has a property border.

**Files:**
- Modify: `web/src/components/garden-map/map-generator.ts`
- Test: `web/src/components/garden-map/map-generator.test.ts`

**Context:**
- Map grid is 38x32 tiles with `padding=2`
- Fence tile types already exist: `TileType.FENCE_H`, `FENCE_V`, `FENCE_CORNER`
- Fences should be painted just inside the padding boundary (at row/col index `padding` and `mapWidth/Height - padding - 1`)
- Skip tiles that are already sidewalk, zone, or path tiles
- The `generateMap` function in `map-generator.ts` is the main entry point — add fence painting after paths and sidewalks (around line 658)

**Step 1: Write failing test**

Create `web/src/components/garden-map/map-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateMap } from "./map-generator";
import { TileType } from "./tiles";
import type { Location, Structure, Zone } from "../../api";

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 1,
    name: "Test",
    address: null,
    latitude: 45.5,
    longitude: -122.6,
    timezone: "America/Los_Angeles",
    hardinessZone: null,
    lastFrostDate: null,
    firstFrostDate: null,
    lotBoundary: null,
    lotWidth: 50,
    lotDepth: 70,
    compassOrientation: 90,
    sidewalks: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function makeStructure(overrides: Partial<Structure> = {}): Structure {
  return {
    id: 1,
    locationId: 1,
    name: "House",
    posX: 10,
    posY: 10,
    width: 30,
    depth: 32,
    height: 22,
    stories: 2,
    roofType: "hip",
    createdAt: "",
    ...overrides,
  };
}

describe("generateMap", () => {
  describe("property boundary fences", () => {
    it("places fence tiles around the map perimeter", () => {
      const map = generateMap(makeLocation(), [makeStructure()], []);
      const padding = 2;
      const fenceRow = padding;
      const fenceRowBottom = map.height - padding - 1;
      const fenceColLeft = padding;
      const fenceColRight = map.width - padding - 1;

      // Top-left corner should be a fence corner
      expect(map.tiles[fenceRow]![fenceColLeft]!.type).toBe(TileType.FENCE_CORNER);
      // Top edge (not corners) should be horizontal fence
      expect(map.tiles[fenceRow]![fenceColLeft + 1]!.type).toBe(TileType.FENCE_H);
      // Left edge (not corners) should be vertical fence
      expect(map.tiles[fenceRow + 1]![fenceColLeft]!.type).toBe(TileType.FENCE_V);
      // Bottom-right corner
      expect(map.tiles[fenceRowBottom]![fenceColRight]!.type).toBe(TileType.FENCE_CORNER);
    });

    it("does not overwrite zone tiles with fences", () => {
      const zone: Zone = {
        id: 1,
        locationId: 1,
        name: "Edge Bed",
        description: null,
        zoneType: "bed",
        climbingStructure: null,
        hasPatio: false,
        posX: 0,
        posY: 0,
        width: 10,
        depth: 10,
        sunExposure: "full_sun",
        soilType: null,
        moistureLevel: null,
        windExposure: null,
        isIndoor: false,
        exposure: "outdoor",
        notes: null,
        notifyWater: null,
        notifyFertilize: null,
        notifyPrune: null,
        notifyRepot: null,
        notifyInspect: null,
        notifyProtect: null,
        color: "#4ade80",
        createdAt: "",
        updatedAt: "",
      };
      const map = generateMap(makeLocation(), [makeStructure()], [zone]);

      // Any tile that belongs to the zone should NOT be overwritten by fence
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const cell = map.tiles[y]![x]!;
          if (cell.zoneId === 1) {
            expect([TileType.FENCE_H, TileType.FENCE_V, TileType.FENCE_CORNER]).not.toContain(cell.type);
          }
        }
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && pnpm --filter web test src/components/garden-map/map-generator.test.ts`
Expected: FAIL — no fence tiles are painted yet

**Step 3: Implement fence painting**

In `map-generator.ts`, add a `paintPropertyFence` function and call it after sidewalks in `generateMap`:

```typescript
function paintPropertyFence(
  tiles: TileCell[][],
  mapWidth: number,
  mapHeight: number,
  padding: number,
): void {
  const top = padding;
  const bottom = mapHeight - padding - 1;
  const left = padding;
  const right = mapWidth - padding - 1;

  // Helper: only paint if tile isn't already a zone tile or sidewalk
  const canPaint = (x: number, y: number): boolean => {
    const cell = tiles[y]?.[x];
    if (!cell) return false;
    if (cell.zoneId) return false;
    if (cell.type === TileType.SIDEWALK) return false;
    return true;
  };

  // Corners
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: left, y: bottom },
    { x: right, y: bottom },
  ];
  for (const c of corners) {
    if (canPaint(c.x, c.y)) {
      tiles[c.y]![c.x] = {
        type: TileType.FENCE_CORNER,
        seed: hashCoord(c.x, c.y),
      };
    }
  }

  // Top and bottom edges (horizontal fences, skip corners)
  for (let x = left + 1; x < right; x++) {
    if (canPaint(x, top)) {
      tiles[top]![x] = { type: TileType.FENCE_H, seed: hashCoord(x, top) };
    }
    if (canPaint(x, bottom)) {
      tiles[bottom]![x] = { type: TileType.FENCE_H, seed: hashCoord(x, bottom) };
    }
  }

  // Left and right edges (vertical fences, skip corners)
  for (let y = top + 1; y < bottom; y++) {
    if (canPaint(left, y)) {
      tiles[y]![left] = { type: TileType.FENCE_V, seed: hashCoord(left, y) };
    }
    if (canPaint(right, y)) {
      tiles[y]![right] = { type: TileType.FENCE_V, seed: hashCoord(right, y) };
    }
  }
}
```

Add call in `generateMap` after the sidewalk painting block (~line 665):

```typescript
  // Paint property boundary fence
  paintPropertyFence(tiles, mapWidth, mapHeight, padding);
```

**Step 4: Run tests**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && pnpm --filter web test src/components/garden-map/map-generator.test.ts`
Expected: PASS

**Step 5: Run all tests to verify no regressions**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
cd /home/carrot/code/bramble/.worktrees/map-enclosures
git add web/src/components/garden-map/map-generator.ts web/src/components/garden-map/map-generator.test.ts
git commit -m "feat: property boundary fences around map perimeter"
```

---

### Task 2: House interior floor texture

Add a procedural floor tile type for the house interior view. This is a warm wood floor pattern that will fill the house footprint when peeked.

**Files:**
- Modify: `web/src/components/garden-map/tiles.ts`
- Test: `web/src/components/garden-map/tiles.test.ts`

**Context:**
- Tile generation uses the `generateTilePattern` function which returns a 256-element array of hex color strings
- The existing `RAISED_BED_WOOD` type has a horizontal plank pattern — the floor should be different (more refined, lighter warm tones)
- Add as `FLOOR_WOOD` tile type

**Step 1: Add the tile type to the enum and pattern generator**

In `tiles.ts`, add to `TileType` enum:
```typescript
  // Interior
  FLOOR_WOOD = "floor_wood",
```

Add floor colors to COLORS:
```typescript
  // Interior floor
  floorWood1: "#c4a882",
  floorWood2: "#b89c76",
  floorWood3: "#d4b892",
  floorGrain: "#a88c66",
```

Add case to `generateTilePattern`:
```typescript
    case TileType.FLOOR_WOOD: {
      // Warm hardwood floor — horizontal planks with subtle grain
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const plankIndex = Math.floor(y / 4);
          const isJoint = y % 4 === 0;
          const isGrain = (x + plankIndex * 5) % 8 === 0;
          if (isJoint) {
            pixels[y * TILE_SIZE + x] = COLORS.floorGrain;
          } else if (isGrain) {
            pixels[y * TILE_SIZE + x] = COLORS.floorWood3;
          } else {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x) > 0.5 ? COLORS.floorWood1 : COLORS.floorWood2;
          }
        }
      }
      break;
    }
```

**Step 2: Add test**

In `tiles.test.ts`, add:
```typescript
  it("generates floor_wood pattern", () => {
    const pixels = generateTilePattern(TileType.FLOOR_WOOD, 0);
    expect(pixels).toHaveLength(256);
    // Should have no transparent pixels (solid floor)
    expect(pixels.filter(p => p === "transparent")).toHaveLength(0);
  });
```

**Step 3: Run tests**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && pnpm --filter web test src/components/garden-map/tiles.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add web/src/components/garden-map/tiles.ts web/src/components/garden-map/tiles.test.ts
git commit -m "feat: add FLOOR_WOOD tile type for house interior"
```

---

### Task 3: Enclosure overlay module

Create a module that draws enclosure overlays (greenhouse glass, covered roof, house floor) as PixiJS Graphics/Containers. This keeps GardenCanvas clean.

**Files:**
- Create: `web/src/components/garden-map/enclosure-overlays.ts`

**Context:**
- Greenhouse overlay: Semi-transparent green-tinted glass fill with visible frame lines on the zone edges
- Covered overlay: Pergola beam pattern drawn as horizontal lines with subtle shading
- House floor: Container of floor tile sprites filling the house footprint
- All overlays return a `Container` that can be added to the viewport and have its alpha animated

**Step 1: Create the module**

```typescript
/**
 * Enclosure overlay rendering for greenhouse, covered, and indoor zones.
 * Returns PixiJS Containers that can be alpha-animated for the peek interaction.
 */

import { Container, Graphics, Sprite, Texture, CanvasSource } from "pixi.js";
import { TILE_SIZE, TileType, generateTilePattern, renderTileToCanvas } from "./tiles";

// ---- Glass colors ----

const GLASS = {
  fill: 0x88ccaa,
  fillAlpha: 0.3,
  frame: 0x667766,
  frameAlpha: 0.7,
  paneLineAlpha: 0.25,
};

const COVERED = {
  beam: 0x8a6a4a,
  beamDark: 0x6a4a2a,
  beamAlpha: 0.55,
  shadow: 0x000000,
  shadowAlpha: 0.08,
};

/**
 * Create a greenhouse glass overlay for a zone area.
 * Semi-transparent green-tinted fill with frame lines and glass pane dividers.
 */
export function createGreenhouseOverlay(
  x: number,
  y: number,
  w: number,
  h: number,
): Container {
  const container = new Container();
  container.label = "greenhouse-overlay";

  const g = new Graphics();

  // Glass fill
  g.rect(x, y, w, h);
  g.fill({ color: GLASS.fill, alpha: GLASS.fillAlpha });

  // Frame border
  g.rect(x, y, w, h);
  g.stroke({ width: 2, color: GLASS.frame, alpha: GLASS.frameAlpha });

  // Glass pane dividers (vertical lines every ~24px, horizontal every ~24px)
  const paneSpacingX = Math.max(16, Math.floor(w / Math.max(2, Math.floor(w / 24))));
  const paneSpacingY = Math.max(16, Math.floor(h / Math.max(2, Math.floor(h / 24))));

  for (let px = x + paneSpacingX; px < x + w; px += paneSpacingX) {
    g.moveTo(px, y);
    g.lineTo(px, y + h);
    g.stroke({ width: 1, color: GLASS.frame, alpha: GLASS.paneLineAlpha });
  }
  for (let py = y + paneSpacingY; py < y + h; py += paneSpacingY) {
    g.moveTo(x, py);
    g.lineTo(x + w, py);
    g.stroke({ width: 1, color: GLASS.frame, alpha: GLASS.paneLineAlpha });
  }

  // Corner posts (thicker)
  const postSize = 3;
  g.rect(x, y, postSize, postSize);
  g.rect(x + w - postSize, y, postSize, postSize);
  g.rect(x, y + h - postSize, postSize, postSize);
  g.rect(x + w - postSize, y + h - postSize, postSize, postSize);
  g.fill({ color: GLASS.frame, alpha: GLASS.frameAlpha });

  container.addChild(g);
  return container;
}

/**
 * Create a covered zone roof overlay (pergola beams from above).
 * Horizontal beam lines with subtle shadow underneath.
 */
export function createCoveredOverlay(
  x: number,
  y: number,
  w: number,
  h: number,
): Container {
  const container = new Container();
  container.label = "covered-overlay";

  const g = new Graphics();

  // Shadow fill
  g.rect(x, y, w, h);
  g.fill({ color: COVERED.shadow, alpha: COVERED.shadowAlpha });

  // Horizontal beams every ~12px
  const beamSpacing = 12;
  const beamHeight = 3;
  for (let py = y; py < y + h; py += beamSpacing) {
    g.rect(x, py, w, beamHeight);
    g.fill({ color: COVERED.beam, alpha: COVERED.beamAlpha });
    // Dark edge on bottom of beam
    g.rect(x, py + beamHeight - 1, w, 1);
    g.fill({ color: COVERED.beamDark, alpha: COVERED.beamAlpha });
  }

  // Support posts at corners
  const postW = 3;
  const postH = h;
  g.rect(x, y, postW, postH);
  g.rect(x + w - postW, y, postW, postH);
  g.fill({ color: COVERED.beamDark, alpha: COVERED.beamAlpha + 0.1 });

  container.addChild(g);
  return container;
}

// ---- Floor texture cache ----
let floorTexture: Texture | null = null;

function getFloorTexture(): Texture {
  if (floorTexture) return floorTexture;
  const pixels = generateTilePattern(TileType.FLOOR_WOOD, 0);
  const canvas = renderTileToCanvas(pixels);
  const source = new CanvasSource({
    resource: canvas,
    resolution: 1,
    scaleMode: "nearest",
  });
  floorTexture = new Texture({ source });
  return floorTexture;
}

/**
 * Create a house interior floor container — warm wood tiles filling the house footprint.
 * Starts hidden (alpha 0), faded in during peek.
 */
export function createHouseFloor(
  houseArea: { x: number; y: number; w: number; h: number },
): Container {
  const container = new Container();
  container.label = "house-floor";
  container.alpha = 0;

  const texture = getFloorTexture();

  for (let dy = 0; dy < houseArea.h; dy++) {
    for (let dx = 0; dx < houseArea.w; dx++) {
      const sprite = new Sprite(texture);
      sprite.x = (houseArea.x + dx) * TILE_SIZE;
      sprite.y = (houseArea.y + dy) * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      container.addChild(sprite);
    }
  }

  // Wall outline around the floor
  const wallOutline = new Graphics();
  const wx = houseArea.x * TILE_SIZE;
  const wy = houseArea.y * TILE_SIZE;
  const ww = houseArea.w * TILE_SIZE;
  const wh = houseArea.h * TILE_SIZE;
  wallOutline.rect(wx, wy, ww, wh);
  wallOutline.stroke({ width: 2, color: 0x8a7a6a, alpha: 0.8 });
  container.addChild(wallOutline);

  return container;
}

/**
 * Clear cached floor texture (for cleanup).
 */
export function clearEnclosureCache(): void {
  if (floorTexture) {
    floorTexture.destroy(true);
    floorTexture = null;
  }
}
```

**Step 2: Commit**

```bash
git add web/src/components/garden-map/enclosure-overlays.ts
git commit -m "feat: enclosure overlay module — greenhouse, covered, floor"
```

---

### Task 4: Peek state and fade utility

Add peek state management and a reusable fade utility to GardenCanvas.

**Files:**
- Modify: `web/src/components/garden-map/GardenCanvas.tsx`

**Context:**
- State: `openEnclosure: null | 'house' | number` — which enclosure is peeked open
- Fade: Simple utility that lerps container/sprite alpha toward a target over ~300ms
- The fade runs inside the existing ticker callback (no separate requestAnimationFrame)
- Need refs for: house sprite, floor container, enclosure overlay containers, indoor plant container
- Need a ref for enclosure hit areas (house bounds + enclosed zone bounds) for click detection

**Step 1: Add state, refs, and fade tracking**

Add these imports at the top of GardenCanvas.tsx:
```typescript
import {
  createGreenhouseOverlay,
  createCoveredOverlay,
  createHouseFloor,
  clearEnclosureCache,
} from "./enclosure-overlays";
```

Add state and refs inside the component:
```typescript
const [openEnclosure, setOpenEnclosure] = useState<null | "house" | number>(null);
const openEnclosureRef = useRef<null | "house" | number>(null);

// Keep ref in sync with state (state for React rendering, ref for ticker access)
useEffect(() => {
  openEnclosureRef.current = openEnclosure;
}, [openEnclosure]);

// Enclosure rendering refs
const houseSpriteRef = useRef<Sprite | null>(null);
const houseFloorRef = useRef<Container | null>(null);
const indoorPlantContainerRef = useRef<Container | null>(null);
const enclosureOverlaysRef = useRef<Map<number, Container>>(new Map());

// Fade targets: key → target alpha
const fadeTargetsRef = useRef<Map<string, { current: { alpha: number }; target: number }>>(new Map());
```

Add fade utility function inside the component:
```typescript
/** Register an object for smooth alpha fading */
function registerFade(key: string, obj: { alpha: number }, target: number) {
  fadeTargetsRef.current.set(key, { current: obj, target });
}

/** Update all active fades — call from ticker. Returns true if any fade is active. */
function updateFades(dt: number): boolean {
  const FADE_SPEED = 4; // ~300ms for full 0→1 transition at 60fps
  let anyActive = false;
  for (const [key, fade] of fadeTargetsRef.current) {
    const diff = fade.target - fade.current.alpha;
    if (Math.abs(diff) < 0.01) {
      fade.current.alpha = fade.target;
      fadeTargetsRef.current.delete(key);
    } else {
      fade.current.alpha += diff * Math.min(FADE_SPEED * dt, 1);
      anyActive = true;
    }
  }
  return anyActive;
}
```

**Step 2: Commit**

```bash
git add web/src/components/garden-map/GardenCanvas.tsx
git commit -m "feat: peek state management and fade utility"
```

---

### Task 5: Render enclosure overlays and house floor in buildScene

Integrate the overlay rendering into the scene build. Add overlays for greenhouse/covered zones on a new layer. Add house floor container (hidden). Render indoor plants (hidden).

**Files:**
- Modify: `web/src/components/garden-map/GardenCanvas.tsx`

**Context:**
- Indoor zones are currently filtered OUT of mapZones (line 191). We still need them for indoor plant rendering.
- Add Layer 2.5 (house floor, below house sprite) and Layer 3.5 (enclosure overlays, above zones, below plants)
- Indoor plants go in a separate container that's hidden by default
- House sprite needs to be saved to a ref for peek toggling

**Step 1: Modify buildScene**

After the house sprite creation (Layer 2), add floor:
```typescript
    // ---- LAYER 2.5: House interior floor (hidden, shown on peek) ----
    if (map.houseArea) {
      const floor = createHouseFloor(map.houseArea);
      viewport.addChild(floor);
      houseFloorRef.current = floor;

      // Save house sprite ref for peek
      if (houseSprite) {
        houseSpriteRef.current = houseSprite;
      }
    }
```

After zone borders (Layer 3), add enclosure overlays:
```typescript
    // ---- LAYER 3.5: Enclosure overlays (greenhouse/covered) ----
    const enclosureContainer = new Container();
    enclosureContainer.label = "enclosures";
    const overlayMap = new Map<number, Container>();

    for (const zone of mapZones) {
      if (zone.exposure !== "greenhouse" && zone.exposure !== "covered") continue;
      const zoneArea = map.zoneAreas.get(zone.id);
      if (!zoneArea) continue;

      const zx = zoneArea.x * TILE_SIZE;
      const zy = zoneArea.y * TILE_SIZE;
      const zw = zoneArea.w * TILE_SIZE;
      const zh = zoneArea.h * TILE_SIZE;

      const overlay = zone.exposure === "greenhouse"
        ? createGreenhouseOverlay(zx, zy, zw, zh)
        : createCoveredOverlay(zx, zy, zw, zh);

      enclosureContainer.addChild(overlay);
      overlayMap.set(zone.id, overlay);
    }

    viewport.addChild(enclosureContainer);
    enclosureOverlaysRef.current = overlayMap;
```

After plant sprites (Layer 5), add indoor plant container:
```typescript
    // ---- LAYER 5.5: Indoor plants (hidden, shown on house peek) ----
    const indoorPlants = plants.filter(p => p.zoneId && indoorZoneIds.has(p.zoneId));
    if (indoorPlants.length > 0 && map.houseArea) {
      const indoorContainer = new Container();
      indoorContainer.label = "indoor-plants";
      indoorContainer.alpha = 0;

      // Use house area as a virtual zone for plant positioning
      const housePixelX = map.houseArea.x * TILE_SIZE;
      const housePixelY = map.houseArea.y * TILE_SIZE;
      const housePixelW = map.houseArea.w * TILE_SIZE;
      const housePixelH = map.houseArea.h * TILE_SIZE;

      const PLANT_SLOT_SIZE = 36;
      const inset = TILE_SIZE * 0.5;
      const innerW = Math.max(housePixelW - inset * 2, PLANT_SLOT_SIZE);
      const innerH = Math.max(housePixelH - inset * 2, PLANT_SLOT_SIZE);
      const cols = Math.max(1, Math.floor(innerW / PLANT_SLOT_SIZE));
      const rows = Math.max(1, Math.floor(innerH / PLANT_SLOT_SIZE));
      const maxSlots = cols * rows;
      const visibleCount = Math.min(indoorPlants.length, maxSlots);
      const cellW = innerW / cols;
      const cellH = innerH / rows;

      for (let i = 0; i < visibleCount; i++) {
        const plant = indoorPlants[i]!;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const pos = {
          x: housePixelX + inset + cellW * (col + 0.5),
          y: housePixelY + inset + cellH * (row + 0.5),
        };
        await addPlantAtPosition(plant, pos, indoorContainer);
      }

      viewport.addChild(indoorContainer);
      indoorPlantContainerRef.current = indoorContainer;
    }
```

**Step 2: Add cleanup for new refs**

In the buildScene cleanup block (top of function) and the useEffect cleanup, add:
```typescript
    houseSpriteRef.current = null;
    houseFloorRef.current = null;
    indoorPlantContainerRef.current = null;
    enclosureOverlaysRef.current = new Map();
    fadeTargetsRef.current.clear();
```

And in the main cleanup useEffect, add `clearEnclosureCache()`.

**Step 3: Commit**

```bash
git add web/src/components/garden-map/GardenCanvas.tsx
git commit -m "feat: render enclosure overlays and indoor plants (hidden)"
```

---

### Task 6: Peek click handling and transitions

Wire up click detection for the house and enclosed zones, toggle peek state, and trigger fade transitions.

**Files:**
- Modify: `web/src/components/garden-map/GardenCanvas.tsx`

**Context:**
- The viewport `clicked` handler (line 249) currently checks plant hit areas, then fires onBackgroundClick
- We need to add enclosure hit testing AFTER plant hit testing but BEFORE background click
- House bounds come from `map.houseArea`
- Enclosed zone bounds come from `map.zoneAreas` for zones with exposure greenhouse/covered
- When an enclosure is opened: fade its overlay to low alpha (or fade house sprite), fade in floor/indoor plants
- When closed: reverse the fades

**Step 1: Add enclosure hit areas ref and populate it**

```typescript
// Track clickable enclosure regions
const enclosureHitAreasRef = useRef<Array<{
  type: 'house' | 'zone';
  id: 'house' | number;
  x: number;
  y: number;
  w: number;
  h: number;
}>>([]);
```

Populate in buildScene after overlays are created:
```typescript
    // Register enclosure hit areas
    const enclosureHitAreas: typeof enclosureHitAreasRef.current = [];

    if (map.houseArea && indoorPlants.length > 0) {
      enclosureHitAreas.push({
        type: 'house',
        id: 'house',
        x: map.houseArea.x * TILE_SIZE,
        y: map.houseArea.y * TILE_SIZE,
        w: map.houseArea.w * TILE_SIZE,
        h: map.houseArea.h * TILE_SIZE,
      });
    }

    for (const zone of mapZones) {
      if (zone.exposure !== "greenhouse" && zone.exposure !== "covered") continue;
      const zoneArea = map.zoneAreas.get(zone.id);
      if (!zoneArea) continue;
      enclosureHitAreas.push({
        type: 'zone',
        id: zone.id,
        x: zoneArea.x * TILE_SIZE,
        y: zoneArea.y * TILE_SIZE,
        w: zoneArea.w * TILE_SIZE,
        h: zoneArea.h * TILE_SIZE,
      });
    }

    enclosureHitAreasRef.current = enclosureHitAreas;
```

**Step 2: Add peek toggle function**

```typescript
    function togglePeek(id: 'house' | number) {
      const current = openEnclosureRef.current;

      // Close any currently open enclosure
      if (current === 'house') {
        if (houseSpriteRef.current) registerFade('house-sprite', houseSpriteRef.current, 1);
        if (houseFloorRef.current) registerFade('house-floor', houseFloorRef.current, 0);
        if (indoorPlantContainerRef.current) registerFade('indoor-plants', indoorPlantContainerRef.current, 0);
      } else if (typeof current === 'number') {
        const overlay = enclosureOverlaysRef.current.get(current);
        if (overlay) registerFade(`overlay-${current}`, overlay, 1);
      }

      if (current === id) {
        // Toggle off — just close
        setOpenEnclosure(null);
        return;
      }

      // Open the new enclosure
      if (id === 'house') {
        if (houseSpriteRef.current) registerFade('house-sprite', houseSpriteRef.current, 0.15);
        if (houseFloorRef.current) registerFade('house-floor', houseFloorRef.current, 1);
        if (indoorPlantContainerRef.current) registerFade('indoor-plants', indoorPlantContainerRef.current, 1);
      } else {
        const overlay = enclosureOverlaysRef.current.get(id);
        if (overlay) {
          // Find the zone to determine if greenhouse or covered
          const zone = mapZones.find(z => z.id === id);
          const targetAlpha = zone?.exposure === 'covered' ? 0.2 : 0.1;
          registerFade(`overlay-${id}`, overlay, targetAlpha);
        }
      }

      setOpenEnclosure(id);
    }
```

**Step 3: Update viewport clicked handler**

Replace the current clicked handler with:
```typescript
    viewport.on("clicked", (e) => {
      const worldX = e.world.x;
      const worldY = e.world.y;

      // 1. Check plant hit areas first
      for (const hit of plantHitAreasRef.current) {
        if (worldX >= hit.x && worldX <= hit.x + hit.w &&
            worldY >= hit.y && worldY <= hit.y + hit.h) {
          if (onPlantClick) {
            const screenPt = viewport.toScreen(worldX, worldY);
            onPlantClick(hit.plant, screenPt.x, screenPt.y);
          }
          return;
        }
      }

      // 2. Check enclosure hit areas
      for (const hit of enclosureHitAreasRef.current) {
        if (worldX >= hit.x && worldX <= hit.x + hit.w &&
            worldY >= hit.y && worldY <= hit.y + hit.h) {
          togglePeek(hit.id);
          return;
        }
      }

      // 3. Background click — close any open enclosure
      if (openEnclosureRef.current !== null) {
        togglePeek(openEnclosureRef.current); // toggles off
      }
      onBackgroundClick?.();
    });
```

**Step 4: Add fade updates to ticker callback**

In the ticker callback function, add after the wildlife update:
```typescript
      // Enclosure fade transitions
      updateFades(dt);
```

**Step 5: Run TypeScript compile check**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && npx tsc --noEmit`
Expected: No errors

**Step 6: Run all tests**

Run: `cd /home/carrot/code/bramble/.worktrees/map-enclosures && pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add web/src/components/garden-map/GardenCanvas.tsx
git commit -m "feat: peek interaction — click house/greenhouse/covered to view inside"
```

---

### Task 7: Create follow-up issues

Create GitHub issues for enhancements deferred from this branch.

**Issue 1: Seasonal greenhouse variants**
- Condensation effect on glass in winter
- Open vent panels in summer
- Depends on: this branch (enclosure overlay system)

**Issue 2: Per-zone decorative fences**
- Optional fences around bed/raised_bed zone types
- Configurable per-zone (not just climbing structure fences)
- Depends on: this branch (property fences)

**Issue 3: PixelLab-generated interior/structure sprites**
- Interior house sprites (furniture, rugs, windows from inside) to replace procedural floor
- Greenhouse structure PNG sprites to replace Graphics overlay
- Covered zone awning/pergola PNG sprites

**Step 1: Create issues**

```bash
gh issue create --title "Garden map: seasonal greenhouse variants" --body "..."
gh issue create --title "Garden map: per-zone decorative fences" --body "..."
gh issue create --title "Garden map: PixelLab structure sprites for interiors & enclosures" --body "..."
```

**Step 2: Commit plan docs**

```bash
git add docs/plans/2026-03-12-map-enclosures-design.md docs/plans/2026-03-12-map-enclosures-plan.md
git commit -m "docs: map enclosures design and implementation plan"
```
