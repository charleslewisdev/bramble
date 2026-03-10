import type { ReactElement } from "react";
import type { PlantType, PlantMood } from "../../api";
import { getSpriteType } from "../../api";

interface PlantSpriteProps {
  type: PlantType;
  mood: PlantMood;
  size?: number;
  className?: string;
}

// Pixel grid helper — each "pixel" is a rect in a 16x16 grid
function px(
  x: number,
  y: number,
  fill: string,
  key: string,
  scale: number
): ReactElement {
  const s = scale;
  return (
    <rect
      key={key}
      x={x * s}
      y={y * s}
      width={s}
      height={s}
      fill={fill}
      rx={0}
    />
  );
}

// Color palettes per mood
function moodTint(base: string, mood: PlantMood): string {
  const tints: Record<PlantMood, Record<string, string>> = {
    happy: {},
    thirsty: {
      "#22c55e": "#6b8f71",
      "#16a34a": "#5a7a60",
      "#15803d": "#4d6b52",
      "#166534": "#3f5c43",
      "#f87171": "#c9a0a0",
      "#ef4444": "#b08080",
      "#c084fc": "#9a8aaa",
      "#a855f7": "#8a7a9a",
      "#facc15": "#c9c080",
      "#eab308": "#b0a870",
    },
    cold: {
      "#22c55e": "#5eafc5",
      "#16a34a": "#4e9fb5",
      "#15803d": "#3e8fa5",
      "#166534": "#2e7f95",
      "#f87171": "#7171f8",
      "#ef4444": "#4444ef",
    },
    hot: {
      "#22c55e": "#c5a55e",
      "#16a34a": "#b5954e",
      "#15803d": "#a5853e",
      "#166534": "#95752e",
    },
    wilting: {
      "#22c55e": "#8b7355",
      "#16a34a": "#7b6345",
      "#15803d": "#6b5335",
      "#166534": "#5b4325",
      "#f87171": "#8b6355",
      "#ef4444": "#7b5345",
      "#c084fc": "#8b7365",
      "#a855f7": "#7b6355",
      "#facc15": "#8b8355",
      "#eab308": "#7b7345",
    },
    sleeping: {
      "#22c55e": "#1a6b33",
      "#16a34a": "#145528",
      "#15803d": "#0e3f1d",
      "#166534": "#082912",
    },
    new: {},
  };

  return tints[mood]?.[base] ?? base;
}

