/**
 * Full-page interactive pixel art garden map.
 * Renders property as a top-down RPG-style tile map with animated plant sprites.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import {
  useLocation as useLocationData,
  useStructures,
  useZones,
  usePlantInstances,
  useWeather,
  useSunData,
} from "../api/hooks";
import type { PlantInstance } from "../api";
import GardenCanvas from "../components/garden-map/GardenCanvas";
import type { GardenCanvasHandle } from "../components/garden-map/GardenCanvas";
import PlantInfoPanel from "../components/garden-map/PlantInfoPanel";
import MapHUD from "../components/garden-map/MapHUD";
import Minimap from "../components/garden-map/Minimap";
import AmbientOverlay from "../components/garden-map/AmbientOverlay";

export default function GardenMap() {
  const { id } = useParams<{ id: string }>();
  const locationId = id ? Number(id) : undefined;

  const { data: location, isLoading: loadingLocation } = useLocationData(locationId);
  const { data: structures } = useStructures(locationId);
  const { data: zones } = useZones(locationId);
  const { data: plants } = usePlantInstances(locationId ? { locationId } : undefined);
  const { data: weather } = useWeather(locationId);
  const { data: sunData } = useSunData(locationId);

  const [selectedPlant, setSelectedPlant] = useState<{
    plant: PlantInstance;
    screenX: number;
    screenY: number;
  } | null>(null);

  const [showLabels, setShowLabels] = useState(true);

  // Canvas ref for zoom controls
  const canvasRef = useRef<GardenCanvasHandle>(null);

  const handlePlantClick = useCallback(
    (plant: PlantInstance, screenX: number, screenY: number) => {
      setSelectedPlant({ plant, screenX, screenY });
    },
    [],
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedPlant(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPlant(null);
  }, []);

  // Loading state
  if (loadingLocation) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <MapPin size={48} className="text-emerald-500 mx-auto" />
          </div>
          <p className="mt-4 text-stone-400 font-display">
            Loading garden map...
          </p>
        </div>
      </div>
    );
  }

  // Not found
  if (!location) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-display text-stone-100">
            Location not found
          </h1>
          <Link
            to="/locations"
            className="mt-4 inline-block px-4 py-2 bg-emerald-600 rounded-lg text-sm font-semibold text-white"
          >
            Back to Locations
          </Link>
        </div>
      </div>
    );
  }

  // Check if location has lot dimensions
  if (!location.lotWidth || !location.lotDepth) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <MapPin size={48} className="text-stone-500 mx-auto" />
          <h1 className="mt-4 text-xl font-bold font-display text-stone-100">
            Set up your property first
          </h1>
          <p className="mt-2 text-stone-400 text-sm">
            The garden map needs lot dimensions and zone positions. Set up your
            property details on the location page first.
          </p>
          <Link
            to={`/locations/${location.id}`}
            className="mt-4 inline-block px-4 py-2 bg-emerald-600 rounded-lg text-sm font-semibold text-white"
          >
            Set Up Property
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950">
      {/* PixiJS Canvas (full viewport) */}
      <GardenCanvas
        ref={canvasRef}
        location={location}
        structures={structures ?? []}
        zones={zones ?? []}
        plants={plants ?? []}
        weather={weather}
        sunData={sunData}
        onPlantClick={handlePlantClick}
        onBackgroundClick={handleBackgroundClick}
      />

      {/* HUD overlay */}
      <MapHUD
        location={location}
        weather={weather}
        plants={plants ?? []}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitView={() => canvasRef.current?.fitView()}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((s) => !s)}
      />

      {/* Ambient day/night overlay */}
      <AmbientOverlay sunData={sunData} />

      {/* Minimap */}
      <Minimap
        location={location}
        structures={structures ?? []}
        zones={zones ?? []}
        plants={plants ?? []}
      />

      {/* Plant info panel */}
      {selectedPlant && (
        <PlantInfoPanel
          plant={selectedPlant.plant}
          screenX={selectedPlant.screenX}
          screenY={selectedPlant.screenY}
          onClose={handleClosePanel}
        />
      )}

      {/* Escape key handler */}
      <EscapeHandler onEscape={handleClosePanel} />
    </div>
  );
}

/** Listen for Escape key to close panels */
function EscapeHandler({ onEscape }: { onEscape: () => void }) {
  const ref = useRef(onEscape);
  ref.current = onEscape;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}
