/**
 * Bloom color palette swapping for flower sprites.
 * Analyzes flower PNG for warm-hued "bloom" pixels and recolors them.
 */

import { Texture, CanvasSource } from "pixi.js";

// Target bloom colors — map from bloomColor string to HSL hue shift
const BLOOM_PALETTE: Record<string, { hue: number; satShift?: number; lightShift?: number }> = {
  red: { hue: 0 },
  pink: { hue: 330 },
  purple: { hue: 280 },
  blue: { hue: 220 },
  yellow: { hue: 55 },
  orange: { hue: 30 },
  white: { hue: 0, satShift: -0.8, lightShift: 0.3 },
  lavender: { hue: 270, satShift: -0.3 },
};

// Cache palette-swapped textures
const paletteCache = new Map<string, Texture>();

/**
 * Parse a bloomColor string like "Pink, Purple" into the first recognized color.
 */
export function parseBloomColor(bloomColor: string | null | undefined): string | null {
  if (!bloomColor) return null;
  const colors = bloomColor.toLowerCase().split(/[,&]/);
  for (const c of colors) {
    const trimmed = c.trim();
    if (BLOOM_PALETTE[trimmed]) return trimmed;
  }
  return null;
}

/**
 * Create a palette-swapped texture from a source texture.
 * Detects "bloom" pixels (warm hues in HSL: reds, oranges, pinks, yellows)
 * and shifts them to the target color.
 */
export function createPaletteSwappedTexture(
  sourceTexture: Texture,
  targetColor: string,
): Texture {
  const cacheKey = `${sourceTexture.uid}:${targetColor}`;
  if (paletteCache.has(cacheKey)) return paletteCache.get(cacheKey)!;

  const target = BLOOM_PALETTE[targetColor];
  if (!target) return sourceTexture;

  // Extract pixel data from source
  const source = sourceTexture.source;
  const width = source.width;
  const height = source.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Draw source texture to canvas
  const srcResource = source.resource;
  if (srcResource instanceof HTMLImageElement || srcResource instanceof HTMLCanvasElement) {
    ctx.drawImage(srcResource, 0, 0);
  } else {
    return sourceTexture; // Can't palette swap non-image sources
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a < 10) continue; // skip transparent

    // Convert to HSL
    const [h, s, l] = rgbToHsl(r, g, b);

    // Detect "bloom" pixels: warm hues (roughly red-yellow range: 0-70 or 290-360)
    // with reasonable saturation (not gray/brown)
    const isBloom = s > 0.25 && l > 0.2 && l < 0.85 &&
      ((h >= 0 && h <= 70) || (h >= 290 && h <= 360));

    if (isBloom) {
      const newH = target.hue;
      const newS = Math.max(0, Math.min(1, s + (target.satShift ?? 0)));
      const newL = Math.max(0, Math.min(1, l + (target.lightShift ?? 0)));
      const [nr, ng, nb] = hslToRgb(newH / 360, newS, newL);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const canvasSource = new CanvasSource({
    resource: canvas,
    resolution: 1,
    scaleMode: "nearest",
  });
  const texture = new Texture({ source: canvasSource });
  paletteCache.set(cacheKey, texture);
  return texture;
}

export function clearPaletteCache(): void {
  for (const t of paletteCache.values()) t.destroy(true);
  paletteCache.clear();
}

// --- HSL conversion helpers ---

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
