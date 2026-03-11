/**
 * Generates pixel art house sprites for the garden map.
 * Drawn in 3/4 top-down perspective (front face + roof visible).
 * Supports all Structure roof types with charming Stardew Valley-style aesthetics.
 */

import { Texture, CanvasSource } from "pixi.js";
import { TILE_SIZE } from "./tiles";
import type { Structure } from "../../api";

// ---- Color palette ----

const HOUSE_COLORS = {
  wallLight: "#d4c4a8",
  wallMid: "#c4b498",
  wallDark: "#b4a488",
  roofDark: "#4a5568",
  roofMid: "#5a6578",
  roofLight: "#6a7588",
  roofShingle: "#3a4558",
  window: "#6a8aaa",
  windowFrame: "#8a7a6a",
  windowGlow: "#ffeebb",
  door: "#6a4a2a",
  doorFrame: "#8a6a4a",
  doorKnob: "#d4a440",
  chimney: "#6a5a4a",
  chimneyTop: "#5a4a3a",
  shadow: "#00000040",
  wood: "#8a6a4a",
  woodDark: "#6a4a2a",
};

// ---- Texture cache ----

const houseTextureCache = new Map<string, Texture>();

function cacheKey(
  tileWidth: number,
  tileHeight: number,
  roofType: string,
  stories: number,
): string {
  return `${tileWidth}:${tileHeight}:${roofType}:${stories}`;
}

// ---- Helper to parse hex color ----

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

// ---- Drawing helpers ----

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Frame
  fillRect(ctx, x, y, w, h, HOUSE_COLORS.windowFrame);
  // Glass inset
  fillRect(ctx, x + 1, y + 1, w - 2, h - 2, HOUSE_COLORS.window);
  // Glow highlight (top-left pixel of glass)
  if (w > 3 && h > 3) {
    fillRect(ctx, x + 1, y + 1, 1, 1, HOUSE_COLORS.windowGlow);
  }
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Frame
  fillRect(ctx, x, y, w, h, HOUSE_COLORS.doorFrame);
  // Door fill
  fillRect(ctx, x + 1, y, w - 2, h, HOUSE_COLORS.door);
  // Knob
  const knobX = x + w - 2;
  const knobY = y + Math.floor(h * 0.55);
  fillRect(ctx, knobX, knobY, 1, 1, HOUSE_COLORS.doorKnob);
}

// ---- Roof drawing per type ----

function drawHipRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Hip roof: slopes inward from all edges, lighter at center ridge
  for (let row = 0; row < h; row++) {
    const inset = Math.floor((row / h) * (w * 0.15));
    const rowLeft = x + inset;
    const rowRight = x + w - inset;
    const rowWidth = rowRight - rowLeft;

    for (let col = 0; col < rowWidth; col++) {
      const px = rowLeft + col;
      // Distance from edge determines shade
      const edgeDist = Math.min(col, rowWidth - 1 - col, row, h - 1 - row);
      const maxDist = Math.min(w, h) / 2;
      const t = Math.min(edgeDist / maxDist, 1);

      let color: string;
      if (t < 0.3) {
        color = HOUSE_COLORS.roofDark;
      } else if (t < 0.6) {
        color = HOUSE_COLORS.roofMid;
      } else {
        color = HOUSE_COLORS.roofLight;
      }

      // Shingle line pattern every 3 rows
      if (row % 3 === 0) {
        color = HOUSE_COLORS.roofShingle;
      }

      fillRect(ctx, px, y + row, 1, 1, color);
    }
  }
}

function drawGableRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Gable roof: triangular peak in center
  const midX = x + w / 2;

  for (let row = 0; row < h; row++) {
    const progress = row / h;
    const halfSpan = (w / 2) * (0.3 + progress * 0.7);
    const left = Math.floor(midX - halfSpan);
    const right = Math.ceil(midX + halfSpan);

    for (let px = left; px < right; px++) {
      const distFromCenter = Math.abs(px - midX) / halfSpan;
      const color =
        distFromCenter < 0.3
          ? HOUSE_COLORS.roofLight
          : distFromCenter < 0.6
            ? HOUSE_COLORS.roofMid
            : HOUSE_COLORS.roofDark;

      // Shingle rows
      const shingleColor = row % 3 === 0 ? HOUSE_COLORS.roofShingle : color;
      fillRect(ctx, px, y + row, 1, 1, shingleColor);
    }
  }

  // Ridge line at top
  const ridgeLeft = Math.floor(midX - w * 0.15);
  const ridgeRight = Math.ceil(midX + w * 0.15);
  fillRect(
    ctx,
    ridgeLeft,
    y,
    ridgeRight - ridgeLeft,
    1,
    HOUSE_COLORS.roofShingle,
  );
}

function drawFlatRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const color =
        (row + col) % 4 === 0
          ? HOUSE_COLORS.roofDark
          : HOUSE_COLORS.roofMid;
      fillRect(ctx, x + col, y + row, 1, 1, color);
    }
  }
  // Edge highlight
  fillRect(ctx, x, y, w, 1, HOUSE_COLORS.roofShingle);
  fillRect(ctx, x, y + h - 1, w, 1, HOUSE_COLORS.roofShingle);
}

function drawShedRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Single slope: higher on left, lower on right
  for (let row = 0; row < h; row++) {
    const rightInset = Math.floor((row / h) * (w * 0.2));
    const rowWidth = w - rightInset;

    for (let col = 0; col < rowWidth; col++) {
      const t = col / rowWidth;
      const color = lerpColor(
        HOUSE_COLORS.roofDark,
        HOUSE_COLORS.roofLight,
        t,
      );
      const shingleColor = row % 3 === 0 ? HOUSE_COLORS.roofShingle : color;
      fillRect(ctx, x + col, y + row, 1, 1, shingleColor);
    }
  }
}

function drawGambrelRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Barn-style double slope: steep lower, gentle upper
  const midX = x + w / 2;
  const breakRow = Math.floor(h * 0.4);

  for (let row = 0; row < h; row++) {
    let halfSpan: number;
    if (row < breakRow) {
      // Upper: narrow gentle slope
      const progress = row / breakRow;
      halfSpan = (w * 0.2) + (w * 0.15) * progress;
    } else {
      // Lower: wider steep slope
      const progress = (row - breakRow) / (h - breakRow);
      halfSpan = (w * 0.35) + (w * 0.15) * progress;
    }

    const left = Math.floor(midX - halfSpan);
    const right = Math.ceil(midX + halfSpan);

    for (let px = left; px < right; px++) {
      const distFromCenter = Math.abs(px - midX) / halfSpan;
      const color =
        distFromCenter < 0.4
          ? HOUSE_COLORS.roofLight
          : HOUSE_COLORS.roofDark;
      const shingleColor = row % 3 === 0 ? HOUSE_COLORS.roofShingle : color;
      fillRect(ctx, px, y + row, 1, 1, shingleColor);
    }
  }
}

function drawPergolaRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Wooden beam pattern, semi-transparent
  // Horizontal beams
  for (let row = 0; row < h; row += 3) {
    fillRect(ctx, x, y + row, w, 1, HOUSE_COLORS.wood);
  }
  // Vertical beams (fewer)
  for (let col = 0; col < w; col += 4) {
    fillRect(ctx, x + col, y, 1, h, HOUSE_COLORS.woodDark);
  }
  // Corner posts
  fillRect(ctx, x, y, 2, 2, HOUSE_COLORS.woodDark);
  fillRect(ctx, x + w - 2, y, 2, 2, HOUSE_COLORS.woodDark);
  fillRect(ctx, x, y + h - 2, 2, 2, HOUSE_COLORS.woodDark);
  fillRect(ctx, x + w - 2, y + h - 2, 2, 2, HOUSE_COLORS.woodDark);
}

function drawGazeboRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Pointed/octagonal roof with visible pillars
  const midX = x + w / 2;

  for (let row = 0; row < h; row++) {
    const progress = row / h;
    const halfSpan = (w / 2) * (0.2 + progress * 0.8);
    const left = Math.floor(midX - halfSpan);
    const right = Math.ceil(midX + halfSpan);

    for (let px = left; px < right; px++) {
      const distFromCenter = Math.abs(px - midX) / halfSpan;
      const color =
        distFromCenter < 0.4
          ? HOUSE_COLORS.roofLight
          : HOUSE_COLORS.roofMid;
      const shingleColor = row % 2 === 0 ? HOUSE_COLORS.roofShingle : color;
      fillRect(ctx, px, y + row, 1, 1, shingleColor);
    }
  }

  // Pillar posts at corners (visible below roof)
  const postH = Math.max(2, Math.floor(h * 0.3));
  fillRect(ctx, x + 1, y + h, 2, postH, HOUSE_COLORS.wood);
  fillRect(ctx, x + w - 3, y + h, 2, postH, HOUSE_COLORS.wood);
}

function drawOpenRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Just corner posts, no roof fill
  const postW = Math.max(1, Math.floor(w * 0.06));
  const postH = h;

  fillRect(ctx, x, y, postW, postH, HOUSE_COLORS.wood);
  fillRect(ctx, x + w - postW, y, postW, postH, HOUSE_COLORS.wood);

  // Top rail connecting posts
  fillRect(ctx, x, y, w, 1, HOUSE_COLORS.woodDark);
  // Bottom rail
  fillRect(ctx, x, y + h - 1, w, 1, HOUSE_COLORS.woodDark);
}

function drawCanopyRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Slight curved fabric-like pattern
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      // Slight sine wave for fabric drape
      const drape = Math.sin((col / w) * Math.PI * 3) * 0.5 + 0.5;
      const rowShade = row / h;
      const t = (drape + rowShade) / 2;
      const color = lerpColor(
        HOUSE_COLORS.roofLight,
        HOUSE_COLORS.roofDark,
        t,
      );
      fillRect(ctx, x + col, y + row, 1, 1, color);
    }
  }

  // Support poles at edges
  const postW = Math.max(1, Math.floor(w * 0.05));
  fillRect(ctx, x, y, postW, h, HOUSE_COLORS.wood);
  fillRect(ctx, x + w - postW, y, postW, h, HOUSE_COLORS.wood);
}

// ---- Roof type dispatcher ----

function drawRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  roofType: Structure["roofType"],
): void {
  switch (roofType) {
    case "hip":
      drawHipRoof(ctx, x, y, w, h);
      break;
    case "gable":
      drawGableRoof(ctx, x, y, w, h);
      break;
    case "flat":
      drawFlatRoof(ctx, x, y, w, h);
      break;
    case "shed":
      drawShedRoof(ctx, x, y, w, h);
      break;
    case "gambrel":
      drawGambrelRoof(ctx, x, y, w, h);
      break;
    case "pergola":
      drawPergolaRoof(ctx, x, y, w, h);
      break;
    case "gazebo":
      drawGazeboRoof(ctx, x, y, w, h);
      break;
    case "open":
      drawOpenRoof(ctx, x, y, w, h);
      break;
    case "canopy":
      drawCanopyRoof(ctx, x, y, w, h);
      break;
  }
}

// ---- Wall and detail drawing ----

function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stories: number,
): void {
  // Base wall fill with subtle texture
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const noise = ((col * 7 + row * 13) % 5) / 5;
      const color =
        noise < 0.3
          ? HOUSE_COLORS.wallLight
          : noise < 0.7
            ? HOUSE_COLORS.wallMid
            : HOUSE_COLORS.wallDark;
      fillRect(ctx, x + col, y + row, 1, 1, color);
    }
  }

  // Wall edge lines (left and right borders)
  fillRect(ctx, x, y, 1, h, HOUSE_COLORS.wallDark);
  fillRect(ctx, x + w - 1, y, 1, h, HOUSE_COLORS.wallDark);

  // Floor divider for multi-story
  if (stories >= 2) {
    const floorH = Math.floor(h / stories);
    for (let s = 1; s < stories; s++) {
      const divY = y + floorH * s;
      fillRect(ctx, x, divY, w, 1, HOUSE_COLORS.wallDark);
    }
  }

  // Windows per floor
  const floorH = Math.floor(h / stories);
  const windowW = Math.max(2, Math.floor(w * 0.1));
  const windowH = Math.max(2, Math.floor(floorH * 0.5));

  for (let s = 0; s < stories; s++) {
    const floorY = y + floorH * s;
    const windowY = floorY + Math.floor((floorH - windowH) / 2);

    // Determine window count based on width
    const windowCount = Math.max(2, Math.min(5, Math.floor(w / (windowW + 4))));
    const spacing = w / (windowCount + 1);

    for (let i = 0; i < windowCount; i++) {
      const windowX = x + Math.floor(spacing * (i + 1)) - Math.floor(windowW / 2);
      drawWindow(ctx, windowX, windowY, windowW, windowH);
    }
  }

  // Door (centered at bottom, only on ground floor)
  const doorW = Math.max(3, Math.floor(w * 0.08));
  const doorH = Math.max(4, Math.floor(floorH * 0.7));
  const doorX = x + Math.floor(w / 2) - Math.floor(doorW / 2);
  const doorY = y + h - doorH;
  drawDoor(ctx, doorX, doorY, doorW, doorH);
}

function drawChimney(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
): void {
  const chimneyW = Math.max(2, Math.floor(w * 0.08));
  const chimneyH = Math.max(3, Math.floor(w * 0.12));
  const chimneyX = x + Math.floor(w * 0.7);

  fillRect(ctx, chimneyX, y - chimneyH + 2, chimneyW, chimneyH, HOUSE_COLORS.chimney);
  // Cap
  fillRect(
    ctx,
    chimneyX - 1,
    y - chimneyH + 1,
    chimneyW + 2,
    2,
    HOUSE_COLORS.chimneyTop,
  );
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  fillRect(ctx, x + 1, y, w, h, HOUSE_COLORS.shadow);
}

// ---- Check if roof type is an open/minimal structure ----

