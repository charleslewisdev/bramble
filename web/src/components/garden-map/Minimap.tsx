/**
 * Minimap overlay showing a bird's-eye view of the property.
 * Uses the abstract map generator for consistent layout with the main canvas.
 */

import { useRef, useEffect } from "react";
import type { Location, Structure, Zone, PlantInstance } from "../../api";
import { generateMap } from "./map-generator";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate the same abstract map used by the main canvas
    const map = generateMap(location, structures, zones);

    // Maintain aspect ratio based on the abstract map dimensions
    const mapAspect = map.width / map.height;
    const minimapHeight = Math.min(MINIMAP_MAX_HEIGHT, MINIMAP_WIDTH / mapAspect);
    const minimapWidth = minimapHeight * mapAspect;

    const scaleX = minimapWidth / map.width;
    const scaleY = minimapHeight / map.height;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = minimapWidth * dpr;
    canvas.height = minimapHeight * dpr;
    canvas.style.width = `${minimapWidth}px`;
    canvas.style.height = `${minimapHeight}px`;
    ctx.scale(dpr, dpr);

    // Background (grass)
    ctx.fillStyle = "#2d5a1e";
    ctx.fillRect(0, 0, minimapWidth, minimapHeight);

    // House area
    if (map.houseArea) {
      ctx.fillStyle = "#4a4a52";
      ctx.fillRect(
        map.houseArea.x * scaleX,
        map.houseArea.y * scaleY,
        map.houseArea.w * scaleX,
        map.houseArea.h * scaleY,
      );
    }

    // Zones (from abstract map zoneAreas)
    for (const zone of zones) {
      const area = map.zoneAreas.get(zone.id);
      if (!area) continue;

      const color = zone.color ?? "#8b7355";
      ctx.fillStyle = color + "66"; // 40% opacity
      ctx.fillRect(
        area.x * scaleX,
        area.y * scaleY,
        area.w * scaleX,
        area.h * scaleY,
      );
      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        area.x * scaleX,
        area.y * scaleY,
        area.w * scaleX,
        area.h * scaleY,
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

      const area = map.zoneAreas.get(zone.id);
      if (!area) continue;

      const zx = area.x * scaleX;
      const zy = area.y * scaleY;
      const zw = area.w * scaleX;
      const zh = area.h * scaleY;

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

    // Map border
    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(0, 0, minimapWidth, minimapHeight);
    ctx.setLineDash([]);
  }, [location, structures, zones, plants]);

  return (
    <div className="fixed bottom-20 left-4 z-[55] pointer-events-auto">
      <div className="bg-stone-900/90 border border-stone-700 rounded-lg p-1.5 backdrop-blur-sm">
        <canvas
          ref={canvasRef}
          style={{
            imageRendering: "pixelated",
          }}
          className="rounded"
        />
      </div>
    </div>
  );
}
