/**
 * Unit tests for Wang tileset corner detection and tile system utilities.
 */

import { describe, it, expect } from "vitest";
import {
  TileType,
  generateTilePattern,
  computeWangCorners,
  WANG_TILESET_MAP,
  TILE_SIZE,
  type WangCorners,
} from "./tiles";

// Helper to create a grid of TileCell-like objects
function makeGrid(
  width: number,
  height: number,
  fill: TileType = TileType.GRASS,
): Array<Array<{ type: TileType; zoneId?: number }>> {
  const grid: Array<Array<{ type: TileType; zoneId?: number }>> = [];
  for (let y = 0; y < height; y++) {
    const row: Array<{ type: TileType; zoneId?: number }> = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: fill });
    }
    grid.push(row);
  }
  return grid;
}

function setTile(
  grid: Array<Array<{ type: TileType; zoneId?: number }>>,
  x: number,
  y: number,
  type: TileType,
  zoneId?: number,
): void {
  if (grid[y]?.[x]) {
    grid[y]![x] = { type, zoneId };
  }
}

describe("generateTilePattern", () => {
  it("FLOOR_WOOD generates 256 opaque pixels", () => {
    const pixels = generateTilePattern(TileType.FLOOR_WOOD, 0);
    expect(pixels).toHaveLength(TILE_SIZE * TILE_SIZE);
    const transparent = pixels.filter((p) => p === "transparent");
    expect(transparent).toHaveLength(0);
  });
});