function isOpenStructure(roofType: Structure["roofType"]): boolean {
  return roofType === "pergola" || roofType === "gazebo" || roofType === "open";
}

// ---- Main export ----

/**
 * Generate a pixel art house texture for the garden map.
 *
 * @param tileWidth  - Width of the structure in tiles
 * @param tileHeight - Height (depth) of the structure in tiles
 * @param structure  - Structure data (uses roofType and stories)
 * @returns PixiJS Texture
 */
export function generateHouseTexture(
  tileWidth: number,
  tileHeight: number,
  structure: Structure,
): Texture {
  const key = cacheKey(tileWidth, tileHeight, structure.roofType, structure.stories);

  const cached = houseTextureCache.get(key);
  if (cached) {
    return cached;
  }

  const pixelW = tileWidth * TILE_SIZE;
  const pixelH = tileHeight * TILE_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = pixelW;
  canvas.height = pixelH;
  const ctx = canvas.getContext("2d")!;

  // Fill with a base color so the house is fully opaque
  ctx.fillStyle = HOUSE_COLORS.wallMid;
  ctx.fillRect(0, 0, pixelW, pixelH);

  // Layout proportions
  const shadowH = Math.max(2, Math.floor(pixelH * 0.1));
  const open = isOpenStructure(structure.roofType);

  let roofH: number;
  let wallH: number;

  if (open) {
    // Open structures: roof is the full sprite (beams/pillars visible)
    roofH = pixelH - shadowH;
    wallH = 0;
  } else {
    roofH = Math.floor(pixelH * 0.4);
    wallH = pixelH - roofH - shadowH;
  }

  // 1. Shadow at bottom
  drawShadow(ctx, 0, pixelH - shadowH, pixelW, shadowH);

  // 2. Wall (skipped for open structures)
  if (wallH > 0) {
    drawWall(ctx, 0, roofH, pixelW, wallH, structure.stories);
  }

  // 3. Roof
  drawRoof(ctx, 0, 0, pixelW, roofH, structure.roofType);

  // 4. Chimney (only for solid roof types with enough space)
  if (!open && structure.roofType !== "flat" && pixelW >= 16) {
    drawChimney(ctx, 0, roofH, pixelW, roofH);
  }

  const source = new CanvasSource({
    resource: canvas,
    resolution: 1,
    scaleMode: "nearest",
  });
  const texture = new Texture({ source });
  houseTextureCache.set(key, texture);
  return texture;
}

// ---- PNG-based house loading ----

const HOUSE_SPRITE_BASE = "/sprites/structures/";

/** Available house sprite variants — randomly selected per location */
const HOUSE_VARIANTS = ["house-hip", "house-gable", "house-cottage", "house-modern"];

/** Structure types that have dedicated PNG sprites */
const STRUCTURE_SPRITES: Record<string, string> = {
  pergola: "pergola",
  gazebo: "gazebo",
};

/**
 * Pick a deterministic house variant based on a seed (structure ID or location).
 * Uses the structure's numeric ID to ensure the same location always gets the
 * same house style across renders.
 */
function pickHouseVariant(structure: Structure): string {
  // Use structure ID as seed for deterministic selection
  const seed = structure.id ?? 0;
  const index = Math.abs(seed) % HOUSE_VARIANTS.length;
  return HOUSE_VARIANTS[index]!;
}

/**
 * Load a house texture, preferring a PNG asset if available.
 * For standard houses, randomly selects one of 4 Stardew Valley-style variants.
 * For pergola/gazebo, loads the matching sprite.
 * Falls back to procedural generation if PNG fails to load.
 */
export async function loadHouseTexture(
  tileWidth: number,
  tileHeight: number,
  structure: Structure,
): Promise<Texture> {
  const key = cacheKey(tileWidth, tileHeight, structure.roofType, structure.stories);
  const cached = houseTextureCache.get(key);
  if (cached) return cached;

  // Determine which sprite to load
  const structureSprite = STRUCTURE_SPRITES[structure.roofType];
  const spriteName = structureSprite ?? pickHouseVariant(structure);

  try {
    const { Assets } = await import("pixi.js");
    const url = `${HOUSE_SPRITE_BASE}${spriteName}.png`;
    const texture = await Assets.load(url);
    texture.source.scaleMode = "nearest";
    houseTextureCache.set(key, texture);
    return texture;
  } catch {
    // PNG not found — fall through to procedural
  }

  return generateHouseTexture(tileWidth, tileHeight, structure);
}

/**
 * Clear all cached house textures.
 */
export function clearHouseTextureCache(): void {
  for (const texture of houseTextureCache.values()) {
    texture.destroy(true);
  }
  houseTextureCache.clear();
}