function getPlantPixels(type: PlantType): Array<[number, number, string]> {
  switch (type) {
    case "flower":
      return [
        // Stem
        [7, 12, "#16a34a"], [7, 11, "#16a34a"], [7, 10, "#16a34a"],
        [7, 9, "#16a34a"], [8, 12, "#16a34a"], [8, 11, "#16a34a"],
        // Leaves
        [6, 11, "#22c55e"], [5, 10, "#22c55e"], [9, 11, "#22c55e"],
        [10, 10, "#22c55e"],
        // Petals
        [7, 5, "#f87171"], [8, 5, "#f87171"],
        [6, 6, "#f87171"], [9, 6, "#f87171"],
        [5, 7, "#ef4444"], [10, 7, "#ef4444"],
        [6, 8, "#f87171"], [9, 8, "#f87171"],
        [7, 8, "#f87171"], [8, 8, "#f87171"],
        // Center
        [7, 6, "#facc15"], [8, 6, "#facc15"],
        [7, 7, "#eab308"], [8, 7, "#eab308"],
        // Pot
        [5, 13, "#a16207"], [6, 13, "#a16207"], [7, 13, "#a16207"],
        [8, 13, "#a16207"], [9, 13, "#a16207"], [10, 13, "#a16207"],
        [6, 14, "#92400e"], [7, 14, "#92400e"], [8, 14, "#92400e"],
        [9, 14, "#92400e"],
      ];
    case "shrub":
      return [
        // Trunk
        [7, 12, "#92400e"], [8, 12, "#92400e"],
        [7, 13, "#92400e"], [8, 13, "#92400e"],
        [7, 14, "#92400e"], [8, 14, "#92400e"],
        // Foliage
        [4, 7, "#22c55e"], [5, 7, "#16a34a"], [6, 7, "#22c55e"],
        [7, 7, "#16a34a"], [8, 7, "#22c55e"], [9, 7, "#16a34a"],
        [10, 7, "#22c55e"], [11, 7, "#16a34a"],
        [3, 8, "#16a34a"], [4, 8, "#22c55e"], [5, 8, "#16a34a"],
        [6, 8, "#22c55e"], [7, 8, "#16a34a"], [8, 8, "#22c55e"],
        [9, 8, "#16a34a"], [10, 8, "#22c55e"], [11, 8, "#16a34a"],
        [12, 8, "#22c55e"],
        [4, 9, "#16a34a"], [5, 9, "#22c55e"], [6, 9, "#15803d"],
        [7, 9, "#22c55e"], [8, 9, "#15803d"], [9, 9, "#22c55e"],
        [10, 9, "#16a34a"], [11, 9, "#22c55e"],
        [5, 10, "#15803d"], [6, 10, "#16a34a"], [7, 10, "#15803d"],
        [8, 10, "#16a34a"], [9, 10, "#15803d"], [10, 10, "#16a34a"],
        [5, 11, "#166534"], [6, 11, "#15803d"], [7, 11, "#166534"],
        [8, 11, "#15803d"], [9, 11, "#166534"], [10, 11, "#15803d"],
        // Top
        [5, 6, "#22c55e"], [6, 6, "#16a34a"], [7, 6, "#22c55e"],
        [8, 6, "#16a34a"], [9, 6, "#22c55e"], [10, 6, "#16a34a"],
        [6, 5, "#22c55e"], [7, 5, "#16a34a"], [8, 5, "#22c55e"],
        [9, 5, "#16a34a"],
      ];
    case "tree":
      return [
        // Trunk
        [7, 11, "#92400e"], [8, 11, "#92400e"],
        [7, 12, "#92400e"], [8, 12, "#78350f"],
        [7, 13, "#78350f"], [8, 13, "#92400e"],
        [7, 14, "#78350f"], [8, 14, "#78350f"],
        // Canopy
        [6, 3, "#16a34a"], [7, 3, "#22c55e"], [8, 3, "#16a34a"], [9, 3, "#22c55e"],
        [5, 4, "#22c55e"], [6, 4, "#16a34a"], [7, 4, "#22c55e"],
        [8, 4, "#16a34a"], [9, 4, "#22c55e"], [10, 4, "#16a34a"],
        [4, 5, "#16a34a"], [5, 5, "#22c55e"], [6, 5, "#15803d"],
        [7, 5, "#22c55e"], [8, 5, "#15803d"], [9, 5, "#22c55e"],
        [10, 5, "#15803d"], [11, 5, "#16a34a"],
        [4, 6, "#22c55e"], [5, 6, "#15803d"], [6, 6, "#16a34a"],
        [7, 6, "#15803d"], [8, 6, "#16a34a"], [9, 6, "#15803d"],
        [10, 6, "#16a34a"], [11, 6, "#22c55e"],
        [4, 7, "#15803d"], [5, 7, "#16a34a"], [6, 7, "#15803d"],
        [7, 7, "#166534"], [8, 7, "#15803d"], [9, 7, "#166534"],
        [10, 7, "#16a34a"], [11, 7, "#15803d"],
        [5, 8, "#166534"], [6, 8, "#15803d"], [7, 8, "#166534"],
        [8, 8, "#15803d"], [9, 8, "#166534"], [10, 8, "#15803d"],
        [5, 9, "#15803d"], [6, 9, "#166534"], [7, 9, "#15803d"],
        [8, 9, "#166534"], [9, 9, "#15803d"], [10, 9, "#166534"],
        [6, 10, "#166534"], [7, 10, "#15803d"], [8, 10, "#166534"],
        [9, 10, "#15803d"],
      ];
    case "herb":
      return [
        // Multiple thin stems
        [6, 14, "#16a34a"], [6, 13, "#16a34a"], [6, 12, "#22c55e"],
        [6, 11, "#22c55e"], [6, 10, "#22c55e"],
        [8, 14, "#16a34a"], [8, 13, "#16a34a"], [8, 12, "#22c55e"],
        [8, 11, "#22c55e"], [8, 10, "#22c55e"], [8, 9, "#22c55e"],
        [10, 14, "#16a34a"], [10, 13, "#16a34a"], [10, 12, "#22c55e"],
        [10, 11, "#22c55e"],
        // Leaves
        [5, 9, "#22c55e"], [5, 10, "#16a34a"], [7, 9, "#16a34a"],
        [7, 8, "#22c55e"], [9, 8, "#22c55e"], [9, 9, "#16a34a"],
        [9, 10, "#22c55e"], [11, 10, "#16a34a"], [11, 11, "#22c55e"],
        // Top leaves
        [5, 8, "#22c55e"], [7, 7, "#16a34a"], [8, 8, "#16a34a"],
        [9, 7, "#22c55e"],
        // Pot
        [4, 15, "#a16207"], [5, 15, "#a16207"], [6, 15, "#a16207"],
        [7, 15, "#a16207"], [8, 15, "#a16207"], [9, 15, "#a16207"],
        [10, 15, "#a16207"], [11, 15, "#a16207"],
      ];
    case "fern":
      return [
        // Central stem
        [7, 14, "#15803d"], [7, 13, "#16a34a"], [7, 12, "#16a34a"],
        [8, 14, "#15803d"], [8, 13, "#16a34a"],
        // Fronds left
        [3, 8, "#22c55e"], [4, 8, "#16a34a"], [5, 9, "#22c55e"],
        [4, 9, "#16a34a"], [5, 10, "#15803d"], [6, 10, "#16a34a"],
        [6, 11, "#15803d"],
        [2, 7, "#22c55e"], [3, 7, "#16a34a"], [4, 7, "#22c55e"],
        [3, 6, "#22c55e"], [4, 6, "#16a34a"],
        // Fronds right
        [11, 8, "#22c55e"], [10, 8, "#16a34a"], [10, 9, "#22c55e"],
        [11, 9, "#16a34a"], [9, 10, "#15803d"], [10, 10, "#16a34a"],
        [9, 11, "#15803d"],
        [12, 7, "#22c55e"], [11, 7, "#16a34a"], [10, 7, "#22c55e"],
        [11, 6, "#22c55e"], [10, 6, "#16a34a"],
        // Center fronds
        [6, 8, "#16a34a"], [7, 8, "#22c55e"], [8, 8, "#16a34a"],
        [7, 7, "#22c55e"], [8, 7, "#16a34a"],
        [6, 9, "#22c55e"], [7, 9, "#16a34a"], [8, 9, "#22c55e"],
        [9, 9, "#16a34a"],
        // Pot
        [5, 15, "#a16207"], [6, 15, "#a16207"], [7, 15, "#a16207"],
        [8, 15, "#a16207"], [9, 15, "#a16207"], [10, 15, "#a16207"],
      ];
    case "succulent":
      return [
        // Rosette pattern
        [7, 7, "#22c55e"], [8, 7, "#16a34a"],
        [6, 8, "#22c55e"], [7, 8, "#16a34a"], [8, 8, "#22c55e"], [9, 8, "#16a34a"],
        [5, 9, "#16a34a"], [6, 9, "#22c55e"], [7, 9, "#15803d"],
        [8, 9, "#22c55e"], [9, 9, "#16a34a"], [10, 9, "#22c55e"],
        [4, 10, "#22c55e"], [5, 10, "#16a34a"], [6, 10, "#15803d"],
        [7, 10, "#16a34a"], [8, 10, "#15803d"], [9, 10, "#16a34a"],
        [10, 10, "#22c55e"], [11, 10, "#16a34a"],
        [5, 11, "#15803d"], [6, 11, "#16a34a"], [7, 11, "#15803d"],
        [8, 11, "#16a34a"], [9, 11, "#15803d"], [10, 11, "#16a34a"],
        [6, 12, "#166534"], [7, 12, "#15803d"], [8, 12, "#166534"],
        [9, 12, "#15803d"],
        // Pot
        [4, 13, "#a16207"], [5, 13, "#a16207"], [6, 13, "#a16207"],
        [7, 13, "#a16207"], [8, 13, "#a16207"], [9, 13, "#a16207"],
        [10, 13, "#a16207"], [11, 13, "#a16207"],
        [5, 14, "#92400e"], [6, 14, "#92400e"], [7, 14, "#92400e"],
        [8, 14, "#92400e"], [9, 14, "#92400e"], [10, 14, "#92400e"],
      ];
    case "cactus":
      return [
        // Main body
        [7, 5, "#16a34a"], [8, 5, "#22c55e"],
        [7, 6, "#22c55e"], [8, 6, "#16a34a"],
        [7, 7, "#16a34a"], [8, 7, "#22c55e"],
        [7, 8, "#22c55e"], [8, 8, "#16a34a"],
        [7, 9, "#16a34a"], [8, 9, "#22c55e"],
        [7, 10, "#22c55e"], [8, 10, "#16a34a"],
        [7, 11, "#16a34a"], [8, 11, "#22c55e"],
        // Left arm
        [5, 7, "#22c55e"], [6, 7, "#16a34a"],
        [5, 8, "#16a34a"], [6, 8, "#22c55e"],
        [5, 6, "#22c55e"],
        // Right arm
        [9, 8, "#16a34a"], [10, 8, "#22c55e"],
        [9, 9, "#22c55e"], [10, 9, "#16a34a"],
        [10, 7, "#16a34a"],
        // Flower on top
        [7, 4, "#f87171"], [8, 4, "#ef4444"],
        // Spines
        [6, 6, "#facc15"], [9, 7, "#facc15"], [6, 9, "#facc15"],
        [9, 10, "#facc15"],
        // Pot
        [5, 12, "#a16207"], [6, 12, "#a16207"], [7, 12, "#a16207"],
        [8, 12, "#a16207"], [9, 12, "#a16207"], [10, 12, "#a16207"],
        [6, 13, "#92400e"], [7, 13, "#92400e"], [8, 13, "#92400e"],
        [9, 13, "#92400e"],
      ];
    case "vine":
      return [
        // Main vine curves
        [3, 4, "#22c55e"], [4, 5, "#16a34a"], [5, 5, "#22c55e"],
        [6, 6, "#16a34a"], [7, 6, "#22c55e"], [8, 7, "#16a34a"],
        [9, 7, "#22c55e"], [10, 8, "#16a34a"], [11, 8, "#22c55e"],
        [12, 9, "#16a34a"],
        // Second vine
        [4, 7, "#16a34a"], [5, 8, "#22c55e"], [6, 8, "#16a34a"],
        [7, 9, "#22c55e"], [8, 9, "#16a34a"], [9, 10, "#22c55e"],
        [10, 10, "#16a34a"],
        // Leaves
        [3, 3, "#22c55e"], [2, 4, "#16a34a"],
        [6, 5, "#22c55e"], [7, 5, "#16a34a"],
        [10, 7, "#22c55e"], [11, 7, "#16a34a"],
        [5, 7, "#22c55e"], [4, 8, "#16a34a"],
        [8, 8, "#22c55e"], [9, 9, "#16a34a"],
        // Small flowers
        [3, 2, "#c084fc"], [7, 4, "#c084fc"], [11, 6, "#c084fc"],
        [5, 9, "#a855f7"],
        // Support/trellis
        [2, 3, "#78350f"], [2, 5, "#78350f"], [2, 7, "#78350f"],
        [2, 9, "#78350f"], [2, 11, "#78350f"],
      ];
    case "grass":
      return [
        // Multiple grass blades
        [4, 14, "#16a34a"], [4, 13, "#22c55e"], [4, 12, "#22c55e"],
        [3, 11, "#22c55e"],
        [6, 14, "#22c55e"], [6, 13, "#16a34a"], [6, 12, "#22c55e"],
        [6, 11, "#16a34a"], [6, 10, "#22c55e"],
        [8, 14, "#16a34a"], [8, 13, "#22c55e"], [8, 12, "#16a34a"],
        [8, 11, "#22c55e"], [8, 10, "#16a34a"], [8, 9, "#22c55e"],
        [9, 8, "#22c55e"],
        [10, 14, "#22c55e"], [10, 13, "#16a34a"], [10, 12, "#22c55e"],
        [10, 11, "#16a34a"], [10, 10, "#22c55e"],
        [12, 14, "#16a34a"], [12, 13, "#22c55e"], [12, 12, "#22c55e"],
        [13, 11, "#22c55e"],
        // Extra blades
        [5, 13, "#15803d"], [7, 12, "#15803d"], [9, 13, "#15803d"],
        [11, 12, "#15803d"],
      ];
    case "bulb":
      return [
        // Bulb underground
        [6, 13, "#a16207"], [7, 13, "#92400e"], [8, 13, "#a16207"],
        [9, 13, "#92400e"],
        [6, 14, "#92400e"], [7, 14, "#a16207"], [8, 14, "#92400e"],
        [9, 14, "#a16207"],
        // Roots
        [5, 15, "#78350f"], [7, 15, "#78350f"], [10, 15, "#78350f"],
        // Stem
        [7, 12, "#16a34a"], [8, 12, "#16a34a"],
        [7, 11, "#22c55e"], [8, 11, "#22c55e"],
        [7, 10, "#22c55e"],
        // Leaves
        [6, 10, "#22c55e"], [5, 9, "#22c55e"],
        [9, 10, "#16a34a"], [10, 9, "#16a34a"],
        // Flower
        [6, 7, "#c084fc"], [7, 7, "#a855f7"], [8, 7, "#c084fc"],
        [5, 8, "#a855f7"], [6, 8, "#c084fc"], [7, 8, "#facc15"],
        [8, 8, "#c084fc"], [9, 8, "#a855f7"],
        [6, 9, "#c084fc"], [7, 9, "#a855f7"], [8, 9, "#c084fc"],
        [7, 6, "#c084fc"],
      ];
    case "vegetable":
      return [
        // Leaves on top
        [6, 5, "#22c55e"], [7, 5, "#16a34a"], [8, 5, "#22c55e"],
        [9, 5, "#16a34a"],
        [5, 6, "#16a34a"], [6, 6, "#22c55e"], [9, 6, "#22c55e"],
        [10, 6, "#16a34a"],
        // Stem
        [7, 6, "#16a34a"], [8, 6, "#16a34a"],
        [7, 7, "#16a34a"], [8, 7, "#16a34a"],
        // Tomato body
        [6, 8, "#ef4444"], [7, 8, "#f87171"], [8, 8, "#ef4444"],
        [9, 8, "#f87171"],
        [5, 9, "#ef4444"], [6, 9, "#f87171"], [7, 9, "#ef4444"],
        [8, 9, "#f87171"], [9, 9, "#ef4444"], [10, 9, "#f87171"],
        [5, 10, "#dc2626"], [6, 10, "#ef4444"], [7, 10, "#dc2626"],
        [8, 10, "#ef4444"], [9, 10, "#dc2626"], [10, 10, "#ef4444"],
        [6, 11, "#dc2626"], [7, 11, "#ef4444"], [8, 11, "#dc2626"],
        [9, 11, "#ef4444"],
        [7, 12, "#dc2626"], [8, 12, "#dc2626"],
        // Ground line
        [3, 13, "#78350f"], [4, 13, "#92400e"], [5, 13, "#78350f"],
        [6, 13, "#92400e"], [7, 13, "#78350f"], [8, 13, "#92400e"],
        [9, 13, "#78350f"], [10, 13, "#92400e"], [11, 13, "#78350f"],
        [12, 13, "#92400e"],
      ];
    case "fruit":
      return [
        // Tree trunk
        [7, 10, "#92400e"], [8, 10, "#78350f"],
        [7, 11, "#78350f"], [8, 11, "#92400e"],
        [7, 12, "#92400e"], [8, 12, "#78350f"],
        [7, 13, "#78350f"], [8, 13, "#92400e"],
        [7, 14, "#92400e"], [8, 14, "#78350f"],
        // Canopy
        [5, 4, "#22c55e"], [6, 4, "#16a34a"], [7, 4, "#22c55e"],
        [8, 4, "#16a34a"], [9, 4, "#22c55e"], [10, 4, "#16a34a"],
        [4, 5, "#16a34a"], [5, 5, "#22c55e"], [6, 5, "#15803d"],
        [7, 5, "#22c55e"], [8, 5, "#15803d"], [9, 5, "#22c55e"],
        [10, 5, "#15803d"], [11, 5, "#16a34a"],
        [4, 6, "#15803d"], [5, 6, "#16a34a"], [6, 6, "#15803d"],
        [7, 6, "#16a34a"], [8, 6, "#15803d"], [9, 6, "#16a34a"],
        [10, 6, "#15803d"], [11, 6, "#16a34a"],
        [4, 7, "#16a34a"], [5, 7, "#15803d"], [6, 7, "#16a34a"],
        [7, 7, "#15803d"], [8, 7, "#16a34a"], [9, 7, "#15803d"],
        [10, 7, "#16a34a"], [11, 7, "#15803d"],
        [5, 8, "#166534"], [6, 8, "#15803d"], [7, 8, "#166534"],
        [8, 8, "#15803d"], [9, 8, "#166534"], [10, 8, "#15803d"],
        [6, 9, "#166534"], [7, 9, "#15803d"], [8, 9, "#166534"],
        [9, 9, "#15803d"],
        // Fruits
        [5, 6, "#ef4444"], [9, 5, "#ef4444"], [7, 7, "#ef4444"],
        [10, 7, "#ef4444"],
      ];
    default:
      return [
        [7, 10, "#22c55e"], [8, 10, "#22c55e"],
        [7, 11, "#16a34a"], [8, 11, "#16a34a"],
        [7, 12, "#15803d"], [8, 12, "#15803d"],
      ];
  }
}

