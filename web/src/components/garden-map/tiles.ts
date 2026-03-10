/**
 * Tile system for the garden map.
 * Each tile is 16x16 pixels. Tile types define the terrain.
 * Multiple pattern variations per type prevent visual monotony.
 */

export const TILE_SIZE = 16;

export enum TileType {
  GRASS = "grass",
  GRASS_DARK = "grass_dark",
  GRASS_FLOWERS = "grass_flowers",
  SOIL = "soil",
  SOIL_TILLED = "soil_tilled",
  PATH = "path",
  SIDEWALK = "sidewalk",
  STRUCTURE = "structure",
  STRUCTURE_WALL = "structure_wall",
  WATER = "water",
  FENCE_H = "fence_h",
  FENCE_V = "fence_v",
  FENCE_CORNER = "fence_corner",
  ZONE_BORDER_TOP = "zone_border_top",
  ZONE_BORDER_BOTTOM = "zone_border_bottom",
  ZONE_BORDER_LEFT = "zone_border_left",
  ZONE_BORDER_RIGHT = "zone_border_right",
  EMPTY = "empty",
}

// Color palettes
const COLORS = {
  // Grass
  grass1: "#2d5a1e",
  grass2: "#3a6b2a",
  grass3: "#2a5019",
  grassAccent: "#4a8535",
  grassFlower1: "#e8c744",
  grassFlower2: "#d4a0d0",
  grassFlower3: "#7ec8e3",

  // Soil
  soil1: "#5c3d2e",
  soil2: "#6b4832",
  soil3: "#4e3425",
  soilLine: "#7a5a42",

  // Path
  path1: "#8a8278",
  path2: "#9a9288",
  path3: "#7a7268",
  pathGap: "#6a6258",

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
  water3: "#1a4a7a",
  waterHighlight: "#5a9aca",

  // Fence
  fence1: "#7a5a3a",
  fence2: "#6a4a2a",
  fencePost: "#5a3a1a",
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
      // Accent blades
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(r(i * 7 + 1) * TILE_SIZE);
        const y = Math.floor(r(i * 7 + 2) * TILE_SIZE);
        if (x < TILE_SIZE && y < TILE_SIZE) {
          pixels[y * TILE_SIZE + x] = COLORS.grassAccent;
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

    case TileType.PATH: {
      // Stepping stones / gravel path
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = r(i) > 0.5 ? COLORS.path1 : COLORS.path2;
      }
      // Gaps between stones
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(r(i * 5 + 40) * TILE_SIZE);
        const y = Math.floor(r(i * 5 + 41) * TILE_SIZE);
        if (x < TILE_SIZE && y < TILE_SIZE) {
          pixels[y * TILE_SIZE + x] = COLORS.pathGap;
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

    case TileType.STRUCTURE: {
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

    case TileType.ZONE_BORDER_TOP:
    case TileType.ZONE_BORDER_BOTTOM:
    case TileType.ZONE_BORDER_LEFT:
    case TileType.ZONE_BORDER_RIGHT: {
      // These are rendered as overlays with zone color
      for (let i = 0; i < pixels.length; i++) pixels[i] = "transparent";
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
