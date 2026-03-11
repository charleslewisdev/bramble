/**
 * Loads PNG sprite textures for plant types and applies mood tints via PixiJS.
 * Replaces the old code-generated Graphics API pixel drawing approach.
 */

import { Assets, Sprite, Texture } from "pixi.js";
import type { PlantMood } from "../../api";
import { getSpriteType } from "../../api";
import { createPaletteSwappedTexture, parseBloomColor, clearPaletteCache } from "./palette-swap";
import { loadAnimFrames, PlantAnimator, clearAnimCache } from "./sprite-animation";

const PLANT_SPRITE_BASE = "/sprites/plants/";
const SPECIES_SPRITE_BASE = "/sprites/plants/species/";
const textureCache = new Map<string, Texture>();
// Track species that don't have sprites so we don't retry
const missingSpecies = new Set<string>();

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
 * Try to load a species-specific sprite (e.g. "sunflower", "lavender").
 * Returns the texture if it exists, null otherwise. Caches misses.
 */
async function tryLoadSpeciesTexture(species: string): Promise<Texture | null> {
  const slug = species.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (missingSpecies.has(slug)) return null;
  const key = `species:${slug}`;
  if (textureCache.has(key)) return textureCache.get(key)!;
  try {
    const texture = await Assets.load(`${SPECIES_SPRITE_BASE}${slug}.png`);
    texture.source.scaleMode = "nearest";
    textureCache.set(key, texture);
    return texture;
  } catch {
    missingSpecies.add(slug);
    return null;
  }
}

/**
 * Create a plant sprite from a PNG texture with status/mood tint applied.
 * Status takes priority for visual treatment when it indicates distress.
 * Returns a Sprite (not a Container like the old createPlantGraphics).
 */
export async function createPlantSprite(
  plantType: string | null | undefined,
  mood: PlantMood,
  status?: string,
  bloomColor?: string | null,
  commonName?: string | null,
): Promise<Sprite> {
  const resolved = getSpriteType(plantType);

  // Try species-specific sprite first, fall back to generic type sprite
  let texture: Texture;
  const speciesTexture = commonName ? await tryLoadSpeciesTexture(commonName) : null;
  texture = speciesTexture ?? await loadPlantTexture(resolved);

  // Apply bloom color palette swap for flowers and bulbs (only if using generic sprite)
  let finalTexture = texture;
  if (!speciesTexture) {
    const parsedColor = parseBloomColor(bloomColor);
    if (parsedColor && (resolved === "flower" || resolved === "bulb")) {
      finalTexture = createPaletteSwappedTexture(texture, parsedColor);
    }
  }

  const sprite = new Sprite(finalTexture);

  // Status-driven visuals take priority for distressed/inactive states
  if (status === "dead") {
    sprite.tint = 0x555544;
    sprite.alpha = 0.5;
  } else if (status === "removed") {
    sprite.tint = 0x444433;
    sprite.alpha = 0.35;
  } else if (status === "struggling") {
    sprite.tint = 0xaa8855;
  } else if (status === "dormant") {
    sprite.tint = 0x667755;
    sprite.alpha = 0.65;
  } else if (status === "planned") {
    sprite.tint = 0xaaddff;
    sprite.alpha = 0.45;
  } else {
    // Healthy statuses (planted, established) use mood-based tinting
    sprite.tint = MOOD_TINT_COLORS[mood] ?? 0xffffff;
    if (mood === "sleeping") sprite.alpha = 0.6;
  }

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
  missingSpecies.clear();
  clearPaletteCache();
  clearAnimCache();
}

/**
 * Try to load animated sprite frames for a plant type.
 * Returns a PlantAnimator if animation exists, null otherwise.
 */
export async function tryLoadPlantAnimation(
  plantType: string | null | undefined,
): Promise<PlantAnimator | null> {
  const resolved = getSpriteType(plantType);
  const frames = await loadAnimFrames(resolved);
  if (!frames) return null;
  return new PlantAnimator(frames);
}