describe("computeWangCorners", () => {
  const tilesetName = "grass-dirt";

  it("returns all-lower for an isolated zone tile surrounded by grass", () => {
    // 5x5 grid, single SOIL tile at center (2,2)
    const grid = makeGrid(5, 5);
    setTile(grid, 2, 2, TileType.SOIL, 1);

    const corners = computeWangCorners(grid, 2, 2, tilesetName);
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "lower",
      SW: "lower",
      SE: "lower",
    });
  });

  it("returns all-upper for an interior tile fully surrounded by same zone tiles", () => {
    // 5x5 grid, 3x3 block of SOIL at center
    const grid = makeGrid(5, 5);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Center tile (2,2) has all 8 neighbors as SOIL
    const corners = computeWangCorners(grid, 2, 2, tilesetName);
    expect(corners).toEqual<WangCorners>({
      NW: "upper",
      NE: "upper",
      SW: "upper",
      SE: "upper",
    });
  });

  it("returns correct corners for a top-left corner tile", () => {
    // 5x5 grid, 3x3 block of SOIL at (1,1)-(3,3)
    const grid = makeGrid(5, 5);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Top-left of zone block (1,1) — NW is grass, others have neighbors
    const corners = computeWangCorners(grid, 1, 1, tilesetName);
    // NW: (0,0)=grass, (0,1)=grass, (1,0)=grass → lower
    // NE: (2,0)=grass, (2,1)=soil, (1,0)=grass → lower (y-1 row is grass)
    // SW: (0,2)=grass, (0,1)=grass, (1,2)=soil → lower (x-1 col is grass)
    // SE: (2,2)=soil, (2,1)=soil, (1,2)=soil → upper
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "lower",
      SW: "lower",
      SE: "upper",
    });
  });

  it("returns correct corners for a top-right corner tile", () => {
    const grid = makeGrid(5, 5);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Top-right of zone block (3,1)
    const corners = computeWangCorners(grid, 3, 1, tilesetName);
    // NW: (2,0)=grass → lower (y-1 is grass)
    // NE: (4,0)=grass → lower
    // SW: (2,2)=soil, (2,1)=soil, (3,2)=soil → upper
    // SE: (4,2)=grass → lower (x+1 is grass)
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "lower",
      SW: "upper",
      SE: "lower",
    });
  });

  it("returns correct corners for a bottom-left corner tile", () => {
    const grid = makeGrid(5, 5);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Bottom-left (1,3)
    const corners = computeWangCorners(grid, 1, 3, tilesetName);
    // NW: (0,2)=grass → lower
    // NE: (2,2)=soil, (2,3)=soil, (1,2)=soil → upper
    // SW: (0,4)=grass → lower
    // SE: (2,4)=grass → lower (y+1 is grass)
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "upper",
      SW: "lower",
      SE: "lower",
    });
  });

  it("returns correct corners for a bottom-right corner tile", () => {
    const grid = makeGrid(5, 5);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Bottom-right (3,3)
    const corners = computeWangCorners(grid, 3, 3, tilesetName);
    // NW: (2,2)=soil, (2,3)=soil, (3,2)=soil → upper
    // NE: (4,2)=grass → lower
    // SW: (2,4)=grass → lower
    // SE: (4,4)=grass → lower
    expect(corners).toEqual<WangCorners>({
      NW: "upper",
      NE: "lower",
      SW: "lower",
      SE: "lower",
    });
  });

  it("handles top-edge tile (adjacent to grid boundary)", () => {
    const grid = makeGrid(5, 5);
    // Single row of SOIL at y=0
    for (let x = 0; x < 5; x++) {
      setTile(grid, x, 0, TileType.SOIL, 1);
    }

    // Tile at (2,0) — y-1 is out of bounds
    const corners = computeWangCorners(grid, 2, 0, tilesetName);
    // All NW/NE corners reference y-1 which is out of bounds → lower
    // SW: (1,1)=grass → lower
    // SE: (3,1)=grass → lower
    expect(corners.NW).toBe("lower");
    expect(corners.NE).toBe("lower");
    expect(corners.SW).toBe("lower");
    expect(corners.SE).toBe("lower");
  });

  it("handles left-edge tile (adjacent to grid boundary)", () => {
    const grid = makeGrid(5, 5);
    // Single column of SOIL at x=0
    for (let y = 0; y < 5; y++) {
      setTile(grid, 0, y, TileType.SOIL, 1);
    }

    // Tile at (0,2) — x-1 is out of bounds
    const corners = computeWangCorners(grid, 0, 2, tilesetName);
    // All NW/SW corners reference x-1 which is out of bounds → lower
    expect(corners.NW).toBe("lower");
    expect(corners.SW).toBe("lower");
    // NE/SE: x+1=1 is grass → lower
    expect(corners.NE).toBe("lower");
    expect(corners.SE).toBe("lower");
  });

  it("works for horizontal edge tile (top edge of zone)", () => {
    const grid = makeGrid(7, 7);
    // 5x3 block of SOIL at (1,2)-(5,4)
    for (let y = 2; y <= 4; y++) {
      for (let x = 1; x <= 5; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Middle of top edge (3,2)
    const corners = computeWangCorners(grid, 3, 2, tilesetName);
    // NW: (2,1)=grass → lower
    // NE: (4,1)=grass → lower
    // SW: (2,3)=soil, (2,2)=soil, (3,3)=soil → upper
    // SE: (4,3)=soil, (4,2)=soil, (3,3)=soil → upper
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "lower",
      SW: "upper",
      SE: "upper",
    });
  });

  it("works for vertical edge tile (left edge of zone)", () => {
    const grid = makeGrid(7, 7);
    // 3x5 block of SOIL at (2,1)-(4,5)
    for (let y = 1; y <= 5; y++) {
      for (let x = 2; x <= 4; x++) {
        setTile(grid, x, y, TileType.SOIL, 1);
      }
    }

    // Middle of left edge (2,3)
    const corners = computeWangCorners(grid, 2, 3, tilesetName);
    // NW: (1,2)=grass → lower
    // NE: (3,2)=soil, (3,3)=soil, (2,2)=soil → upper
    // SW: (1,4)=grass → lower
    // SE: (3,4)=soil, (3,3)=soil, (2,4)=soil → upper
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "upper",
      SW: "lower",
      SE: "upper",
    });
  });

  it("treats different Wang-mapped tile types on the same tileset as the same terrain", () => {
    // SOIL and SOIL_TILLED both map to "grass-dirt"
    const grid = makeGrid(5, 5);
    // Mix of SOIL and SOIL_TILLED in a 3x3 block
    setTile(grid, 1, 1, TileType.SOIL_TILLED, 1);
    setTile(grid, 2, 1, TileType.SOIL, 1);
    setTile(grid, 3, 1, TileType.SOIL_TILLED, 1);
    setTile(grid, 1, 2, TileType.SOIL, 1);
    setTile(grid, 2, 2, TileType.SOIL_TILLED, 1);
    setTile(grid, 3, 2, TileType.SOIL, 1);
    setTile(grid, 1, 3, TileType.SOIL, 1);
    setTile(grid, 2, 3, TileType.SOIL_TILLED, 1);
    setTile(grid, 3, 3, TileType.SOIL, 1);

    // Center (2,2) should see all neighbors as same tileset → all upper
    const corners = computeWangCorners(grid, 2, 2, tilesetName);
    expect(corners).toEqual<WangCorners>({
      NW: "upper",
      NE: "upper",
      SW: "upper",
      SE: "upper",
    });
  });

  it("does not treat tiles from different tilesets as the same terrain", () => {
    // SOIL maps to grass-dirt, PATH_GRAVEL maps to grass-gravel
    const grid = makeGrid(5, 5);
    setTile(grid, 1, 1, TileType.PATH_GRAVEL, 1);
    setTile(grid, 2, 1, TileType.PATH_GRAVEL, 1);
    setTile(grid, 3, 1, TileType.PATH_GRAVEL, 1);
    setTile(grid, 1, 2, TileType.PATH_GRAVEL, 1);
    setTile(grid, 2, 2, TileType.SOIL, 1); // Different tileset!
    setTile(grid, 3, 2, TileType.PATH_GRAVEL, 1);
    setTile(grid, 1, 3, TileType.PATH_GRAVEL, 1);
    setTile(grid, 2, 3, TileType.PATH_GRAVEL, 1);
    setTile(grid, 3, 3, TileType.PATH_GRAVEL, 1);

    // Center SOIL tile (2,2) checked against "grass-dirt" — neighbors are gravel, not dirt
    const corners = computeWangCorners(grid, 2, 2, "grass-dirt");
    expect(corners).toEqual<WangCorners>({
      NW: "lower",
      NE: "lower",
      SW: "lower",
      SE: "lower",
    });
  });
});

