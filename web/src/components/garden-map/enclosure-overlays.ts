/**
 * Enclosure overlay rendering for greenhouse, covered, and indoor zones.
 * Returns PixiJS Containers that can be alpha-animated for the peek interaction.
 */

import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE_SIZE } from "./tiles";

// Sprite-based texture caches (loaded from PNGs)
let floorLightCache: Texture | null = null;
let floorDarkCache: Texture | null = null;
let glassCache: Texture | null = null;
let glassWinterCache: Texture | null = null;
let rugCache: Texture | null = null;

/** Load and cache all enclosure sprite textures. Call once before building scene. */
export async function loadEnclosureTextures(): Promise<void> {
  const [floorLight, floorDark, glass, glassWinter, rug] = await Promise.all([
    Assets.load<Texture>("/sprites/tiles/floor-wood-light.png"),
    Assets.load<Texture>("/sprites/tiles/floor-wood-dark.png"),
    Assets.load<Texture>("/sprites/tiles/greenhouse-glass.png"),
    Assets.load<Texture>("/sprites/tiles/greenhouse-glass-winter.png"),
    Assets.load<Texture>("/sprites/objects/interior-rug.png"),
  ]);
  floorLight.source.scaleMode = "nearest";
  floorDark.source.scaleMode = "nearest";
  glass.source.scaleMode = "nearest";
  glassWinter.source.scaleMode = "nearest";
  rug.source.scaleMode = "nearest";

  floorLightCache = floorLight;
  floorDarkCache = floorDark;
  glassCache = glass;
  glassWinterCache = glassWinter;
  rugCache = rug;
}

export type Season = "spring" | "summer" | "fall" | "winter";

/**
 * Create a greenhouse overlay container with glass panes and frame.
 * Appearance varies by season:
 * - Winter: frosted/condensation effect, snow on roof edges
 * - Summer: more transparent glass, open vent panels
 * - Spring/Fall: default appearance
 */
export function createGreenhouseOverlay(
  x: number, y: number, w: number, h: number,
  season: Season = "spring",
): Container {
  const container = new Container();
  container.label = "greenhouse-overlay";

  // Glass tile grid — use sprite tiles when loaded, fall back to Graphics
  const glassTex = season === "winter" ? glassWinterCache : glassCache;
  if (glassTex) {
    const tilesW = Math.ceil(w / TILE_SIZE);
    const tilesH = Math.ceil(h / TILE_SIZE);
    for (let ty = 0; ty < tilesH; ty++) {
      for (let tx = 0; tx < tilesW; tx++) {
        const sprite = new Sprite(glassTex);
        sprite.x = x + tx * TILE_SIZE;
        sprite.y = y + ty * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        // Summer: more transparent
        if (season === "summer") sprite.alpha = 0.6;
        container.addChild(sprite);
      }
    }
  } else {
    // Fallback: Graphics-based glass fill
    const glass = new Graphics();
    glass.rect(x, y, w, h);
    if (season === "winter") {
      glass.fill({ color: 0xaabbcc, alpha: 0.4 });
    } else if (season === "summer") {
      glass.fill({ color: 0x99ddbb, alpha: 0.18 });
    } else {
      glass.fill({ color: 0x88ccaa, alpha: 0.3 });
    }
    container.addChild(glass);
  }

  // Glass pane divider lines (vertical + horizontal every ~24px)
  const paneSpacing = 24;
  const dividers = new Graphics();
  for (let dx = paneSpacing; dx < w; dx += paneSpacing) {
    // In summer, skip every other vertical divider to show open vent panels
    if (season === "summer" && Math.floor(dx / paneSpacing) % 3 === 0) continue;
    dividers.moveTo(x + dx, y);
    dividers.lineTo(x + dx, y + h);
  }
  for (let dy = paneSpacing; dy < h; dy += paneSpacing) {
    dividers.moveTo(x, y + dy);
    dividers.lineTo(x + w, y + dy);
  }
  dividers.stroke({ width: 1, color: 0x667766, alpha: season === "winter" ? 0.15 : 0.25 });
  container.addChild(dividers);

  // Winter: condensation droplets scattered across the glass
  if (season === "winter") {
    const condensation = new Graphics();
    const dropCount = Math.floor((w * h) / 200);
    for (let i = 0; i < dropCount; i++) {
      // Deterministic positions using simple hash
      const fx = x + ((i * 137 + 29) % Math.floor(w));
      const fy = y + ((i * 97 + 43) % Math.floor(h));
      condensation.circle(fx, fy, 1);
    }
    condensation.fill({ color: 0xddeeff, alpha: 0.35 });
    container.addChild(condensation);
  }

  // Frame border
  const frame = new Graphics();
  frame.rect(x, y, w, h);
  frame.stroke({ width: 2, color: 0x667766, alpha: 1 });
  container.addChild(frame);

  // Corner posts
  const postSize = 4;
  const posts = new Graphics();
  posts.rect(x, y, postSize, postSize);
  posts.rect(x + w - postSize, y, postSize, postSize);
  posts.rect(x, y + h - postSize, postSize, postSize);
  posts.rect(x + w - postSize, y + h - postSize, postSize, postSize);
  posts.fill({ color: 0x556655, alpha: 1 });
  container.addChild(posts);

  // Winter: snow on top and bottom edges
  if (season === "winter") {
    const snow = new Graphics();
    // Top edge snow — irregular bumps
    for (let sx = 0; sx < w; sx += 6) {
      const bumpH = 2 + ((sx * 31) % 3);
      snow.rect(x + sx, y - 1, 6, bumpH);
    }
    // Bottom edge snow — thinner accumulation
    for (let sx = 0; sx < w; sx += 8) {
      const bumpH = 1 + ((sx * 17) % 2);
      snow.rect(x + sx, y + h - bumpH, 8, bumpH);
    }
    snow.fill({ color: 0xeef4ff, alpha: 0.7 });
    container.addChild(snow);
  }

  return container;
}

