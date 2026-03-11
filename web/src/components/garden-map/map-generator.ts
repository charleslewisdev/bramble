/**
 * Abstract garden map generator — Stardew Valley-style layout.
 * Zones are sized for visual appeal (not 1:1 foot mapping) and positioned
 * around a centered house sprite based on relative quadrant placement.
 */

import { TileType, TILE_SIZE } from "./tiles";
import type { Location, Structure, Zone } from "../../api";

export interface TileCell {
  type: TileType;
  seed: number;
  zoneId?: number;
  zoneColor?: string;
}

export interface GeneratedMap {
  tiles: TileCell[][];
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  houseArea?: { x: number; y: number; w: number; h: number };
  zoneAreas: Map<number, { x: number; y: number; w: number; h: number }>;
}

interface MapConfig {
  mapWidth: number;
  mapHeight: number;
  houseTiles: { x: number; y: number; w: number; h: number };
  padding: number;
}

interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  zoneId?: number;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function hashCoord(x: number, y: number): number {
  return ((x * 374761393 + y * 668265263) ^ 1274126177) >>> 0;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function rectsOverlap(a: PlacedRect, b: PlacedRect, margin: number = 0): boolean {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  );
}

// ──────────────────────────────────────────────
// Zone sizing
// ──────────────────────────────────────────────

const MIN_ZONE_TILES = 4;
const MAX_ZONE_TILES = 10;

interface SizedZone {
  zone: Zone;
  tileW: number;
  tileH: number;
}

function sizeZones(zones: Zone[]): SizedZone[] {
  if (zones.length === 0) return [];

  const areas = zones.map((z) => z.width * z.depth);
  const minArea = Math.min(...areas);
  const maxArea = Math.max(...areas);

  return zones.map((zone) => {
    const realArea = zone.width * zone.depth;
    const normalizedSize = lerp(realArea, minArea, maxArea, MIN_ZONE_TILES, MAX_ZONE_TILES);
    const aspect = zone.width / Math.max(zone.depth, 0.1);
    const clampedAspect = clamp(aspect, 0.5, 2.0);

    let tileW = Math.round(normalizedSize * Math.sqrt(clampedAspect));
    let tileH = Math.round(normalizedSize / Math.sqrt(clampedAspect));
    tileW = clamp(tileW, MIN_ZONE_TILES, MAX_ZONE_TILES);
    tileH = clamp(tileH, MIN_ZONE_TILES, MAX_ZONE_TILES);

    return { zone, tileW, tileH };
  });
}

// ──────────────────────────────────────────────
// Zone positioning
// ──────────────────────────────────────────────