describe("WANG_TILESET_MAP", () => {
  it("maps soil types to grass-dirt", () => {
    expect(WANG_TILESET_MAP[TileType.SOIL]).toBe("grass-dirt");
    expect(WANG_TILESET_MAP[TileType.SOIL_TILLED]).toBe("grass-dirt");
    expect(WANG_TILESET_MAP[TileType.SOIL_MULCH]).toBe("grass-dirt");
  });

  it("maps stone paver to grass-cement", () => {
    expect(WANG_TILESET_MAP[TileType.STONE_PAVER]).toBe("grass-cement");
  });

  it("maps path stone and light pavers to grass-pavers", () => {
    expect(WANG_TILESET_MAP[TileType.PATH_STONE]).toBe("grass-pavers");
    expect(WANG_TILESET_MAP[TileType.STONE_PAVER_LIGHT]).toBe("grass-pavers");
  });

  it("maps gravel types to grass-gravel", () => {
    expect(WANG_TILESET_MAP[TileType.PATH_GRAVEL]).toBe("grass-gravel");
    expect(WANG_TILESET_MAP[TileType.PATH_DIRT]).toBe("grass-gravel");
  });

  it("maps sidewalk to grass-sidewalk", () => {
    expect(WANG_TILESET_MAP[TileType.SIDEWALK]).toBe("grass-sidewalk");
  });

  it("maps water to grass-water", () => {
    expect(WANG_TILESET_MAP[TileType.WATER]).toBe("grass-water");
  });

  it("maps raised bed wood to grass-wood", () => {
    expect(WANG_TILESET_MAP[TileType.RAISED_BED_WOOD]).toBe("grass-wood");
  });

  it("does not map grass tiles (they stay procedural)", () => {
    expect(WANG_TILESET_MAP[TileType.GRASS]).toBeUndefined();
    expect(WANG_TILESET_MAP[TileType.GRASS_DARK]).toBeUndefined();
    expect(WANG_TILESET_MAP[TileType.GRASS_FLOWERS]).toBeUndefined();
  });

  it("does not map structural tiles", () => {
    expect(WANG_TILESET_MAP[TileType.STRUCTURE_ROOF]).toBeUndefined();
    expect(WANG_TILESET_MAP[TileType.STRUCTURE_WALL]).toBeUndefined();
  });
});