export default function PlantSprite({
  type,
  mood,
  size = 64,
  className,
}: PlantSpriteProps) {
  const scale = size / 16;
  const resolvedType = getSpriteType(type);
  const pixels = getPlantPixels(resolvedType);

  // Mood-based transform
  const moodTransform =
    mood === "cold"
      ? "translate(0.5, 0)"
      : mood === "wilting"
        ? "translate(0, 1)"
        : "";

  const moodOpacity = mood === "sleeping" ? 0.6 : 1;

  return (
    <span className={className} style={{ display: "inline-block", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ imageRendering: "pixelated", opacity: moodOpacity }}
        aria-label={`${type} plant feeling ${mood}`}
      >
        <g transform={moodTransform}>
          {pixels.map(([x, y, color], i) =>
            px(x, y, moodTint(color, mood), `${i}`, scale)
          )}
        </g>

        {/* Mood overlays */}
        {mood === "happy" && (
          <>
            <rect x={12 * scale} y={3 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
            <rect x={13 * scale} y={2 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
            <rect x={14 * scale} y={3.5 * scale} width={scale * 0.5} height={scale * 0.5} fill="#facc15" />
          </>
        )}

        {mood === "new" && (
          <>
            <rect x={12 * scale} y={2 * scale} width={scale * 0.6} height={scale * 0.6} fill="#34d399" />
            <rect x={13.5 * scale} y={4 * scale} width={scale * 0.4} height={scale * 0.4} fill="#6ee7b7" />
            <rect x={2 * scale} y={3 * scale} width={scale * 0.5} height={scale * 0.5} fill="#34d399" />
            <rect x={1 * scale} y={5 * scale} width={scale * 0.4} height={scale * 0.4} fill="#6ee7b7" />
          </>
        )}

        {mood === "thirsty" && (
          <>
            <rect x={12 * scale} y={8 * scale} width={scale * 0.8} height={scale * 1.2} fill="#60a5fa" rx={scale * 0.3} />
            <rect x={13.5 * scale} y={10 * scale} width={scale * 0.6} height={scale * 0.9} fill="#93c5fd" rx={scale * 0.2} />
          </>
        )}

        {mood === "hot" && (
          <>
            <rect x={13 * scale} y={4 * scale} width={scale * 0.4} height={scale * 2} fill="#f97316" opacity={0.6} />
            <rect x={14 * scale} y={5 * scale} width={scale * 0.4} height={scale * 1.5} fill="#fb923c" opacity={0.5} />
            <rect x={1 * scale} y={5 * scale} width={scale * 0.4} height={scale * 1.8} fill="#f97316" opacity={0.6} />
          </>
        )}

        {mood === "sleeping" && (
          <>
            <text x={11 * scale} y={4 * scale} fontSize={scale * 2} fill="#a8a29e" fontFamily="monospace">z</text>
            <text x={12.5 * scale} y={2.5 * scale} fontSize={scale * 1.5} fill="#78716c" fontFamily="monospace">z</text>
          </>
        )}
      </svg>
    </span>
  );
}

const happyMessages = [
  "Life is good!",
  "I'm thriving over here!",
  "Feeling fantastic today!",
  "Sun's out, leaves out!",
  "Photosynthesis is *chef's kiss*",
];

const thirstyMessages = [
  "Could use a drink...",
  "Getting a bit parched!",
  "Water me? Pretty please?",
  "My soil is looking dusty...",
];

const coldMessages = [
  "Brr, it's chilly!",
  "Can someone grab me a blanket?",
  "Is it frost season already?!",
  "I'm shivering over here!",
];

const hotMessages = [
  "Whew, it's toasty!",
  "I need some shade!",
  "Melting... literally melting...",
  "Who turned up the thermostat?",
];

const wiltingMessages = [
  "I'm not feeling so great...",
  "Help! I need attention!",
  "Things have been better...",
  "SOS! Plant down!",
];

const sleepingMessages = [
  "Zzz...",
  "Shhh, I'm resting...",
  "Dormancy is self-care.",
  "*snores in chlorophyll*",
];

const newMessages = [
  "Hi! I'm new here!",
  "Nice to meet you!",
  "Just planted, feeling great!",
  "First day in the garden!",
];

const moodMessageMap: Record<PlantMood, string[]> = {
  happy: happyMessages,
  thirsty: thirstyMessages,
  cold: coldMessages,
  hot: hotMessages,
  wilting: wiltingMessages,
  sleeping: sleepingMessages,
  new: newMessages,
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getMoodMessage(mood: PlantMood, nickname?: string): string {
  const messages = moodMessageMap[mood] ?? happyMessages;
  const seed = (nickname ?? "plant") + new Date().getHours();
  const index = hashCode(seed) % messages.length;
  const msg = messages[index] ?? messages[0]!;
  if (nickname) {
    const personalPrefixes: Record<PlantMood, string> = {
      happy: `I'm ${nickname} and I'm thriving!`,
      thirsty: `${nickname} here... could use a drink!`,
      cold: `${nickname} is freezing!`,
      hot: `${nickname} needs shade ASAP!`,
      wilting: `${nickname} needs help...`,
      sleeping: `${nickname} is resting... zzz`,
      new: `Hi! I'm ${nickname}, nice to meet you!`,
    };
    // Use deterministic selection for personalized vs generic
    if (hashCode(seed + "personal") % 2 === 0) {
      return personalPrefixes[mood] ?? msg;
    }
  }
  return msg;
}
