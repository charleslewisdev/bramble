/**
 * Spritesheet-based plant animation system.
 * Loads multi-frame PNGs (horizontal strip format) and plays them as idle animations.
 * Falls back to static sprite if no animation exists.
 */

import { Assets, Texture, Rectangle } from "pixi.js";

// Animation config per plant type
interface AnimConfig {
  frameCount: number;
  frameDuration: number; // seconds per frame
}

// Default: 4 frames at 0.3s each = gentle 1.2s loop
const DEFAULT_ANIM_CONFIG: AnimConfig = { frameCount: 4, frameDuration: 0.3 };

const ANIM_SPRITE_BASE = "/sprites/plants/anim/";

// Cache: plantType -> array of frame textures (or null if no animation exists)
const animCache = new Map<string, Texture[] | null>();

/**
 * Check if an animated spritesheet exists for a plant type.
 * Animated spritesheets are horizontal strips at /sprites/plants/anim/{type}.png
 * with dimensions (32 * frameCount) x 32.
 */
export async function loadAnimFrames(
  plantType: string,
): Promise<Texture[] | null> {
  if (animCache.has(plantType)) return animCache.get(plantType) ?? null;

  try {
    const texture = await Assets.load(`${ANIM_SPRITE_BASE}${plantType}.png`);
    texture.source.scaleMode = "nearest";

    const config = DEFAULT_ANIM_CONFIG;
    const frameWidth = 32;
    const frames: Texture[] = [];

    for (let i = 0; i < config.frameCount; i++) {
      const frame = new Texture({
        source: texture.source,
        frame: new Rectangle(i * frameWidth, 0, frameWidth, 32),
      });
      frames.push(frame);
    }

    animCache.set(plantType, frames);
    return frames;
  } catch {
    // No animation exists for this type — cache the miss
    animCache.set(plantType, null);
    return null;
  }
}

/**
 * Manages frame cycling for an animated plant sprite.
 */
export class PlantAnimator {
  private frames: Texture[];
  private currentFrame = 0;
  private elapsed = 0;
  private frameDuration: number;

  constructor(frames: Texture[], frameDuration = 0.3) {
    this.frames = frames;
    this.frameDuration = frameDuration;
  }

  /** Returns the current frame texture. Call each tick with dt in seconds. */
  update(dt: number): Texture {
    this.elapsed += dt;
    if (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }
    return this.frames[this.currentFrame]!;
  }

  /** Get current frame without advancing */
  getCurrentFrame(): Texture {
    return this.frames[this.currentFrame]!;
  }
}

export function clearAnimCache(): void {
  // Don't destroy individual frame textures — they share source with the strip texture
  animCache.clear();
}
