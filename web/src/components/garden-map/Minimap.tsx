/**
 * Minimap overlay showing a bird's-eye view of the property.
 * Rendered as a simple canvas with zone colors and plant dots.
 */

import { useRef, useEffect } from "react";
import type { Location, Structure, Zone, PlantInstance } from "../../api";

interface MinimapProps {
  location: Location;
  structures: Structure[];
  zones: Zone[];
  plants: PlantInstance[];
}

const MINIMAP_WIDTH = 160;
const MINIMAP_MAX_HEIGHT = 120;

export default function Minimap({
  location,
  structures,
  zones,
  plants,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lotWidth = location.lotWidth ?? 50;
  const lotDepth = location.lotDepth ?? 50;

  // Maintain aspect ratio
  const aspect = lotWidth / lotDepth;
  const minimapHeight = Math.min(MINIMAP_MAX_HEIGHT, MINIMAP_WIDTH / aspect);
  const minimapWidth = minimapHeight * aspect;

  const scaleX = minimapWidth / lotWidth;
  const scaleY = minimapHeight / lotDepth;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = minimapWidth * dpr;
    canvas.height = minimapHeight * dpr;
    ctx.scale(dpr, dpr);

    // Background (grass)
    ctx.fillStyle = "#2d5a1e";
    ctx.fillRect(0, 0, minimapWidth, minimapHeight);

    // Structures
    ctx.fillStyle = "#4a4a52";
    for (const struct of structures) {
      ctx.fillRect(
        struct.posX * scaleX,
        struct.posY * scaleY,
        struct.width * scaleX,
        struct.depth * scaleY,
      );
    }

    // Zones
    for (const zone of zones) {
      const color = zone.color ?? "#8b7355";
      ctx.fillStyle = color + "66"; // 40% opacity
      ctx.fillRect(
        zone.posX * scaleX,
        zone.posY * scaleY,
        zone.width * scaleX,
        zone.depth * scaleY,
      );
      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        zone.posX * scaleX,
        zone.posY * scaleY,
        zone.width * scaleX,
        zone.depth * scaleY,
      );
    }

    // Plant dots
    const plantsByZone = new Map<number, PlantInstance[]>();
    for (const p of plants) {
      if (p.zoneId) {
        const list = plantsByZone.get(p.zoneId) ?? [];
        list.push(p);
        plantsByZone.set(p.zoneId, list);
      }
    }

    for (const zone of zones) {
      const zonePlants = plantsByZone.get(zone.id) ?? [];
      if (zonePlants.length === 0) continue;

      const zx = zone.posX * scaleX;
      const zy = zone.posY * scaleY;
      const zw = zone.width * scaleX;
      const zh = zone.depth * scaleY;

      zonePlants.forEach((plant, i) => {
        const cols = Math.ceil(Math.sqrt(zonePlants.length));
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rows = Math.ceil(zonePlants.length / cols);

        const px = zx + zw * ((col + 0.5) / cols);
        const py = zy + zh * ((row + 0.5) / rows);

        // Color by mood
        const moodColors: Record<string, string> = {
          happy: "#22c55e",
          thirsty: "#60a5fa",
          hot: "#f97316",
          cold: "#7dd3fc",
          wilting: "#d97706",
          sleeping: "#78716c",
          new: "#34d399",
        };

        ctx.fillStyle = moodColors[plant.mood] ?? "#22c55e";
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Lot border
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(0, 0, minimapWidth, minimapHeight);
    ctx.setLineDash([]);
  }, [location, structures, zones, plants, minimapWidth, minimapHeight, scaleX, scaleY]);

  return (
    <div className="fixed bottom-20 left-4 z-[55] pointer-events-auto">
      <div className="bg-stone-900/90 border border-stone-700 rounded-lg p-1.5 backdrop-blur-sm">
        <canvas
          ref={canvasRef}
          style={{
            width: minimapWidth,
            height: minimapHeight,
            imageRendering: "pixelated",
          }}
          className="rounded"
        />
      </div>
    </div>
  );
}
