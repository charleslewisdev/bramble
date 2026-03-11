/**
 * Tile system for the garden map v2.
 * Stardew Valley-inspired abstract tiles. Each tile is 16x16 pixels.
 * Zone-type-aware ground tiles with warm color palettes.
 */

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
  // Grass — rich greens with yellow-green highlights
  grass1: "#3a7d2a",
  grass2: "#4a9535",
  grass3: "#2d6b1e",
  grassHighlight: "#5aad45",
  grassFlower1: "#e8c744",
  grassFlower2: "#d4a0d0",
  grassFlower3: "#7ec8e3",
  cloverBase: "#48a838",
  cloverLight: "#5cb84a",
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
  pathDirtEdge: "#6a8a4a",
  pathGravel1: "#9a9088",
  pathGravel2: "#8a8078",
  pathGravel3: "#7a7068",
  pathStone1: "#8a8278",
  pathStone2: "#7a7268",
  pathStoneGap: "#5a6a3a",

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