interface PlacedZone {
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

function positionZones(
  sizedZones: SizedZone[],
  config: MapConfig,
  structures: Structure[],
): PlacedZone[] {
  const { houseTiles, mapWidth, mapHeight, padding } = config;

  // Gather all real-world points (zones + structure) to find the bounding box
  const mainStruct = structures.length > 0 ? structures[0]! : null;
  const realPoints: { x: number; y: number }[] = [];

  for (const sz of sizedZones) {
    realPoints.push({ x: sz.zone.posX, y: sz.zone.posY });
    realPoints.push({ x: sz.zone.posX + sz.zone.width, y: sz.zone.posY + sz.zone.depth });
  }
  if (mainStruct) {
    realPoints.push({ x: mainStruct.posX, y: mainStruct.posY });
    realPoints.push({ x: mainStruct.posX + mainStruct.width, y: mainStruct.posY + mainStruct.depth });
  }

  if (realPoints.length === 0) return [];

  const realMinX = Math.min(...realPoints.map((p) => p.x));
  const realMaxX = Math.max(...realPoints.map((p) => p.x));
  const realMinY = Math.min(...realPoints.map((p) => p.y));
  const realMaxY = Math.max(...realPoints.map((p) => p.y));

  // Available map area for zone placement (with padding)
  const areaMinX = padding;
  const areaMaxX = mapWidth - padding;
  const areaMinY = padding;
  const areaMaxY = mapHeight - padding;

  // Linear mapping from real-world coordinates to abstract map coordinates
  // This preserves relative spatial relationships between zones
  function toMapX(realX: number): number {
    if (realMaxX === realMinX) return (areaMinX + areaMaxX) / 2;
    return areaMinX + ((realX - realMinX) / (realMaxX - realMinX)) * (areaMaxX - areaMinX);
  }

  function toMapY(realY: number): number {
    if (realMaxY === realMinY) return (areaMinY + areaMaxY) / 2;
    return areaMinY + ((realY - realMinY) / (realMaxY - realMinY)) * (areaMaxY - areaMinY);
  }

  const placed: PlacedZone[] = [];
  const occupiedRects: PlacedRect[] = [
    { x: houseTiles.x, y: houseTiles.y, w: houseTiles.w, h: houseTiles.h },
  ];

  // Sort zones by area (largest first) so big zones get placed first
  const sorted = [...sizedZones].sort((a, b) => (b.tileW * b.tileH) - (a.tileW * a.tileH));

  for (const { zone, tileW, tileH } of sorted) {
    // Map the zone's real-world center to the abstract map
    const realCX = zone.posX + zone.width / 2;
    const realCY = zone.posY + zone.depth / 2;
    let targetX = Math.round(toMapX(realCX) - tileW / 2);
    let targetY = Math.round(toMapY(realCY) - tileH / 2);

    // Clamp to map bounds
    targetX = clamp(targetX, padding, mapWidth - padding - tileW);
    targetY = clamp(targetY, padding, mapHeight - padding - tileH);

    // Collision avoidance: nudge until no overlap
    const candidate: PlacedRect = { x: targetX, y: targetY, w: tileW, h: tileH, zoneId: zone.id };
    resolveCollision(candidate, occupiedRects, config);

    occupiedRects.push(candidate);
    placed.push({
      zone,
      x: candidate.x,
      y: candidate.y,
      w: candidate.w,
      h: candidate.h,
    });
  }

  return placed;
}

function resolveCollision(
  rect: PlacedRect,
  occupied: PlacedRect[],
  config: MapConfig,
): void {
  const { mapWidth, mapHeight, padding } = config;
  const maxAttempts = 100;
  let attempts = 0;

  // Spiral search pattern: try nudging in expanding circles
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: -1 },
  ];

  while (attempts < maxAttempts) {
    let hasCollision = false;
    for (const occ of occupied) {
      if (rectsOverlap(rect, occ, 1)) {
        hasCollision = true;
        break;
      }
    }
    if (!hasCollision) return;

    // Nudge in spiral pattern
    const radius = Math.floor(attempts / directions.length) + 1;
    const dir = directions[attempts % directions.length]!;
    rect.x = clamp(rect.x + dir.dx * radius, padding, mapWidth - padding - rect.w);
    rect.y = clamp(rect.y + dir.dy * radius, padding, mapHeight - padding - rect.h);

    attempts++;
  }
}

// ──────────────────────────────────────────────
// Path generation
// ──────────────────────────────────────────────

interface PathSegment {
  x: number;
  y: number;
}

function generatePaths(
  placedZones: PlacedZone[],
  config: MapConfig,
  _orientation: number,
): PathSegment[] {
  const { houseTiles } = config;
  const pathTiles: PathSegment[] = [];
  const pathSet = new Set<string>();

  const addPath = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!pathSet.has(key)) {
      pathSet.add(key);
      pathTiles.push({ x, y });
    }
  };

  // Door position: front of house based on orientation
  // Default: door at bottom-center of house (south-facing default)
  const doorX = Math.floor(houseTiles.x + houseTiles.w / 2);
  const doorY = houseTiles.y + houseTiles.h;

  // Connect door to nearest zone
  if (placedZones.length > 0) {
    let nearest = placedZones[0]!;
    let nearestDist = Infinity;
    for (const pz of placedZones) {
      const zcx = pz.x + Math.floor(pz.w / 2);
      const zcy = pz.y + Math.floor(pz.h / 2);
      const dist = Math.abs(zcx - doorX) + Math.abs(zcy - doorY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pz;
      }
    }
    const targetX = nearest.x + Math.floor(nearest.w / 2);
    const targetY = nearest.y + Math.floor(nearest.h / 2);
    manhattanPath(doorX, doorY, targetX, targetY, addPath);
  }

  // Connect adjacent zones (zones that are close together)
  for (let i = 0; i < placedZones.length; i++) {
    const a = placedZones[i]!;
    let closestIdx = -1;
    let closestDist = Infinity;

    for (let j = 0; j < placedZones.length; j++) {
      if (i === j) continue;
      const b = placedZones[j]!;
      const dist =
        Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) +
        Math.abs((a.y + a.h / 2) - (b.y + b.h / 2));
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = j;
      }
    }

    if (closestIdx >= 0 && closestDist < 25) {
      const b = placedZones[closestIdx]!;
      const ax = a.x + Math.floor(a.w / 2);
      const ay = a.y + Math.floor(a.h / 2);
      const bx = b.x + Math.floor(b.w / 2);
      const by = b.y + Math.floor(b.h / 2);
      manhattanPath(ax, ay, bx, by, addPath);
    }
  }

  return pathTiles;
}

function manhattanPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  addPath: (x: number, y: number) => void,
): void {
  // Horizontal first, then vertical — 2 tiles wide
  const dx = x2 > x1 ? 1 : -1;
  const dy = y2 > y1 ? 1 : -1;

  let cx = x1;
  while (cx !== x2) {
    addPath(cx, y1);
    addPath(cx, y1 + 1); // 2-tile width
    cx += dx;
  }

  let cy = y1;
  while (cy !== y2) {
    addPath(x2, cy);
    addPath(x2 + 1, cy); // 2-tile width
    cy += dy;
  }
}

// ──────────────────────────────────────────────
// Tile painting
// ──────────────────────────────────────────────

function getZoneTileType(zoneType: string | null | undefined, seed: number): TileType {
  const r = pseudoRandom(seed);
  switch (zoneType) {
    case "bed":
      return r > 0.6 ? TileType.SOIL_TILLED : TileType.SOIL;
    case "container":
      return TileType.STONE_PAVER;
    case "raised_bed":
      // Interior only — border is painted separately
      return TileType.SOIL;
    case "lawn":
      return TileType.GRASS_CLOVER;
    case "patio":
      return r > 0.5 ? TileType.STONE_PAVER : TileType.STONE_PAVER_LIGHT;
    case "path":
      return TileType.PATH_STONE;
    default:
      // Fallback: treat as bed
      return r > 0.6 ? TileType.SOIL_TILLED : TileType.SOIL;
  }
}

function paintZoneTiles(
  tiles: TileCell[][],
  pz: PlacedZone,
): void {
  const zone = pz.zone;
  const isRaisedBed = zone.zoneType === "raised_bed";

  for (let dy = 0; dy < pz.h; dy++) {
    for (let dx = 0; dx < pz.w; dx++) {
      const x = pz.x + dx;
      const y = pz.y + dy;
      if (!tiles[y]?.[x]) continue;

      const seed = hashCoord(x, y);
      const isBorder = dx === 0 || dx === pz.w - 1 || dy === 0 || dy === pz.h - 1;

      let tileType: TileType;
      if (isRaisedBed && isBorder) {
        tileType = TileType.RAISED_BED_WOOD;
      } else {
        tileType = getZoneTileType(zone.zoneType, seed);
      }

      tiles[y]![x] = {
        type: tileType,
        seed,
        zoneId: zone.id,
        zoneColor: zone.color ?? "#8b7355",
      };
    }
  }
}

