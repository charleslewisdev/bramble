/**
 * Auto-generates a tile grid from location property data.
 * Converts lot dimensions, zones, structures, and sidewalks into a 2D tile map.
 */

import { TileType, TILE_SIZE } from "./tiles";
import type { Location, Structure, Zone } from "../../api";

export interface TileCell {
  type: TileType;
  seed: number; // for pattern variation
  zoneId?: number; // if this tile is part of a zone
  zoneColor?: string; // zone's assigned color
}

export interface GeneratedMap {
  tiles: TileCell[][];
  width: number; // in tiles
  height: number; // in tiles
  pixelWidth: number;
  pixelHeight: number;
}

/** Padding in tiles around the lot boundary */
const LOT_PADDING = 4;

/**
 * Generate a complete tile map from location data.
 */
export function generateMap(
  location: Location,
  structures: Structure[],
  zones: Zone[],
): GeneratedMap {
  const lotWidth = Math.ceil(location.lotWidth ?? 50);
  const lotDepth = Math.ceil(location.lotDepth ?? 50);

  const width = lotWidth + LOT_PADDING * 2;
  const height = lotDepth + LOT_PADDING * 2;

  // Initialize grid with grass
  const tiles: TileCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      // Mix in some grass variations
      const seed = hashCoord(x, y);
      const r = pseudoRandom(seed);
      let type = TileType.GRASS;

      // Outside lot boundary = darker grass
      if (x < LOT_PADDING || x >= width - LOT_PADDING ||
          y < LOT_PADDING || y >= height - LOT_PADDING) {
        type = TileType.GRASS_DARK;
      } else if (r > 0.92) {
        type = TileType.GRASS_FLOWERS;
      }

      row.push({ type, seed });
    }
    tiles.push(row);
  }

  // Paint sidewalks
  if (location.sidewalks) {
    for (const sw of location.sidewalks) {
      paintSidewalk(tiles, width, height, sw, LOT_PADDING);
    }
  }

  // Paint structures
  for (const struct of structures) {
    paintStructure(tiles, struct, LOT_PADDING);
  }

  // Paint zones (garden beds)
  for (const zone of zones) {
    paintZone(tiles, zone, LOT_PADDING, width, height);
  }

  return {
    tiles,
    width,
    height,
    pixelWidth: width * TILE_SIZE,
    pixelHeight: height * TILE_SIZE,
  };
}

function paintSidewalk(
  tiles: TileCell[][],
  _gridWidth: number,
  _gridHeight: number,
  sw: { edge: "north" | "east" | "south" | "west"; width: number; inset: number },
  padding: number,
): void {
  const lotW = tiles[0]!.length - padding * 2;
  const lotH = tiles.length - padding * 2;
  const swWidth = Math.ceil(sw.width);
  const inset = Math.ceil(sw.inset);

  switch (sw.edge) {
    case "east": {
      // East sidewalk runs along right edge
      const startX = padding + lotW - inset - swWidth;
      for (let y = padding; y < padding + lotH; y++) {
        for (let dx = 0; dx < swWidth; dx++) {
          const x = startX + dx;
          if (tiles[y]?.[x]) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "west": {
      const startX = padding + inset;
      for (let y = padding; y < padding + lotH; y++) {
        for (let dx = 0; dx < swWidth; dx++) {
          const x = startX + dx;
          if (tiles[y]?.[x]) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "north": {
      const startY = padding + inset;
      for (let x = padding; x < padding + lotW; x++) {
        for (let dy = 0; dy < swWidth; dy++) {
          const y = startY + dy;
          if (tiles[y]?.[x]) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "south": {
      const startY = padding + lotH - inset - swWidth;
      for (let x = padding; x < padding + lotW; x++) {
        for (let dy = 0; dy < swWidth; dy++) {
          const y = startY + dy;
          if (tiles[y]?.[x]) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
  }
}

function paintStructure(
  tiles: TileCell[][],
  struct: Structure,
  padding: number,
): void {
  const startX = padding + Math.floor(struct.posX);
  const startY = padding + Math.floor(struct.posY);
  const w = Math.ceil(struct.width);
  const d = Math.ceil(struct.depth);

  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = startX + dx;
      const y = startY + dy;
      if (tiles[y]?.[x]) {
        // Edge tiles are walls, interior is roof
        const isEdge = dx === 0 || dx === w - 1 || dy === 0 || dy === d - 1;
        tiles[y]![x] = {
          type: isEdge ? TileType.STRUCTURE_WALL : TileType.STRUCTURE,
          seed: hashCoord(x, y),
        };
      }
    }
  }
}

function paintZone(
  tiles: TileCell[][],
  zone: Zone,
  padding: number,
  gridWidth: number,
  gridHeight: number,
): void {
  const startX = padding + Math.floor(zone.posX);
  const startY = padding + Math.floor(zone.posY);
  const w = Math.ceil(zone.width);
  const d = Math.ceil(zone.depth);

  for (let dy = 0; dy < d; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = startX + dx;
      const y = startY + dy;
      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight && tiles[y]?.[x]) {
        const seed = hashCoord(x, y);
        // Alternate between tilled and regular soil
        const isTilled = pseudoRandom(seed) > 0.6;
        tiles[y]![x] = {
          type: isTilled ? TileType.SOIL_TILLED : TileType.SOIL,
          seed,
          zoneId: zone.id,
          zoneColor: zone.color ?? "#8b7355",
        };
      }
    }
  }
}

function hashCoord(x: number, y: number): number {
  return ((x * 374761393 + y * 668265263) ^ 1274126177) >>> 0;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Calculate where to place plant sprites within a zone.
 * Returns world pixel positions (not tile positions).
 */
export function calculatePlantPositions(
  zone: Zone,
  plantCount: number,
  padding: number = LOT_PADDING,
): Array<{ x: number; y: number }> {
  if (plantCount === 0) return [];

  const zonePixelX = (padding + zone.posX) * TILE_SIZE;
  const zonePixelY = (padding + zone.posY) * TILE_SIZE;
  const zonePixelW = zone.width * TILE_SIZE;
  const zonePixelH = zone.depth * TILE_SIZE;

  // Inset from zone edges
  const inset = TILE_SIZE;
  const innerW = Math.max(zonePixelW - inset * 2, TILE_SIZE);
  const innerH = Math.max(zonePixelH - inset * 2, TILE_SIZE);

  const positions: Array<{ x: number; y: number }> = [];

  if (plantCount === 1) {
    // Center the single plant
    positions.push({
      x: zonePixelX + zonePixelW / 2,
      y: zonePixelY + zonePixelH / 2,
    });
  } else {
    // Grid layout
    const cols = Math.ceil(Math.sqrt(plantCount * (innerW / innerH)));
    const rows = Math.ceil(plantCount / cols);
    const spacingX = innerW / (cols + 1);
    const spacingY = innerH / (rows + 1);

    for (let i = 0; i < plantCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: zonePixelX + inset + spacingX * (col + 1),
        y: zonePixelY + inset + spacingY * (row + 1),
      });
    }
  }

  return positions;
}
