/**
 * Tile system for the garden map v2.
 * Stardew Valley-inspired abstract tiles. Each tile is 16x16 pixels.
 * Zone-type-aware ground tiles with warm color palettes.
 */

import { Assets, Texture } from "pixi.js";

export const TILE_SIZE = 16;

export enum TileType {
  // Grass variants
  GRASS = "grass",
  GRASS_DARK = "grass_dark",
  GRASS_FLOWERS = "grass_flowers",
  GRASS_CLOVER = "grass_clover",

  // Soil variants
  SOIL = "soil",
  SOIL_TILLED = "soil_tilled",
  SOIL_MULCH = "soil_mulch",

  // Raised bed
  RAISED_BED_WOOD = "raised_bed_wood",

  // Stone / patio
  STONE_PAVER = "stone_paver",
  STONE_PAVER_LIGHT = "stone_paver_light",

  // Paths
  PATH_DIRT = "path_dirt",
  PATH_GRAVEL = "path_gravel",
  PATH_STONE = "path_stone",

  // Infrastructure
  SIDEWALK = "sidewalk",
  WATER = "water",
  STRUCTURE_ROOF = "structure_roof",
  STRUCTURE_WALL = "structure_wall",
  PERGOLA_BEAM = "pergola_beam",

  // Fencing
  FENCE_H = "fence_h",
  FENCE_V = "fence_v",
  FENCE_CORNER = "fence_corner",

  EMPTY = "empty",
}

// Warm, Stardew Valley-inspired color palette
const COLORS = {
  // Grass — matched to PixelLab Wang tileset grass palette
  grass1: "#50c009",
  grass2: "#61c717",
  grass3: "#45a805",
  grassHighlight: "#70d025",
  grassFlower1: "#e8c744",
  grassFlower2: "#d4a0d0",
  grassFlower3: "#7ec8e3",
  cloverBase: "#55b810",
  cloverLight: "#65c520",
  cloverSpotWhite: "#e8e8d0",
  cloverSpotYellow: "#d8d060",

  // Soil — warm browns
  soil1: "#5c3d2e",
  soil2: "#6b4832",
  soil3: "#4e3425",
  soilLine: "#7a5a42",
  mulchBase: "#4e3425",
  mulchChip1: "#8a4a2a",
  mulchChip2: "#6a3a1e",

  // Stone — warm grays
  stone1: "#8a8278",
  stone2: "#9a9288",
  stone3: "#7a7268",
  stoneLight1: "#a09890",
  stoneLight2: "#b0a8a0",
  stoneLight3: "#908880",
  grout: "#6a6258",

  // Wood — warm browns
  wood1: "#8a6a4a",
  wood2: "#7a5a3a",
  wood3: "#6a4a2a",
  woodGrain: "#9a7a5a",
  woodDark: "#5a3a1a",

  // Paths — earthy tones
  pathDirt1: "#a09080",
  pathDirt2: "#8a7868",
  pathDirtEdge: "#55b810",
  pathGravel1: "#9a9088",
  pathGravel2: "#8a8078",
  pathGravel3: "#7a7068",
  pathStone1: "#8a8278",
  pathStone2: "#7a7268",
  pathStoneGap: "#45a805",

  // Sidewalk
  sidewalk1: "#b0a89a",
  sidewalk2: "#c0b8aa",
  sidewalkLine: "#9a9285",

  // Structure
  roof1: "#4a4a52",
  roof2: "#55555d",
  roof3: "#3f3f47",
  wall: "#6a6a72",

  // Water
  water1: "#2a5a8a",
  water2: "#3a6a9a",
  waterHighlight: "#5a9aca",

  // Fence
  fence1: "#7a5a3a",
  fence2: "#6a4a2a",
  fencePost: "#5a3a1a",

  // Pergola
  pergolaBeam: "#8a6a4a",
  pergolaBeamDark: "#6a4a2a",
  pergolaBeamLight: "#9a7a5a",
  pergolaShadow: "rgba(0,0,0,0.15)",
};

