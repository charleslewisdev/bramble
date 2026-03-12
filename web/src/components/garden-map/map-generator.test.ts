import { describe, it, expect } from "vitest";
import { generateMap, paintPropertyFence, type TileCell } from "./map-generator";
import { TileType } from "./tiles";
import type { Location, Structure, Zone } from "../../api";

// Minimal fixtures — only fields that generateMap / paintPropertyFence use.
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
    lotWidth: 48,
    lotDepth: 68,
    compassOrientation: 90,
    sidewalks: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as Location;
}

function makeStructure(overrides: Partial<Structure> = {}): Structure {
  return {
    id: 1,
    locationId: 1,
    name: "House",
    posX: 8,
    posY: 18,
    width: 30,
    depth: 32,
    height: 22,
    stories: 2,
    roofType: "hip",
    createdAt: "",
    ...overrides,
  } as Structure;
}

function makeZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: 100,
    locationId: 1,
    name: "Test Bed",
    description: null,
    zoneType: "bed",
    climbingStructure: null,
    hasPatio: false,
    posX: 0,
    posY: 0,
    width: 10,
    depth: 10,
    sunExposure: "partial_sun",
    soilType: null,
    moistureLevel: null,
    windExposure: null,
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
    ...overrides,
  } as Zone;
}

describe("paintPropertyFence", () => {
  const MAP_WIDTH = 38;
  const MAP_HEIGHT = 32;
  const PADDING = 2;

  function makeGrid(): TileCell[][] {
    const tiles: TileCell[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: TileCell[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        row.push({ type: TileType.GRASS, seed: 0 });
      }
      tiles.push(row);
    }
    return tiles;
  }

  it("paints FENCE_CORNER at the four corners", () => {
    const tiles = makeGrid();
    paintPropertyFence(tiles, MAP_WIDTH, MAP_HEIGHT, PADDING);

    const top = PADDING;
    const bottom = MAP_HEIGHT - PADDING - 1;
    const left = PADDING;
    const right = MAP_WIDTH - PADDING - 1;

    expect(tiles[top]![left]!.type).toBe(TileType.FENCE_CORNER);
    expect(tiles[top]![right]!.type).toBe(TileType.FENCE_CORNER);
    expect(tiles[bottom]![left]!.type).toBe(TileType.FENCE_CORNER);
    expect(tiles[bottom]![right]!.type).toBe(TileType.FENCE_CORNER);
  });

  it("paints FENCE_H along top and bottom edges (excluding corners)", () => {
    const tiles = makeGrid();
    paintPropertyFence(tiles, MAP_WIDTH, MAP_HEIGHT, PADDING);

    const top = PADDING;
    const bottom = MAP_HEIGHT - PADDING - 1;
    const left = PADDING;
    const right = MAP_WIDTH - PADDING - 1;

    // Check a mid-edge tile on top and bottom
    const midX = Math.floor((left + right) / 2);
    expect(tiles[top]![midX]!.type).toBe(TileType.FENCE_H);
    expect(tiles[bottom]![midX]!.type).toBe(TileType.FENCE_H);

    // Verify non-corner top edge tiles are all FENCE_H
    for (let x = left + 1; x < right; x++) {
      expect(tiles[top]![x]!.type).toBe(TileType.FENCE_H);
      expect(tiles[bottom]![x]!.type).toBe(TileType.FENCE_H);
    }
  });

  it("paints FENCE_V along left and right edges (excluding corners)", () => {
    const tiles = makeGrid();
    paintPropertyFence(tiles, MAP_WIDTH, MAP_HEIGHT, PADDING);

    const top = PADDING;
    const bottom = MAP_HEIGHT - PADDING - 1;
    const left = PADDING;
    const right = MAP_WIDTH - PADDING - 1;

    for (let y = top + 1; y < bottom; y++) {
      expect(tiles[y]![left]!.type).toBe(TileType.FENCE_V);
      expect(tiles[y]![right]!.type).toBe(TileType.FENCE_V);
    }
  });

  it("does not overwrite zone tiles", () => {
    const tiles = makeGrid();
    const top = PADDING;
    const left = PADDING;

    // Place a zone tile at a fence position
    tiles[top]![left + 3] = {
      type: TileType.SOIL,
      seed: 42,
      zoneId: 5,
      zoneColor: "#ff0000",
    };

    paintPropertyFence(tiles, MAP_WIDTH, MAP_HEIGHT, PADDING);

    // Zone tile should remain unchanged
    expect(tiles[top]![left + 3]!.type).toBe(TileType.SOIL);
    expect(tiles[top]![left + 3]!.zoneId).toBe(5);
  });

  it("does not overwrite sidewalk tiles", () => {
    const tiles = makeGrid();
    const top = PADDING;
    const left = PADDING;

    // Place a sidewalk tile at a fence position
    tiles[top]![left + 5] = { type: TileType.SIDEWALK, seed: 99 };

    paintPropertyFence(tiles, MAP_WIDTH, MAP_HEIGHT, PADDING);

    expect(tiles[top]![left + 5]!.type).toBe(TileType.SIDEWALK);
  });
});

describe("generateMap property fence integration", () => {
  it("places fence tiles on the perimeter in a generated map", () => {
    const location = makeLocation();
    const structure = makeStructure();
    const map = generateMap(location, [structure], []);

    const top = 2;
    const bottom = map.height - 3;
    const left = 2;
    const right = map.width - 3;

    // Corners
    expect(map.tiles[top]![left]!.type).toBe(TileType.FENCE_CORNER);
    expect(map.tiles[top]![right]!.type).toBe(TileType.FENCE_CORNER);
    expect(map.tiles[bottom]![left]!.type).toBe(TileType.FENCE_CORNER);
    expect(map.tiles[bottom]![right]!.type).toBe(TileType.FENCE_CORNER);

    // Sample horizontal edge
    expect(map.tiles[top]![left + 1]!.type).toBe(TileType.FENCE_H);

    // Sample vertical edge
    expect(map.tiles[top + 1]![left]!.type).toBe(TileType.FENCE_V);
  });

  it("does not overwrite zone tiles with fences", () => {
    // Put a zone in the top-left area so it overlaps the fence perimeter
    const zone = makeZone({ id: 10, posX: 0, posY: 0, width: 5, depth: 5 });
    const location = makeLocation();
    const structure = makeStructure();
    const map = generateMap(location, [structure], [zone]);

    // Find zone tiles on the perimeter — they should still have their zoneId
    const top = 2;
    const left = 2;
    for (let x = left; x < map.width - 2; x++) {
      const cell = map.tiles[top]![x]!;
      if (cell.zoneId === 10) {
        // Zone tile was NOT overwritten by fence
        expect(cell.type).not.toBe(TileType.FENCE_H);
        expect(cell.type).not.toBe(TileType.FENCE_CORNER);
      }
    }
  });
});
