/**
 * Floating info panel that appears when clicking a plant sprite on the garden map.
 * Rendered as React DOM overlay positioned over the PixiJS canvas.
 */

import { Link } from "react-router-dom";
import { X, ExternalLink, Droplets, Sun, Thermometer } from "lucide-react";
import type { PlantInstance } from "../../api";
import PlantSprite from "../sprites/PlantSprite";
import { getMoodMessage } from "../sprites/PlantSprite";
import type { PlantType, PlantMood } from "../../api";
import { getSpriteType } from "../../api";

interface PlantInfoPanelProps {
  plant: PlantInstance;
  screenX: number;
  screenY: number;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-stone-600",
  planted: "bg-sky-600",
  established: "bg-emerald-600",
  struggling: "bg-amber-600",
  dormant: "bg-stone-500",
  dead: "bg-red-800",
  removed: "bg-stone-700",
};

const MOOD_ICONS: Record<string, typeof Droplets> = {
  thirsty: Droplets,
  hot: Thermometer,
  cold: Thermometer,
  happy: Sun,
};

export default function PlantInfoPanel({
  plant,
  screenX,
  screenY,
  onClose,
}: PlantInfoPanelProps) {
  const ref = plant.plantReference;
  const displayName = plant.nickname ?? ref?.commonName ?? "Unknown Plant";
  const mood = plant.mood as PlantMood;
  const spriteType = getSpriteType(ref?.plantType) as PlantType;
  const MoodIcon = MOOD_ICONS[mood];
  const moodMessage = getMoodMessage(mood, plant.nickname ?? undefined);

  // Position panel near the clicked sprite, but keep it on screen
  const panelWidth = 280;
  const panelHeight = 260;
  const padding = 12;

  let left = screenX - panelWidth / 2;
  let top = screenY - panelHeight - 20;

  // Clamp to viewport
  if (left < padding) left = padding;
  if (left + panelWidth > window.innerWidth - padding) {
    left = window.innerWidth - padding - panelWidth;
  }
  if (top < padding) {
    top = screenY + 30; // Show below if not enough space above
  }
  if (top + panelHeight > window.innerHeight - padding) {
    top = window.innerHeight - padding - panelHeight;
  }

  return (
    <div
      className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        left,
        top,
        width: panelWidth,
      }}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-stone-800">
          <PlantSprite type={spriteType} mood={mood} size={40} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold font-[family-name:var(--font-display)] text-stone-100 text-sm truncate">
              {displayName}
            </h3>
            {ref?.latinName && (
              <p className="text-xs text-stone-500 italic truncate">{ref.latinName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mood message */}
        <div className="px-3 py-2 bg-stone-800/50">
          <p className="text-xs font-[family-name:var(--font-mono)] text-stone-300 flex items-center gap-1.5">
            {MoodIcon && <MoodIcon size={12} className="text-stone-400" />}
            <span className="italic">"{moodMessage}"</span>
          </p>
        </div>

        {/* Stats */}
        <div className="p-3 space-y-2">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">status</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${STATUS_COLORS[plant.status] ?? "bg-stone-600"}`}>
              {plant.status}
            </span>
          </div>

          {/* Zone */}
          {plant.zone && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">zone</span>
              <span className="text-xs text-stone-300">{plant.zone.name}</span>
            </div>
          )}

          {/* Sun requirement */}
          {ref?.sunRequirement && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">sun</span>
              <span className="text-xs text-stone-300">{ref.sunRequirement.replace(/_/g, " ")}</span>
            </div>
          )}

          {/* Water needs */}
          {ref?.waterNeeds && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">water</span>
              <span className="text-xs text-stone-300">{ref.waterNeeds}</span>
            </div>
          )}

          {/* Planted date */}
          {plant.datePlanted && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">planted</span>
              <span className="text-xs text-stone-300">
                {new Date(plant.datePlanted).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-stone-800">
          <Link
            to={`/my-plants/${plant.id}`}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-semibold font-[family-name:var(--font-display)] transition-colors"
          >
            <ExternalLink size={12} />
            View Full Details
          </Link>
        </div>
      </div>
    </div>
  );
}