function paintClimbingStructure(
  tiles: TileCell[][],
  pz: PlacedZone,
): void {
  const climbing = pz.zone.climbingStructure;
  if (!climbing) return;

  switch (climbing) {
    case "pergola": {
      // Pergola beams at intervals (every 4th tile row)
      for (let dy = 0; dy < pz.h; dy += 4) {
        for (let dx = 0; dx < pz.w; dx++) {
          const x = pz.x + dx;
          const y = pz.y + dy;
          if (tiles[y]?.[x]) {
            tiles[y]![x] = {
              type: TileType.PERGOLA_BEAM,
              seed: hashCoord(x, y),
              zoneId: pz.zone.id,
              zoneColor: pz.zone.color ?? "#8b7355",
            };
          }
        }
      }
      break;
    }
    case "trellis":
    case "wall_mount": {
      // Fence on the left edge
      for (let dy = 0; dy < pz.h; dy++) {
        const x = pz.x;
        const y = pz.y + dy;
        if (tiles[y]?.[x]) {
          tiles[y]![x] = {
            type: TileType.FENCE_V,
            seed: hashCoord(x, y),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
      }
      break;
    }
    case "fence": {
      // Fence border on all edges
      for (let dx = 0; dx < pz.w; dx++) {
        const x = pz.x + dx;
        // Top edge
        if (tiles[pz.y]?.[x]) {
          tiles[pz.y]![x] = {
            type: TileType.FENCE_H,
            seed: hashCoord(x, pz.y),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
        // Bottom edge
        const by = pz.y + pz.h - 1;
        if (tiles[by]?.[x]) {
          tiles[by]![x] = {
            type: TileType.FENCE_H,
            seed: hashCoord(x, by),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
      }
      for (let dy = 1; dy < pz.h - 1; dy++) {
        const y = pz.y + dy;
        // Left edge
        if (tiles[y]?.[pz.x]) {
          tiles[y]![pz.x] = {
            type: TileType.FENCE_V,
            seed: hashCoord(pz.x, y),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
        // Right edge
        const rx = pz.x + pz.w - 1;
        if (tiles[y]?.[rx]) {
          tiles[y]![rx] = {
            type: TileType.FENCE_V,
            seed: hashCoord(rx, y),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
      }
      // Corners
      const corners = [
        { x: pz.x, y: pz.y },
        { x: pz.x + pz.w - 1, y: pz.y },
        { x: pz.x, y: pz.y + pz.h - 1 },
        { x: pz.x + pz.w - 1, y: pz.y + pz.h - 1 },
      ];
      for (const c of corners) {
        if (tiles[c.y]?.[c.x]) {
          tiles[c.y]![c.x] = {
            type: TileType.FENCE_CORNER,
            seed: hashCoord(c.x, c.y),
            zoneId: pz.zone.id,
            zoneColor: pz.zone.color ?? "#8b7355",
          };
        }
      }
      break;
    }
    // arbor is handled later as a sprite overlay, not tile-level
    default:
      break;
  }
}

// ──────────────────────────────────────────────
// Main generator
// ──────────────────────────────────────────────

/**
 * Generate a complete abstract tile map from location data.
 */
export function generateMap(
  location: Location,
  structures: Structure[],
  zones: Zone[],
): GeneratedMap {
  // Map config — compact to keep content prominent
  const mapWidth = 38;
  const mapHeight = 32;
  const padding = 2;

  // House dimensions (abstract: ~10x8 tiles for a standard house)
  const houseW = 10;
  const houseH = 8;

  // Compute real-world bounding box to position house via same linear mapping as zones
  const mainStruct = structures.length > 0 ? structures[0]! : null;
  const realPoints: { x: number; y: number }[] = [];

  for (const z of zones) {
    realPoints.push({ x: z.posX, y: z.posY });
    realPoints.push({ x: z.posX + z.width, y: z.posY + z.depth });
  }
  if (mainStruct) {
    realPoints.push({ x: mainStruct.posX, y: mainStruct.posY });
    realPoints.push({ x: mainStruct.posX + mainStruct.width, y: mainStruct.posY + mainStruct.depth });
  }

  let houseX: number;
  let houseY: number;

  if (realPoints.length > 0 && mainStruct) {
    const realMinX = Math.min(...realPoints.map((p) => p.x));
    const realMaxX = Math.max(...realPoints.map((p) => p.x));
    const realMinY = Math.min(...realPoints.map((p) => p.y));
    const realMaxY = Math.max(...realPoints.map((p) => p.y));

    const structCX = mainStruct.posX + mainStruct.width / 2;
    const structCY = mainStruct.posY + mainStruct.depth / 2;

    // Linear mapping from real-world to abstract map
    const mapCX = realMaxX === realMinX
      ? mapWidth / 2
      : padding + ((structCX - realMinX) / (realMaxX - realMinX)) * (mapWidth - 2 * padding);
    const mapCY = realMaxY === realMinY
      ? mapHeight / 2
      : padding + ((structCY - realMinY) / (realMaxY - realMinY)) * (mapHeight - 2 * padding);

    houseX = clamp(Math.round(mapCX - houseW / 2), padding, mapWidth - padding - houseW);
    houseY = clamp(Math.round(mapCY - houseH / 2), padding, mapHeight - padding - houseH);
  } else {
    // Fallback: center the house
    houseX = Math.floor((mapWidth - houseW) / 2);
    houseY = Math.floor((mapHeight - houseH) / 2);
  }

  const config: MapConfig = {
    mapWidth,
    mapHeight,
    houseTiles: { x: houseX, y: houseY, w: houseW, h: houseH },
    padding,
  };

  // Initialize grid with grass + natural variation
  const tiles: TileCell[][] = [];
  for (let y = 0; y < mapHeight; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < mapWidth; x++) {
      const seed = hashCoord(x, y);
      const r = pseudoRandom(seed);

      let type = TileType.GRASS;
      // Outside padding = darker grass
      if (x < padding || x >= mapWidth - padding || y < padding || y >= mapHeight - padding) {
        type = TileType.GRASS_DARK;
      } else if (r > 0.93) {
        type = TileType.GRASS_FLOWERS;
      } else if (r > 0.88) {
        type = TileType.GRASS_DARK;
      }

      row.push({ type, seed });
    }
    tiles.push(row);
  }

  // Paint house
  for (let dy = 0; dy < houseH; dy++) {
    for (let dx = 0; dx < houseW; dx++) {
      const x = houseX + dx;
      const y = houseY + dy;
      if (tiles[y]?.[x]) {
        const isEdge = dx === 0 || dx === houseW - 1 || dy === 0 || dy === houseH - 1;
        tiles[y]![x] = {
          type: isEdge ? TileType.STRUCTURE_WALL : TileType.STRUCTURE_ROOF,
          seed: hashCoord(x, y),
        };
      }
    }
  }

  // Size and position zones
  const sizedZones = sizeZones(zones);
  const placedZones = positionZones(sizedZones, config, structures);

  // Paint zone tiles
  for (const pz of placedZones) {
    paintZoneTiles(tiles, pz);
  }

  // Paint climbing structure overlays
  for (const pz of placedZones) {
    paintClimbingStructure(tiles, pz);
  }

  // Generate and paint paths
  const orientation = location.compassOrientation ?? 0;
  const pathTiles = generatePaths(placedZones, config, orientation);
  for (const pt of pathTiles) {
    if (tiles[pt.y]?.[pt.x]) {
      const cell = tiles[pt.y]![pt.x]!;
      // Don't overwrite zone tiles, structures, or existing paths
      if (!cell.zoneId && cell.type !== TileType.STRUCTURE_ROOF && cell.type !== TileType.STRUCTURE_WALL) {
        const seed = hashCoord(pt.x, pt.y);
        tiles[pt.y]![pt.x] = {
          type: pseudoRandom(seed + 999) > 0.7 ? TileType.PATH_STONE : TileType.PATH_DIRT,
          seed,
        };
      }
    }
  }

  // Paint sidewalks (if location has them, place along map edge)
  if (location.sidewalks) {
    for (const sw of location.sidewalks) {
      paintSidewalk(tiles, mapWidth, mapHeight, sw, padding);
    }
  }

  // Build zone areas map
  const zoneAreas = new Map<number, { x: number; y: number; w: number; h: number }>();
  for (const pz of placedZones) {
    zoneAreas.set(pz.zone.id, { x: pz.x, y: pz.y, w: pz.w, h: pz.h });
  }

  return {
    tiles,
    width: mapWidth,
    height: mapHeight,
    pixelWidth: mapWidth * TILE_SIZE,
    pixelHeight: mapHeight * TILE_SIZE,
    houseArea: { x: houseX, y: houseY, w: houseW, h: houseH },
    zoneAreas,
  };
}

function paintSidewalk(
  tiles: TileCell[][],
  mapWidth: number,
  mapHeight: number,
  sw: { edge: "north" | "east" | "south" | "west"; width: number; inset: number },
  padding: number,
): void {
  // Abstract sidewalk: place along the indicated edge of the map, inset from boundary
  const swTileWidth = clamp(Math.ceil(sw.width / 3), 1, 3); // Scale down from real feet
  const insetTiles = clamp(Math.ceil(sw.inset / 5), 1, 4);

  switch (sw.edge) {
    case "east": {
      const startX = mapWidth - padding - insetTiles - swTileWidth;
      for (let y = padding; y < mapHeight - padding; y++) {
        for (let dx = 0; dx < swTileWidth; dx++) {
          const x = startX + dx;
          if (tiles[y]?.[x] && !tiles[y]![x]!.zoneId) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "west": {
      const startX = padding + insetTiles;
      for (let y = padding; y < mapHeight - padding; y++) {
        for (let dx = 0; dx < swTileWidth; dx++) {
          const x = startX + dx;
          if (tiles[y]?.[x] && !tiles[y]![x]!.zoneId) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "north": {
      const startY = padding + insetTiles;
      for (let x = padding; x < mapWidth - padding; x++) {
        for (let dy = 0; dy < swTileWidth; dy++) {
          const y = startY + dy;
          if (tiles[y]?.[x] && !tiles[y]![x]!.zoneId) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
    case "south": {
      const startY = mapHeight - padding - insetTiles - swTileWidth;
      for (let x = padding; x < mapWidth - padding; x++) {
        for (let dy = 0; dy < swTileWidth; dy++) {
          const y = startY + dy;
          if (tiles[y]?.[x] && !tiles[y]![x]!.zoneId) {
            tiles[y]![x] = { type: TileType.SIDEWALK, seed: hashCoord(x, y) };
          }
        }
      }
      break;
    }
  }
}

// ──────────────────────────────────────────────
// Plant positions
// ──────────────────────────────────────────────

/** Size of one plant sprite slot in pixels (sprite is 16px scaled by PLANT_SPRITE_SCALE ~2.5) */
const PLANT_SLOT_SIZE = 44; // ~16*2.5 + 4px padding

export interface PlantLayout {
  /** Positions for each visible plant (pixel coordinates) */
  positions: Array<{ x: number; y: number }>;
  /** Max plants that fit in this zone's grid */
  maxSlots: number;
  /** Total plants requested */
  totalPlants: number;
}

/**
 * Calculate plant sprite positions within a zone using a proper grid layout.
 * Uses zoneAreas from the generated map for O(1) lookup instead of scanning tiles.
 * Accounts for actual sprite size to prevent overlap.
 */
export function calculatePlantPositions(
  zone: Zone,
  plantCount: number,
  generatedMap?: GeneratedMap,
): PlantLayout {
  if (plantCount === 0) return { positions: [], maxSlots: 0, totalPlants: 0 };

  // Get zone area from the map (O(1) lookup)
  const area = generatedMap?.zoneAreas.get(zone.id);

  let zonePixelX: number;
  let zonePixelY: number;
  let zonePixelW: number;
  let zonePixelH: number;

  if (area) {
    zonePixelX = area.x * TILE_SIZE;
    zonePixelY = area.y * TILE_SIZE;
    zonePixelW = area.w * TILE_SIZE;
    zonePixelH = area.h * TILE_SIZE;
  } else {
    // Fallback
    zonePixelX = (3 + Math.floor(zone.posX / 5)) * TILE_SIZE;
    zonePixelY = (3 + Math.floor(zone.posY / 5)) * TILE_SIZE;
    zonePixelW = MIN_ZONE_TILES * TILE_SIZE;
    zonePixelH = MIN_ZONE_TILES * TILE_SIZE;
  }

  // Inset from zone edges (half a tile on each side)
  const inset = TILE_SIZE * 0.5;
  const innerW = Math.max(zonePixelW - inset * 2, PLANT_SLOT_SIZE);
  const innerH = Math.max(zonePixelH - inset * 2, PLANT_SLOT_SIZE);

  // Calculate grid slots that fit in this zone
  const cols = Math.max(1, Math.floor(innerW / PLANT_SLOT_SIZE));
  const rows = Math.max(1, Math.floor(innerH / PLANT_SLOT_SIZE));
  const maxSlots = cols * rows;

  // Only position up to maxSlots plants (caller handles rotation)
  const visibleCount = Math.min(plantCount, maxSlots);

  const positions: Array<{ x: number; y: number }> = [];

  // Evenly distribute within the available grid space
  const cellW = innerW / cols;
  const cellH = innerH / rows;

  for (let i = 0; i < visibleCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    positions.push({
      x: zonePixelX + inset + cellW * (col + 0.5),
      y: zonePixelY + inset + cellH * (row + 0.5),
    });
  }

  return { positions, maxSlots, totalPlants: plantCount };
}