/**
 * Create a covered/pergola-style overlay container with beams and shadow.
 * @param x - Left edge in pixels
 * @param y - Top edge in pixels
 * @param w - Width in pixels
 * @param h - Height in pixels
 */
export function createCoveredOverlay(x: number, y: number, w: number, h: number): Container {
  const container = new Container();
  container.label = "covered-overlay";

  // Light shadow fill
  const shadow = new Graphics();
  shadow.rect(x, y, w, h);
  shadow.fill({ color: 0x000000, alpha: 0.08 });
  container.addChild(shadow);

  // Horizontal beam lines every ~12px
  const beams = new Graphics();
  for (let dy = 0; dy < h; dy += 12) {
    // Main beam
    beams.moveTo(x, y + dy);
    beams.lineTo(x + w, y + dy);
    beams.stroke({ width: 2, color: 0x8a6a4a, alpha: 0.55 });

    // Dark bottom edge on each beam
    beams.moveTo(x, y + dy + 2);
    beams.lineTo(x + w, y + dy + 2);
    beams.stroke({ width: 1, color: 0x5a3a1a, alpha: 0.3 });
  }
  container.addChild(beams);

  // Support posts at left/right edges
  const postWidth = 3;
  const posts = new Graphics();
  posts.rect(x, y, postWidth, h);
  posts.rect(x + w - postWidth, y, postWidth, h);
  posts.fill({ color: 0x6a4a2a, alpha: 0.6 });
  container.addChild(posts);

  return container;
}

/**
 * Create the house floor overlay — a grid of sprite-based floor tiles
 * filling the house footprint with alternating light/dark hardwood.
 * Includes a centered rug accent. Starts hidden (alpha=0).
 * @param houseArea - House bounds in TILE coordinates (will be multiplied by TILE_SIZE)
 */
export function createHouseFloor(houseArea: { x: number; y: number; w: number; h: number }): Container {
  const container = new Container();
  container.label = "house-floor";
  container.alpha = 0; // Hidden by default

  const px = houseArea.x * TILE_SIZE;
  const py = houseArea.y * TILE_SIZE;

  // Fill the house area with alternating light/dark floor tiles
  for (let ty = 0; ty < houseArea.h; ty++) {
    for (let tx = 0; tx < houseArea.w; tx++) {
      // Checkerboard pattern with light/dark variants
      const isLight = (tx + ty) % 2 === 0;
      const tex = isLight ? floorLightCache : floorDarkCache;
      if (!tex) continue;

      const sprite = new Sprite(tex);
      sprite.x = px + tx * TILE_SIZE;
      sprite.y = py + ty * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      container.addChild(sprite);
    }
  }

  // Centered rug accent (if house is large enough and texture loaded)
  if (rugCache && houseArea.w >= 4 && houseArea.h >= 4) {
    const rug = new Sprite(rugCache);
    const rugSize = TILE_SIZE * 2; // 2x2 tile rug
    rug.x = px + Math.floor((houseArea.w * TILE_SIZE - rugSize) / 2);
    rug.y = py + Math.floor((houseArea.h * TILE_SIZE - rugSize) / 2);
    rug.width = rugSize;
    rug.height = rugSize;
    container.addChild(rug);
  }

  // Wall outline border
  const wall = new Graphics();
  wall.rect(px, py, houseArea.w * TILE_SIZE, houseArea.h * TILE_SIZE);
  wall.stroke({ width: 2, color: 0x6a6a72, alpha: 0.8 });
  container.addChild(wall);

  return container;
}

/**
 * Clear all cached enclosure textures. Call on cleanup.
 */
export function clearEnclosureCache(): void {
  // Sprite textures are managed by Assets loader — just clear references
  floorLightCache = null;
  floorDarkCache = null;
  glassCache = null;
  glassWinterCache = null;
  rugCache = null;
}
