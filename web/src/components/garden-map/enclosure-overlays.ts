/**
 * Enclosure overlay rendering for greenhouse, covered, and indoor zones.
 * Returns PixiJS Containers that can be alpha-animated for the peek interaction.
 */

import { Container, Graphics, Sprite, Texture, CanvasSource } from "pixi.js";
import { TILE_SIZE, TileType, generateTilePattern, renderTileToCanvas } from "./tiles";

// Cached floor texture (created once, reused for all tiles)
let floorTextureCache: Texture | null = null;

/**
 * Create a greenhouse overlay container with glass panes and frame.
 * @param x - Left edge in pixels
 * @param y - Top edge in pixels
 * @param w - Width in pixels
 * @param h - Height in pixels
 */
export function createGreenhouseOverlay(x: number, y: number, w: number, h: number): Container {
  const container = new Container();
  container.label = "greenhouse-overlay";

  // Semi-transparent green-tinted glass fill
  const glass = new Graphics();
  glass.rect(x, y, w, h);
  glass.fill({ color: 0x88ccaa, alpha: 0.3 });
  container.addChild(glass);

  // Glass pane divider lines (vertical + horizontal every ~24px)
  const dividers = new Graphics();
  // Vertical dividers
  for (let dx = 24; dx < w; dx += 24) {
    dividers.moveTo(x + dx, y);
    dividers.lineTo(x + dx, y + h);
  }
  // Horizontal dividers
  for (let dy = 24; dy < h; dy += 24) {
    dividers.moveTo(x, y + dy);
    dividers.lineTo(x + w, y + dy);
  }
  dividers.stroke({ width: 1, color: 0x667766, alpha: 0.25 });
  container.addChild(dividers);

  // Frame border
  const frame = new Graphics();
  frame.rect(x, y, w, h);
  frame.stroke({ width: 2, color: 0x667766, alpha: 1 });
  container.addChild(frame);

  // Corner posts (small filled rects at corners)
  const postSize = 4;
  const posts = new Graphics();
  // Top-left
  posts.rect(x, y, postSize, postSize);
  // Top-right
  posts.rect(x + w - postSize, y, postSize, postSize);
  // Bottom-left
  posts.rect(x, y + h - postSize, postSize, postSize);
  // Bottom-right
  posts.rect(x + w - postSize, y + h - postSize, postSize, postSize);
  posts.fill({ color: 0x556655, alpha: 1 });
  container.addChild(posts);

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
 * Create the house floor overlay — a grid of FLOOR_WOOD tile sprites
 * filling the house footprint. Starts hidden (alpha=0).
 * @param houseArea - House bounds in TILE coordinates (will be multiplied by TILE_SIZE)
 */
export function createHouseFloor(houseArea: { x: number; y: number; w: number; h: number }): Container {
  const container = new Container();
  container.label = "house-floor";
  container.alpha = 0; // Hidden by default

  // Create or reuse the floor texture
  if (!floorTextureCache) {
    const pixels = generateTilePattern(TileType.FLOOR_WOOD, 0);
    const canvas = renderTileToCanvas(pixels);
    const source = new CanvasSource({
      resource: canvas,
      resolution: 1,
      scaleMode: "nearest",
    });
    floorTextureCache = new Texture({ source });
  }

  // Fill the house area with floor tiles
  const px = houseArea.x * TILE_SIZE;
  const py = houseArea.y * TILE_SIZE;

  for (let ty = 0; ty < houseArea.h; ty++) {
    for (let tx = 0; tx < houseArea.w; tx++) {
      const sprite = new Sprite(floorTextureCache);
      sprite.x = px + tx * TILE_SIZE;
      sprite.y = py + ty * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      container.addChild(sprite);
    }
  }

  // Wall outline border
  const wall = new Graphics();
  wall.rect(px, py, houseArea.w * TILE_SIZE, houseArea.h * TILE_SIZE);
  wall.stroke({ width: 2, color: 0x6a6a72, alpha: 0.8 });
  container.addChild(wall);

  return container;
}

/**
 * Clear the cached floor texture. Call on cleanup.
 */
export function clearEnclosureCache(): void {
  if (floorTextureCache) {
    floorTextureCache.destroy(true);
    floorTextureCache = null;
  }
}
