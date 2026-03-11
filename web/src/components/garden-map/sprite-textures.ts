/**
 * Loads PNG sprite textures for plant types and applies mood tints via PixiJS.
 * Replaces the old code-generated Graphics API pixel drawing approach.
 */

import { Assets, Sprite, Texture } from "pixi.js";
import type { PlantMood } from "../../api";
import { getSpriteType } from "../../api";

const PLANT_SPRITE_BASE = "/sprites/plants/";
const textureCache = new Map<string, Texture>();

// Mood tints as hex numbers for PixiJS tint property (multiplicative)
const MOOD_TINT_COLORS: Record<string, number> = {
  happy: 0xffffff,
  new: 0xeeffee, // slight green glow
  thirsty: 0xccbbaa, // desaturated/dusty
  cold: 0xaabbdd, // blue shift
  hot: 0xddbb88, // warm/amber
  wilting: 0x998866, // brown/dull
  sleeping: 0x667755, // dark/muted
};

async function loadPlantTexture(type: string): Promise<Texture> {
  const key = `plant:${type}`;
  if (textureCache.has(key)) return textureCache.get(key)!;
  const texture = await Assets.load(`${PLANT_SPRITE_BASE}${type}.png`);
  texture.source.scaleMode = "nearest"; // pixelated scaling
  textureCache.set(key, texture);
  return texture;
}

/**
 * Create a plant sprite from a PNG texture with mood tint applied.
 * This is async because it may need to load the texture from disk.
 * Returns a Sprite (not a Container like the old createPlantGraphics).
 */
export async function createPlantSprite(
  plantType: string | null | undefined,
  mood: PlantMood,
): Promise<Sprite> {
  const resolved = getSpriteType(plantType);
  const texture = await loadPlantTexture(resolved);
  const sprite = new Sprite(texture);
  sprite.tint = MOOD_TINT_COLORS[mood] ?? 0xffffff;
  if (mood === "sleeping") sprite.alpha = 0.6;
  return sprite;
}

/**
 * Pre-load PNG textures for all plant types in a list.
 * Call this before rendering to avoid per-sprite async delays.
 */
export async function preloadPlantTextures(
  plants: Array<{ plantType: string | null | undefined }>,
): Promise<void> {
  const types = new Set(plants.map((p) => getSpriteType(p.plantType)));
  await Promise.all([...types].map((t) => loadPlantTexture(t)));
}

/**
 * Clear all cached textures (for cleanup).
 */
export function clearTextureCache(): void {
  for (const texture of textureCache.values()) {
    texture.destroy(true);
  }
  textureCache.clear();
}
