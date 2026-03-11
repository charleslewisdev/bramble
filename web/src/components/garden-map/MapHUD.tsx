/**
 * Heads-up display overlay for the garden map.
 * Rendered as React DOM on top of the PixiJS canvas.
 */

import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Thermometer,
  Droplets,
  Wind,
  Sprout,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Location, Weather, PlantInstance } from "../../api";
import type { PlantMood } from "../../api";
import { getWeatherEmoji } from "../../utils/weather";

interface MapHUDProps {
  location: Location;
  weather?: Weather | null;
  plants: PlantInstance[];
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
}

const MOOD_SUMMARY: Record<string, { label: string; color: string }> = {
  happy: { label: "Happy", color: "text-emerald-400" },
  thirsty: { label: "Thirsty", color: "text-sky-400" },
  hot: { label: "Hot", color: "text-orange-400" },
  cold: { label: "Cold", color: "text-blue-400" },
  wilting: { label: "Struggling", color: "text-amber-400" },
  sleeping: { label: "Dormant", color: "text-stone-400" },
  new: { label: "New", color: "text-emerald-300" },
};

export default function MapHUD({
  location,
  weather,
  plants,
  onZoomIn,
  onZoomOut,
  onFitView,
  showLabels,
  onToggleLabels,
}: MapHUDProps) {
  // Calculate mood distribution
  const moodCounts = plants.reduce<Record<string, number>>((acc, p) => {
    acc[p.mood] = (acc[p.mood] ?? 0) + 1;
    return acc;
  }, {});

  const needsAttention = plants.filter(
    (p) => p.mood === "thirsty" || p.mood === "wilting" || p.mood === "hot" || p.mood === "cold",
  ).length;

  return (
    <>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between p-4">
          {/* Back button + location name */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link
              to={`/locations/${location.id}`}
              className="flex items-center gap-2 px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg text-stone-300 hover:text-stone-100 text-sm font-display transition-colors backdrop-blur-sm"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <div className="px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg backdrop-blur-sm">
              <h1 className="text-sm font-bold font-display text-stone-100">
                {location.name}
              </h1>
              {location.address && (
                <p className="text-xs text-stone-500 font-mono">
                  {location.address}
                </p>
              )}
            </div>
          </div>

          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-2 px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg backdrop-blur-sm pointer-events-auto">
              <span className="text-lg">{getWeatherEmoji(weather.conditions ?? "")}</span>
              {weather.temperature != null && (
                <span className="flex items-center gap-1 text-sm text-stone-200 font-mono">
                  <Thermometer size={12} className="text-stone-400" />
                  {Math.round(weather.temperature)}°
                </span>
              )}
              {weather.humidity != null && (
                <span className="flex items-center gap-1 text-sm text-stone-400 font-mono">
                  <Droplets size={12} />
                  {weather.humidity}%
                </span>
              )}
              {weather.windSpeed != null && (
                <span className="flex items-center gap-1 text-sm text-stone-400 font-mono">
                  <Wind size={12} />
                  {Math.round(weather.windSpeed)}mph
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side controls */}
      <div className="fixed top-1/2 right-4 -translate-y-1/2 z-40 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={onZoomIn}
          className="p-2 bg-stone-900/90 border border-stone-700 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800/90 transition-colors backdrop-blur-sm"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 bg-stone-900/90 border border-stone-700 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800/90 transition-colors backdrop-blur-sm"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={onFitView}
          className="p-2 bg-stone-900/90 border border-stone-700 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800/90 transition-colors backdrop-blur-sm"
          title="Fit to view"
          aria-label="Fit to view"
        >
          <Maximize2 size={18} />
        </button>
        <div className="h-px bg-stone-700" />
        <button
          onClick={onToggleLabels}
          className="p-2 bg-stone-900/90 border border-stone-700 rounded-lg text-stone-300 hover:text-stone-100 hover:bg-stone-800/90 transition-colors backdrop-blur-sm"
          title={showLabels ? "Hide labels" : "Show labels"}
          aria-label={showLabels ? "Hide labels" : "Show labels"}
        >
          {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* Bottom bar — plant summary */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between p-4">
          {/* Plant count + mood summary */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg backdrop-blur-sm">
              <Sprout size={16} className="text-emerald-400" />
              <span className="text-sm font-mono text-stone-200">
                {plants.length} plants
              </span>
              {needsAttention > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-600/30 text-amber-400 text-xs rounded-full font-semibold">
                  {needsAttention} need attention
                </span>
              )}
            </div>

            {/* Mood breakdown */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg backdrop-blur-sm">
              {Object.entries(moodCounts).map(([mood, count]) => {
                const info = MOOD_SUMMARY[mood];
                if (!info) return null;
                return (
                  <span
                    key={mood}
                    className={`text-xs font-mono ${info.color}`}
                  >
                    {count} {info.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-stone-900/90 border border-stone-700 rounded-lg backdrop-blur-sm pointer-events-auto">
            <span className="text-xs text-stone-500 font-mono">
              scroll to zoom · drag to pan · click plants for details
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