/** Seeded pseudo-random for deterministic tile variation */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generate a 16x16 pixel pattern for a tile type.
 * Returns a flat array of hex color strings (256 entries).
 */
export function generateTilePattern(type: TileType, seed: number = 0): string[] {
  const pixels: string[] = new Array(TILE_SIZE * TILE_SIZE).fill("transparent");
  const r = (s: number) => seededRandom(seed * 13 + s);

  switch (type) {
    case TileType.GRASS:
    case TileType.GRASS_DARK:
    case TileType.GRASS_FLOWERS: {
      const isDark = type === TileType.GRASS_DARK;
      const base = isDark ? COLORS.grass3 : COLORS.grass1;
      const alt = isDark ? COLORS.grass1 : COLORS.grass2;

      // Fill base
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.6 ? alt : base;
      }
      // Accent highlights
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(r(i * 7 + 1) * TILE_SIZE);
        const y = Math.floor(r(i * 7 + 2) * TILE_SIZE);
        if (x < TILE_SIZE && y < TILE_SIZE) {
          pixels[y * TILE_SIZE + x] = COLORS.grassHighlight;
        }
      }
      // Flowers
      if (type === TileType.GRASS_FLOWERS) {
        const flowerColors = [COLORS.grassFlower1, COLORS.grassFlower2, COLORS.grassFlower3];
        for (let i = 0; i < 3; i++) {
          const x = Math.floor(r(i * 11 + 50) * 14) + 1;
          const y = Math.floor(r(i * 11 + 51) * 14) + 1;
          const color = flowerColors[Math.floor(r(i * 11 + 52) * 3)]!;
          pixels[y * TILE_SIZE + x] = color;
        }
      }
      break;
    }

    case TileType.GRASS_CLOVER: {
      // Lighter green clover lawn
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.5 ? COLORS.cloverBase : COLORS.cloverLight;
      }
      // Small white/yellow clover spots
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(r(i * 13 + 100) * 14) + 1;
        const y = Math.floor(r(i * 13 + 101) * 14) + 1;
        const isWhite = r(i * 13 + 102) > 0.4;
        pixels[y * TILE_SIZE + x] = isWhite ? COLORS.cloverSpotWhite : COLORS.cloverSpotYellow;
        // Add a neighbor pixel for slightly larger spots
        if (x + 1 < TILE_SIZE) {
          pixels[y * TILE_SIZE + x + 1] = isWhite ? COLORS.cloverSpotWhite : COLORS.cloverSpotYellow;
        }
      }
      break;
    }

    case TileType.SOIL:
    case TileType.SOIL_TILLED: {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.55 ? COLORS.soil2 : COLORS.soil1;
      }
      // Dark patches
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(r(i * 9 + 30) * TILE_SIZE);
        const y = Math.floor(r(i * 9 + 31) * TILE_SIZE);
        if (x < TILE_SIZE && y < TILE_SIZE) {
          pixels[y * TILE_SIZE + x] = COLORS.soil3;
        }
      }
      // Tilled lines
      if (type === TileType.SOIL_TILLED) {
        for (let row = 3; row < TILE_SIZE; row += 4) {
          for (let x = 0; x < TILE_SIZE; x++) {
            pixels[row * TILE_SIZE + x] = COLORS.soilLine;
          }
        }
      }
      break;
    }

    case TileType.SOIL_MULCH: {
      // Dark brown base with reddish wood chip specks
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.5 ? COLORS.mulchBase : COLORS.soil3;
      }
      // Reddish wood chip specks
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(r(i * 7 + 200) * TILE_SIZE);
        const y = Math.floor(r(i * 7 + 201) * TILE_SIZE);
        if (x < TILE_SIZE && y < TILE_SIZE) {
          const chipColor = r(i * 7 + 202) > 0.5 ? COLORS.mulchChip1 : COLORS.mulchChip2;
          pixels[y * TILE_SIZE + x] = chipColor;
          // Elongated chip shape
          if (x + 1 < TILE_SIZE) {
            pixels[y * TILE_SIZE + x + 1] = chipColor;
          }
        }
      }
      break;
    }

    case TileType.RAISED_BED_WOOD: {
      // Warm wood plank pattern
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          // Horizontal wood planks
          const plankIndex = Math.floor(y / 4);
          const isGrain = (x + plankIndex * 3) % 7 === 0;
          const isJoint = y % 4 === 0;
          if (isJoint) {
            pixels[y * TILE_SIZE + x] = COLORS.woodDark;
          } else if (isGrain) {
            pixels[y * TILE_SIZE + x] = COLORS.woodGrain;
          } else {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x) > 0.5 ? COLORS.wood1 : COLORS.wood2;
          }
        }
      }
      break;
    }

    case TileType.STONE_PAVER: {
      // Rectangular stone paver pattern with grout lines
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          // Grout lines every 8 pixels with offset pattern
          const row = Math.floor(y / 8);
          const offset = (row % 2) * 4;
          const isGroutX = ((x + offset) % 8 === 0);
          const isGroutY = (y % 8 === 0);
          if (isGroutX || isGroutY) {
            pixels[y * TILE_SIZE + x] = COLORS.grout;
          } else {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x) > 0.5 ? COLORS.stone1 : COLORS.stone2;
          }
        }
      }
      break;
    }

    case TileType.STONE_PAVER_LIGHT: {
      // Lighter variant of stone paver
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const row = Math.floor(y / 8);
          const offset = (row % 2) * 4;
          const isGroutX = ((x + offset) % 8 === 0);
          const isGroutY = (y % 8 === 0);
          if (isGroutX || isGroutY) {
            pixels[y * TILE_SIZE + x] = COLORS.grout;
          } else {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x) > 0.5 ? COLORS.stoneLight1 : COLORS.stoneLight2;
          }
        }
      }
      break;
    }

    case TileType.PATH_DIRT: {
      // Worn trail with grass edges
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          // Grass on edges (first/last 2-3 pixels)
          const edgeDist = Math.min(x, TILE_SIZE - 1 - x);
          if (edgeDist < 2 + Math.floor(r(y * 3 + 500) * 2)) {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x + 600) > 0.5 ? COLORS.pathDirtEdge : COLORS.grass3;
          } else {
            pixels[y * TILE_SIZE + x] = r(y * TILE_SIZE + x) > 0.5 ? COLORS.pathDirt1 : COLORS.pathDirt2;
          }
        }
      }
      break;
    }

    case TileType.PATH_GRAVEL: {
      // Loose gravel
      for (let i = 0; i < pixels.length; i++) {
        const v = r(i);
        pixels[i] = v > 0.66 ? COLORS.pathGravel1 : v > 0.33 ? COLORS.pathGravel2 : COLORS.pathGravel3;
      }
      break;
    }

    case TileType.PATH_STONE: {
      // Cobblestone stepping stones in grass
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i + 700) > 0.6 ? COLORS.grass1 : COLORS.grass2;
      }
      // Place 2-3 stepping stones
      const stoneCount = 2 + Math.floor(r(800) * 2);
      for (let s = 0; s < stoneCount; s++) {
        const cx = 3 + Math.floor(r(s * 10 + 810) * 10);
        const cy = 3 + Math.floor(r(s * 10 + 811) * 10);
        // Draw a small irregular stone (3x3ish)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = cx + dx;
            const py = cy + dy;
            if (px >= 0 && px < TILE_SIZE && py >= 0 && py < TILE_SIZE) {
              // Skip corners randomly for irregular shape
              if (Math.abs(dx) === 1 && Math.abs(dy) === 1 && r(s * 10 + dx * 3 + dy * 5 + 820) > 0.6) continue;
              pixels[py * TILE_SIZE + px] = r(py * TILE_SIZE + px + 900) > 0.5 ? COLORS.pathStone1 : COLORS.pathStone2;
            }
          }
        }
      }
      break;
    }

    case TileType.SIDEWALK: {
      // Concrete with expansion joints
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.7 ? COLORS.sidewalk2 : COLORS.sidewalk1;
      }
      // Horizontal joint line
      for (let x = 0; x < TILE_SIZE; x++) {
        pixels[8 * TILE_SIZE + x] = COLORS.sidewalkLine;
      }
      break;
    }

    case TileType.WATER: {
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const wave = Math.sin((x + seed * 3) * 0.5 + y * 0.3) * 0.5 + 0.5;
          pixels[y * TILE_SIZE + x] = wave > 0.7
            ? COLORS.waterHighlight
            : wave > 0.3
              ? COLORS.water2
              : COLORS.water1;
        }
      }
      break;
    }

    case TileType.STRUCTURE_ROOF: {
      // Roof tiles pattern
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const offset = (y % 4 < 2) ? 0 : 4;
          const isJoint = ((x + offset) % 8 === 0) || (y % 4 === 0);
          pixels[y * TILE_SIZE + x] = isJoint ? COLORS.roof3 : (r(y * TILE_SIZE + x) > 0.5 ? COLORS.roof1 : COLORS.roof2);
        }
      }
      break;
    }

    case TileType.STRUCTURE_WALL: {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.8 ? COLORS.roof2 : COLORS.wall;
      }
      break;
    }

    case TileType.PERGOLA_BEAM: {
      // Semi-transparent wooden beams — beam runs across with gaps
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = "transparent";
      }
      // Draw two horizontal beams (4px tall each) with gaps between
      for (let y = 2; y < 6; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const isGrain = (x + y) % 5 === 0;
          pixels[y * TILE_SIZE + x] = isGrain ? COLORS.pergolaBeamLight : COLORS.pergolaBeam;
        }
      }
      for (let y = 10; y < 14; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const isGrain = (x + y) % 5 === 0;
          pixels[y * TILE_SIZE + x] = isGrain ? COLORS.pergolaBeamLight : COLORS.pergolaBeamDark;
        }
      }
      // Subtle shadow between beams
      for (let x = 0; x < TILE_SIZE; x++) {
        pixels[6 * TILE_SIZE + x] = COLORS.pergolaShadow;
        pixels[14 * TILE_SIZE + x] = COLORS.pergolaShadow;
      }
      break;
    }

    case TileType.FENCE_H: {
      // Horizontal fence plank
      for (let i = 0; i < pixels.length; i++) pixels[i] = "transparent";
      // Posts at edges
      for (let y = 4; y < 12; y++) {
        pixels[y * TILE_SIZE + 0] = COLORS.fencePost;
        pixels[y * TILE_SIZE + 1] = COLORS.fencePost;
        pixels[y * TILE_SIZE + 14] = COLORS.fencePost;
        pixels[y * TILE_SIZE + 15] = COLORS.fencePost;
      }
      // Horizontal rails
      for (let x = 0; x < TILE_SIZE; x++) {
        pixels[6 * TILE_SIZE + x] = COLORS.fence1;
        pixels[7 * TILE_SIZE + x] = COLORS.fence2;
        pixels[9 * TILE_SIZE + x] = COLORS.fence1;
        pixels[10 * TILE_SIZE + x] = COLORS.fence2;
      }
      break;
    }

    case TileType.FENCE_V: {
      // Vertical fence
      for (let i = 0; i < pixels.length; i++) pixels[i] = "transparent";
      for (let y = 0; y < TILE_SIZE; y++) {
        pixels[y * TILE_SIZE + 6] = COLORS.fence1;
        pixels[y * TILE_SIZE + 7] = COLORS.fence2;
        pixels[y * TILE_SIZE + 8] = COLORS.fence1;
        pixels[y * TILE_SIZE + 9] = COLORS.fence2;
      }
      // Posts at top/bottom
      for (let x = 4; x < 12; x++) {
        pixels[0 * TILE_SIZE + x] = COLORS.fencePost;
        pixels[1 * TILE_SIZE + x] = COLORS.fencePost;
        pixels[14 * TILE_SIZE + x] = COLORS.fencePost;
        pixels[15 * TILE_SIZE + x] = COLORS.fencePost;
      }
      break;
    }

    case TileType.FENCE_CORNER: {
      for (let i = 0; i < pixels.length; i++) pixels[i] = "transparent";
      // Vertical part
      for (let y = 0; y < TILE_SIZE; y++) {
        pixels[y * TILE_SIZE + 6] = COLORS.fence1;
        pixels[y * TILE_SIZE + 7] = COLORS.fence2;
        pixels[y * TILE_SIZE + 8] = COLORS.fence1;
        pixels[y * TILE_SIZE + 9] = COLORS.fence2;
      }
      // Horizontal part
      for (let x = 0; x < TILE_SIZE; x++) {
        pixels[6 * TILE_SIZE + x] = COLORS.fence1;
        pixels[7 * TILE_SIZE + x] = COLORS.fence2;
        pixels[8 * TILE_SIZE + x] = COLORS.fence1;
        pixels[9 * TILE_SIZE + x] = COLORS.fence2;
      }
      break;
    }

    case TileType.EMPTY:
    default:
      // All transparent
      break;
  }

  return pixels;
}

/**
 * Render tile pixels to an offscreen canvas and return it.
 */
export function renderTileToCanvas(pixels: string[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const color = pixels[y * TILE_SIZE + x]!;
      if (color !== "transparent") {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Wang tileset PNG loading — adds sprite-based tile support alongside
// the procedural system above. Only a subset of TileTypes have Wang
// tilesets; everything else keeps using generateTilePattern.
// ---------------------------------------------------------------------------

/** Corner terrain value in a Wang tile */
export type WangTerrain = "upper" | "lower";

/** The four corner values that identify a single Wang tile */
export interface WangCorners {
  NE: WangTerrain;
  NW: WangTerrain;
  SE: WangTerrain;
  SW: WangTerrain;
}

/** Bounding box within the spritesheet PNG */
interface WangBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single tile entry from the tileset JSON metadata */
interface WangTileEntry {
  id: string;
  name: string;
  corners: WangCorners;
  bounding_box: WangBoundingBox;
}

/** Raw JSON metadata shape (subset of fields we care about) */
interface WangTilesetJSON {
  id: string;
  name: string;
  tile_size: { width: number; height: number };
  tileset_data: {
    tiles: WangTileEntry[];
    tile_size: { width: number; height: number };
    total_tiles: number;
    terrain_types: string[];
  };
}

/** A fully loaded Wang tileset ready for tile extraction */
export interface LoadedWangTileset {
  name: string;
  image: HTMLImageElement;
  tiles: WangTileEntry[];
  tileSize: { width: number; height: number };
}

// ---- Cache ----------------------------------------------------------------

const tilesetCache = new Map<string, Promise<LoadedWangTileset>>();
const tileCanvasCache = new Map<string, HTMLCanvasElement>();

// ---- Tileset-to-TileType mapping ------------------------------------------

/** Map existing TileType values to available Wang tilesets */
export const WANG_TILESET_MAP: Partial<Record<TileType, string>> = {
  [TileType.SOIL]: "grass-dirt",
  [TileType.SOIL_TILLED]: "grass-dirt",
  [TileType.SOIL_MULCH]: "grass-dirt",
  [TileType.PATH_STONE]: "grass-pavers",
  [TileType.STONE_PAVER]: "grass-cement",
  [TileType.STONE_PAVER_LIGHT]: "grass-pavers",
  [TileType.PATH_GRAVEL]: "grass-gravel",
  [TileType.PATH_DIRT]: "grass-gravel",
  [TileType.SIDEWALK]: "grass-sidewalk",
  [TileType.WATER]: "grass-water",
  [TileType.RAISED_BED_WOOD]: "grass-wood",
};

// ---- Loading --------------------------------------------------------------

/**
 * Load a Wang tileset by name. Fetches the JSON metadata and PNG spritesheet
 * from `/sprites/tiles/<name>.json` and `/sprites/tiles/<name>.png`.
 * Results are cached — subsequent calls with the same name return the same
 * promise.
 */
export function loadWangTileset(name: string): Promise<LoadedWangTileset> {
  const cached = tilesetCache.get(name);
  if (cached) return cached;

  const promise = (async (): Promise<LoadedWangTileset> => {
    const basePath = `/sprites/tiles/${name}`;

    // Fetch JSON metadata
    const response = await fetch(`${basePath}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load Wang tileset metadata: ${basePath}.json (${response.status})`);
    }
    const json: WangTilesetJSON = await response.json();

    // Load PNG spritesheet
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load Wang tileset image: ${basePath}.png`));
      img.src = `${basePath}.png`;
    });

    return {
      name,
      image,
      tiles: json.tileset_data.tiles,
      tileSize: json.tileset_data.tile_size,
    };
  })();

  tilesetCache.set(name, promise);
  return promise;
}

// ---- Tile extraction ------------------------------------------------------

/**
 * Build a cache key from a tileset name and corner configuration.
 */
function wangCacheKey(tilesetName: string, corners: WangCorners): string {
  return `${tilesetName}:${corners.NW}${corners.NE}${corners.SW}${corners.SE}`;
}

/**
 * Find a tile entry in the tileset whose corners match the requested
 * configuration. Returns undefined if no match is found.
 */
function findWangTile(tileset: LoadedWangTileset, corners: WangCorners): WangTileEntry | undefined {
  return tileset.tiles.find(
    (t) =>
      t.corners.NE === corners.NE &&
      t.corners.NW === corners.NW &&
      t.corners.SE === corners.SE &&
      t.corners.SW === corners.SW,
  );
}

/**
 * Extract a single 16x16 tile from a loaded Wang tileset spritesheet and
 * return it as an HTMLCanvasElement. Results are cached per tileset + corner
 * combination.
 *
 * For the initial implementation only two canonical corner configs are
 * expected:
 *   - All "upper" corners → interior zone tile (the non-grass terrain)
 *   - All "lower" corners → pure grass
 *
 * Full neighbor-aware autotiling (all 16 corner combos) is a follow-up.
 */
export function getWangTileCanvas(
  tileset: LoadedWangTileset,
  corners: WangCorners,
): HTMLCanvasElement {
  const key = wangCacheKey(tileset.name, corners);
  const cached = tileCanvasCache.get(key);
  if (cached) return cached;

  const entry = findWangTile(tileset, corners);
  if (!entry) {
    // Fallback: return a transparent canvas if no matching tile found
    const fallback = document.createElement("canvas");
    fallback.width = TILE_SIZE;
    fallback.height = TILE_SIZE;
    tileCanvasCache.set(key, fallback);
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Extract the tile region from the spritesheet
  ctx.drawImage(
    tileset.image,
    entry.bounding_box.x,
    entry.bounding_box.y,
    entry.bounding_box.width,
    entry.bounding_box.height,
    0,
    0,
    TILE_SIZE,
    TILE_SIZE,
  );

  tileCanvasCache.set(key, canvas);
  return canvas;
}

// ---- Corner detection -----------------------------------------------------

/** Minimal tile info needed for corner detection (avoids circular import) */
interface TileCellLike {
  type: TileType;
  zoneId?: number;
}

/**
 * Determine whether a grid position has a Wang-mapped tile type.
 * Returns false for out-of-bounds or non-Wang tiles.
 */
function isWangTile(grid: TileCellLike[][], x: number, y: number, tilesetName: string): boolean {
  const cell = grid[y]?.[x];
  if (!cell) return false;
  return WANG_TILESET_MAP[cell.type] === tilesetName;
}

/**
 * Compute Wang corners for a tile at (x, y) within the grid.
 * Each corner checks the 3 adjacent tiles in that diagonal direction:
 *   NW = upper if (x-1,y), (x,y-1), and (x-1,y-1) are all the same Wang terrain
 *   NE = upper if (x+1,y), (x,y-1), and (x+1,y-1) are all the same Wang terrain
 *   SW = upper if (x-1,y), (x,y+1), and (x-1,y+1) are all the same Wang terrain
 *   SE = upper if (x+1,y), (x,y+1), and (x+1,y+1) are all the same Wang terrain
 *
 * "upper" = zone terrain (dirt/cobble/gravel), "lower" = grass base
 */
export function computeWangCorners(
  grid: TileCellLike[][],
  x: number,
  y: number,
  tilesetName: string,
): WangCorners {
  const nw: WangTerrain =
    isWangTile(grid, x - 1, y, tilesetName) &&
    isWangTile(grid, x, y - 1, tilesetName) &&
    isWangTile(grid, x - 1, y - 1, tilesetName)
      ? "upper"
      : "lower";

  const ne: WangTerrain =
    isWangTile(grid, x + 1, y, tilesetName) &&
    isWangTile(grid, x, y - 1, tilesetName) &&
    isWangTile(grid, x + 1, y - 1, tilesetName)
      ? "upper"
      : "lower";

  const sw: WangTerrain =
    isWangTile(grid, x - 1, y, tilesetName) &&
    isWangTile(grid, x, y + 1, tilesetName) &&
    isWangTile(grid, x - 1, y + 1, tilesetName)
      ? "upper"
      : "lower";

  const se: WangTerrain =
    isWangTile(grid, x + 1, y, tilesetName) &&
    isWangTile(grid, x, y + 1, tilesetName) &&
    isWangTile(grid, x + 1, y + 1, tilesetName)
      ? "upper"
      : "lower";

  return { NW: nw, NE: ne, SW: sw, SE: se };
}

// ---- Preloading -----------------------------------------------------------

/**
 * Preload all Wang tilesets that are mapped in WANG_TILESET_MAP.
 * Call before rendering to avoid per-tile async delays.
 */
export async function preloadWangTilesets(): Promise<Map<string, LoadedWangTileset>> {
  const names = new Set(Object.values(WANG_TILESET_MAP));
  const entries = await Promise.all(
    [...names].map(async (name) => {
      const tileset = await loadWangTileset(name);
      return [name, tileset] as const;
    }),
  );
  return new Map(entries);
}

/**
 * Clear all Wang tileset caches (for cleanup).
 */
export function clearWangTilesetCache(): void {
  tilesetCache.clear();
  tileCanvasCache.clear();
}

// ---- Fence PNG textures ----

const fenceTextureCache = new Map<string, Texture>();

/**
 * Load a fence PNG texture by type. Results are cached.
 * The PNGs are 32x32 and will be scaled down to TILE_SIZE when rendered.
 */
export async function loadFenceTexture(type: "horizontal" | "corner"): Promise<Texture> {
  const key = `fence:${type}`;
  const cached = fenceTextureCache.get(key);
  if (cached) return cached;
  const texture = await Assets.load(`/sprites/objects/fence-${type}.png`);
  texture.source.scaleMode = "nearest";
  fenceTextureCache.set(key, texture);
  return texture;
}

/**
 * Clear fence texture cache (for cleanup).
 */
export function clearFenceTextureCache(): void {
  fenceTextureCache.clear();
}
