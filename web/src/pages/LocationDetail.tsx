import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  MapPin,
  Home,
  Grid3X3,
  RefreshCw,
  Compass,
  CloudSun,
  Sun,
  Move,
  X,
  Sprout,
  Snowflake,
  Thermometer,
  Wind,
  Droplets,
  Gamepad2,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Textarea, Select } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import { useToast } from "../components/ui/Toast";
import {
  useLocation,
  useUpdateLocation,
  useZones,
  useCreateZone,
  useDeleteZone,
  useUpdateZone,
  useStructures,
  useCreateStructure,
  useUpdateStructure,
  useDeleteStructure,
  useWeather,
  useRefreshWeather,
  useSunData,
  useSunPosition,
  usePlantInstances,
  useSettings,
} from "../api/hooks";
import type { Structure, Zone, PlantType } from "../api";
import { getFrostInfo } from "../utils/mood";
import { getWeatherEmoji, formatTemperature, formatTempShort } from "../utils/weather";
import SunMap from "../components/SunMap";

function compassLabel(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(degrees / 45) % 8;
  return dirs[idx] ?? "N";
}

function sunExposureOverlayColor(sunExposure?: string | null): string {
  if (!sunExposure) return "rgba(250, 204, 21, 0.0)";
  switch (sunExposure) {
    case "full_sun": return "rgba(250, 204, 21, 0.15)";
    case "partial_sun": return "rgba(250, 204, 21, 0.10)";
    case "partial_shade": return "rgba(249, 115, 22, 0.08)";
    case "full_shade": return "rgba(120, 113, 108, 0.08)";
    default: return "rgba(250, 204, 21, 0.0)";
  }
}

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const locationId = id ? Number(id) : undefined;
  const { data: location, isLoading } = useLocation(locationId);
  const updateLocation = useUpdateLocation();
  const { data: zones } = useZones(locationId);
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();
  const updateZone = useUpdateZone();
  const { data: structures } = useStructures(locationId);
  const createStructure = useCreateStructure();
  const updateStructure = useUpdateStructure();
  const deleteStructureHook = useDeleteStructure();
  const { data: weather } = useWeather(locationId);
  const refreshWeather = useRefreshWeather();
  const { data: sunData } = useSunData(locationId);
  const { data: sunPosition } = useSunPosition(locationId);

  const [showEditProp, setShowEditProp] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [editingStructure, setEditingStructure] = useState<Structure | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [showSunOverlay, setShowSunOverlay] = useState(false);
  const [showSunMap, setShowSunMap] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [dragging, setDragging] = useState<{ type: "zone" | "structure"; id: number; startX: number; startY: number; origPosX: number; origPosY: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [confirmDelete, setConfirmDelete] = useState<{ type: "zone" | "structure"; id: number; name: string } | null>(null);
  const { showToast } = useToast();
  const { data: settings } = useSettings();
  const tempUnit = (settings?.temperatureUnit as string) ?? "F";

  const [propForm, setPropForm] = useState({
    lotWidth: "",
    lotDepth: "",
    compassOrientation: "",
    sidewalks: [] as { edge: "north" | "east" | "south" | "west"; width: number; inset: number }[],
  });
  const [zoneForm, setZoneForm] = useState({
    name: "",
    sunExposure: "",
    soilType: "",
    moistureLevel: "",
    windExposure: "",
    isIndoor: false,
    width: "10",
    depth: "10",
    posX: "0",
    posY: "0",
    color: "#4ade80",
    notes: "",
  });
  const [structForm, setStructForm] = useState({
    name: "",
    width: "",
    depth: "",
    height: "10",
    stories: "1",
    roofType: "gable" as "flat" | "gable" | "hip" | "shed" | "gambrel",
    posX: "0",
    posY: "0",
  });

  // Zone popover plants
  const { data: selectedZonePlants } = usePlantInstances(
    selectedZone ? { zoneId: selectedZone.id } : undefined
  );

  const lotPreviewRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-800 rounded animate-pulse" />
        <div className="h-40 bg-stone-900 border border-stone-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400">Location not found</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/locations")}
        >
          <ArrowLeft size={16} /> Back to Locations
        </Button>
      </div>
    );
  }

  function openEditStructure(s: Structure) {
    setStructForm({
      name: s.name,
      width: String(s.width),
      depth: String(s.depth),
      height: String(s.height),
      stories: String(s.stories),
      roofType: s.roofType,
      posX: String(s.posX),
      posY: String(s.posY),
    });
    setEditingStructure(s);
    setShowAddStructure(true);
  }

  function openEditZone(z: Zone) {
    setZoneForm({
      name: z.name,
      sunExposure: z.sunExposure ?? "",
      soilType: z.soilType ?? "",
      moistureLevel: z.moistureLevel ?? "",
      windExposure: z.windExposure ?? "",
      isIndoor: z.isIndoor ?? false,
      width: String(z.width),
      depth: String(z.depth),
      posX: String(z.posX),
      posY: String(z.posY),
      color: z.color ?? "#4ade80",
      notes: z.notes ?? "",
    });
    setEditingZone(z);
    setShowAddZone(true);
  }

  function resetStructForm() {
    setStructForm({
      name: "",
      width: "",
      depth: "",
      height: "10",
      stories: "1",
      roofType: "gable",
      posX: "0",
      posY: "0",
    });
    setEditingStructure(null);
  }

  // Lot preview dimensions — orient with north at top
  // Frontage (lotWidth) runs perpendicular to the direction the front faces
  // For N/S-facing: frontage is horizontal, depth is vertical
  // For E/W-facing: frontage is vertical, depth is horizontal
  const rawFrontage = location.lotWidth ?? 0;
  const rawDepth = location.lotDepth ?? 0;
  const orientation = location.compassOrientation ?? 0;
  const normAngle = ((orientation % 360) + 360) % 360;
  const isEWFacing = (normAngle > 45 && normAngle < 135) || (normAngle > 225 && normAngle < 315);
  const lotW = isEWFacing ? rawDepth : rawFrontage;
  const lotD = isEWFacing ? rawFrontage : rawDepth;
  const maxPreviewW = 500;
  const maxPreviewH = 400;
  const scaleFactor = lotW > 0 && lotD > 0
    ? Math.min(maxPreviewW / lotW, maxPreviewH / lotD, 5)
    : 4;

  // Drag handlers
  function handleDragStart(e: React.MouseEvent, type: "zone" | "structure", id: number, posX: number, posY: number) {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    setDragging({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origPosX: posX,
      origPosY: posY,
    });
  }

  function handleDragMove(e: React.MouseEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    setDragOffset({ dx, dy });
  }

  function handleDragEnd(e: React.MouseEvent) {
    if (!dragging || !locationId) return;
    const dx = (e.clientX - dragging.startX) / scaleFactor;
    const dy = (e.clientY - dragging.startY) / scaleFactor;
    const newPosX = Math.max(0, Math.round(dragging.origPosX + dx));
    const newPosY = Math.max(0, Math.round(dragging.origPosY + dy));

    if (dragging.type === "zone") {
      updateZone.mutate({ id: dragging.id, data: { posX: newPosX, posY: newPosY } });
    } else {
      updateStructure.mutate({
        locationId,
        id: dragging.id,
        data: { posX: newPosX, posY: newPosY },
      });
    }
    setDragging(null);
    setDragOffset({ dx: 0, dy: 0 });
  }

  function getDragTransform(itemId: number, itemType: "zone" | "structure"): string {
    if (!dragging || dragging.id !== itemId || dragging.type !== itemType) return "";
    return `translate(${dragOffset.dx}px, ${dragOffset.dy}px)`;
  }

  // Sun arc calculation
  function getSunArcPosition(progress: number): { x: number; y: number } {
    // progress: 0 = sunrise (left), 0.5 = noon (top), 1 = sunset (right)
    const width = lotW * scaleFactor;
    const arcHeight = 40;
    const x = progress * width;
    const y = -arcHeight * Math.sin(progress * Math.PI);
    return { x, y: y - 10 };
  }

  function getCurrentSunProgress(): number {
    if (!sunData) return 0.5;
    const now = new Date();
    const sunrise = new Date(sunData.sunrise);
    const sunset = new Date(sunData.sunset);
    const total = sunset.getTime() - sunrise.getTime();
    if (total <= 0) return 0.5;
    const elapsed = now.getTime() - sunrise.getTime();
    return Math.max(0, Math.min(1, elapsed / total));
  }

  // Frost date info
  const frostInfo = getFrostInfo(location.lastFrostDate, location.firstFrostDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/locations")}
          className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 font-[family-name:var(--font-display)] mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Locations
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-stone-100">
              {location.name}
            </h1>
            {location.address && (
              <p className="text-stone-400 text-sm mt-1 flex items-center gap-1">
                <MapPin size={14} /> {location.address}
              </p>
            )}
          </div>
          {location.hardinessZone && (
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-[family-name:var(--font-mono)]">
              Zone {location.hardinessZone}
            </span>
          )}
        </div>
      </div>

      {/* Garden Map Button */}
      {location.lotWidth && location.lotDepth && (
        <Link
          to={`/locations/${location.id}/map`}
          className="flex items-center gap-3 p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-xl hover:bg-emerald-600/20 transition-colors group"
        >
          <div className="p-2 bg-emerald-600/20 rounded-lg group-hover:bg-emerald-600/30 transition-colors">
            <Gamepad2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-[family-name:var(--font-display)] text-emerald-400">
              Garden Map
            </h3>
            <p className="text-xs text-stone-400">
              Interactive pixel art view of your property
            </p>
          </div>
        </Link>
      )}

      {/* Weather Card */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold font-[family-name:var(--font-display)] text-stone-300 uppercase tracking-wider">
            Weather
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => locationId && refreshWeather.mutate(locationId)}
            disabled={refreshWeather.isPending}
          >
            <RefreshCw size={14} className={refreshWeather.isPending ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
        {weather?.temperature != null ? (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-3xl mb-1">{getWeatherEmoji(weather.conditions)}</p>
              <p className="text-xl font-bold font-[family-name:var(--font-mono)] text-stone-100">
                {formatTemperature(weather.temperature, tempUnit)}
              </p>
              <p className="text-xs text-stone-400">{weather.conditions ?? "--"}</p>
            </div>
            <div>
              <p className="text-stone-500 font-[family-name:var(--font-display)]">High / Low</p>
              <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                {weather.temperatureHigh != null ? formatTempShort(weather.temperatureHigh, tempUnit) : "--"}
                {" / "}
                {weather.temperatureLow != null ? formatTempShort(weather.temperatureLow, tempUnit) : "--"}
              </p>
            </div>
            <div>
              <p className="text-stone-500 font-[family-name:var(--font-display)]">Humidity</p>
              <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                {weather.humidity != null ? `${Math.round(weather.humidity)}%` : "--"}
              </p>
            </div>
            <div>
              <p className="text-stone-500 font-[family-name:var(--font-display)]">Wind</p>
              <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                {weather.windSpeed != null ? `${Math.round(weather.windSpeed)} mph` : "--"}
              </p>
            </div>
          </div>
          {/* Extended weather fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-stone-800">
            {weather.uvIndex != null && (
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">UV Index</p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {weather.uvIndex}
                  <span className="text-stone-500 text-xs ml-1">
                    {weather.uvIndex <= 2 ? "low" : weather.uvIndex <= 5 ? "mod" : weather.uvIndex <= 7 ? "high" : "v.high"}
                  </span>
                </p>
              </div>
            )}
            {weather.precipitationProbability != null && (
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">Rain Chance</p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {Math.round(weather.precipitationProbability)}%
                </p>
              </div>
            )}
            {weather.soilTemperature != null && (
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">Soil Temp</p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {formatTemperature(weather.soilTemperature, tempUnit)}
                </p>
              </div>
            )}
            {weather.windGust != null && (
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">Wind Gust</p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {Math.round(weather.windGust)} mph
                </p>
              </div>
            )}
          </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-stone-500">
            <CloudSun size={20} />
            <p className="text-sm font-[family-name:var(--font-display)]">
              No weather data. Click Refresh to fetch current conditions.
            </p>
          </div>
        )}
      </Card>

      {/* Frost Dates */}
      {(location.lastFrostDate || location.firstFrostDate) && (
        <Card>
          <h2 className="text-sm font-semibold font-[family-name:var(--font-display)] text-stone-300 uppercase tracking-wider mb-3">
            Frost Dates
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {location.lastFrostDate && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Snowflake size={14} className="text-sky-400" />
                  <p className="text-stone-500 font-[family-name:var(--font-display)]">Last Frost</p>
                </div>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {new Date(location.lastFrostDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                {frostInfo.daysSinceLastFrost != null && frostInfo.daysSinceLastFrost > 0 && (
                  <p className="text-xs text-emerald-400 font-[family-name:var(--font-mono)] mt-0.5">
                    {frostInfo.daysSinceLastFrost} days ago
                  </p>
                )}
                {frostInfo.daysSinceLastFrost != null && frostInfo.daysSinceLastFrost < 0 && (
                  <p className="text-xs text-sky-400 font-[family-name:var(--font-mono)] mt-0.5">
                    in {Math.abs(frostInfo.daysSinceLastFrost)} days
                  </p>
                )}
              </div>
            )}
            {location.firstFrostDate && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Thermometer size={14} className="text-amber-400" />
                  <p className="text-stone-500 font-[family-name:var(--font-display)]">First Frost</p>
                </div>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {new Date(location.firstFrostDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                {frostInfo.daysUntilFirstFrost != null && frostInfo.daysUntilFirstFrost > 0 && (
                  <p className="text-xs text-amber-400 font-[family-name:var(--font-mono)] mt-0.5">
                    in {frostInfo.daysUntilFirstFrost} days
                  </p>
                )}
                {frostInfo.daysUntilFirstFrost != null && frostInfo.daysUntilFirstFrost < 0 && (
                  <p className="text-xs text-sky-400 font-[family-name:var(--font-mono)] mt-0.5">
                    {Math.abs(frostInfo.daysUntilFirstFrost)} days ago
                  </p>
                )}
              </div>
            )}
            <div className="col-span-2">
              <p className="text-stone-500 font-[family-name:var(--font-display)]">Growing Season</p>
              <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                {frostInfo.frostStatus === "growing-season" && (
                  <span className="text-emerald-400">Active growing season</span>
                )}
                {frostInfo.frostStatus === "before-last" && (
                  <span className="text-sky-400">Waiting for last frost to pass</span>
                )}
                {frostInfo.frostStatus === "after-first" && (
                  <span className="text-amber-400">Past first frost -- protect tender plants</span>
                )}
                {frostInfo.frostStatus === "unknown" && (
                  <span className="text-stone-500">--</span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Property Info */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold font-[family-name:var(--font-display)] text-stone-300 uppercase tracking-wider">
            Property Info
          </h2>
          <button
            onClick={() => {
              setPropForm({
                lotWidth: String(location.lotWidth ?? ""),
                lotDepth: String(location.lotDepth ?? ""),
                compassOrientation: String(location.compassOrientation ?? ""),
                sidewalks: location.sidewalks ?? [],
              });
              setShowEditProp(true);
            }}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <Edit3 size={14} />
          </button>
        </div>
        {location.lotWidth && location.lotDepth ? (
          <>
            <p className="text-stone-300 text-sm mb-3 font-[family-name:var(--font-display)]">
              {location.lotWidth}&prime; frontage &times; {location.lotDepth}&prime; deep
              {location.compassOrientation != null && (
                <>, front faces {compassLabel(location.compassOrientation)}</>
              )}
              {" — "}
              <span className="font-[family-name:var(--font-mono)] text-stone-400">
                {Math.round(location.lotWidth * location.lotDepth).toLocaleString()} sqft
              </span>
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">
                  Frontage
                </p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {location.lotWidth} ft
                </p>
              </div>
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">
                  Depth
                </p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {location.lotDepth} ft
                </p>
              </div>
              <div>
                <p className="text-stone-500 font-[family-name:var(--font-display)]">
                  Orientation
                </p>
                <p className="text-stone-200 font-[family-name:var(--font-mono)]">
                  {location.compassOrientation != null
                    ? `${location.compassOrientation}° (${compassLabel(location.compassOrientation)})`
                    : "--"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <Compass className="mx-auto text-stone-600 mb-2" size={28} />
            <p className="text-stone-400 text-sm">
              Add your lot dimensions to unlock the property map and sun modeling
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                setPropForm({
                  lotWidth: String(location.lotWidth ?? ""),
                  lotDepth: String(location.lotDepth ?? ""),
                  compassOrientation: String(location.compassOrientation ?? ""),
                  sidewalks: location.sidewalks ?? [],
                });
                setShowEditProp(true);
              }}
            >
              <Edit3 size={14} /> Set Up Property
            </Button>
          </div>
        )}
      </Card>

      {/* Lot Preview */}
      {lotW > 0 && lotD > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold font-[family-name:var(--font-display)] text-stone-300 uppercase tracking-wider">
              Lot Preview
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showSunOverlay ? "primary" : "ghost"}
                onClick={() => { setShowSunOverlay(!showSunOverlay); if (showSunMap) setShowSunMap(false); }}
              >
                <Sun size={14} /> Sun
              </Button>
              <Button
                size="sm"
                variant={showSunMap ? "primary" : "ghost"}
                onClick={() => { setShowSunMap(!showSunMap); if (!showSunMap) { setShowSunOverlay(false); setEditMode(false); } }}
              >
                <Sun size={14} /> Sun Map
              </Button>
              <Button
                size="sm"
                variant={editMode ? "primary" : "ghost"}
                onClick={() => {
                  setEditMode(!editMode);
                  setSelectedZone(null);
                  if (showSunMap) setShowSunMap(false);
                }}
              >
                <Move size={14} /> {editMode ? "Done" : "Edit"}
              </Button>
            </div>
          </div>
          {/* Sun Map Mode */}
          {showSunMap && locationId && zones && structures && (
            <SunMap
              locationId={locationId}
              lotW={lotW}
              lotD={lotD}
              scaleFactor={scaleFactor}
              zones={zones}
              structures={structures}
            />
          )}

          {/* Normal Lot Preview (hidden when Sun Map is active) */}
          {!showSunMap && (<>
          <div className={`flex justify-center p-4 ${showSunOverlay ? "pb-20" : ""}`}>
            <div
              className="relative"
              ref={lotPreviewRef}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={() => { setDragging(null); setDragOffset({ dx: 0, dy: 0 }); }}
            >
              {/* Compass indicator */}
              {location.compassOrientation != null && (
                <div className="absolute -top-8 right-0 flex items-center gap-1">
                  <Compass size={14} className="text-stone-500" />
                  <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">
                    {compassLabel(location.compassOrientation)}
                  </span>
                </div>
              )}

              {/* Sun arc overlay — south side (bottom), east=right to west=left */}
              {showSunOverlay && sunData && (
                <svg
                  className="absolute -bottom-14 left-0 pointer-events-none"
                  width={lotW * scaleFactor}
                  height={50}
                  viewBox={`0 0 ${lotW * scaleFactor} 50`}
                >
                  {/* Sun arc path — right (E/sunrise) to left (W/sunset) curving below */}
                  <path
                    d={`M ${lotW * scaleFactor} 2 Q ${lotW * scaleFactor * 0.5} 80 0 2`}
                    fill="none"
                    stroke="rgba(250, 204, 21, 0.3)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  {/* E/W labels */}
                  <text x={lotW * scaleFactor - 4} y={12} textAnchor="end" fill="#a8a29e" fontSize={8} fontFamily="var(--font-mono)">E</text>
                  <text x={4} y={12} textAnchor="start" fill="#a8a29e" fontSize={8} fontFamily="var(--font-mono)">W</text>
                  {/* Current sun position */}
                  {(() => {
                    const progress = getCurrentSunProgress();
                    if (progress < 0 || progress > 1) return null;
                    // t goes from 0 (sunrise/east/right) to 1 (sunset/west/left)
                    const t = progress;
                    const ctrlY = 80;
                    const sunX = (1 - t) * lotW * scaleFactor; // right to left
                    const sunY = (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * ctrlY + t * t * 2;
                    return (
                      <circle
                        cx={sunX}
                        cy={sunY}
                        r={8}
                        fill="#facc15"
                        opacity={0.9}
                      >
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
                      </circle>
                    );
                  })()}
                </svg>
              )}

              <div
                className={`border-2 border-dashed rounded-lg relative ${editMode ? "border-emerald-600/50 bg-stone-950/70" : "border-stone-700 bg-stone-950/50"}`}
                style={{
                  width: lotW * scaleFactor,
                  height: lotD * scaleFactor,
                }}
              >
                {/* Width label (top) */}
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-stone-500 font-[family-name:var(--font-mono)]">
                  {lotW}ft
                </span>
                {/* Depth label (right) */}
                <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-[family-name:var(--font-mono)] rotate-90">
                  {lotD}ft
                </span>
                {/* Street indicator on the side matching compass orientation */}
                {location.compassOrientation != null && (() => {
                  const streetSide = normAngle >= 315 || normAngle < 45 ? "top"
                    : normAngle >= 45 && normAngle < 135 ? "right"
                    : normAngle >= 135 && normAngle < 225 ? "bottom"
                    : "left";
                  const streetClasses = "absolute text-[10px] text-sky-400/70 font-[family-name:var(--font-display)] tracking-wider uppercase";
                  if (streetSide === "top") return <span className={`${streetClasses} -top-5 left-2`}>street</span>;
                  if (streetSide === "bottom") return <span className={`${streetClasses} -bottom-5 left-2`}>street</span>;
                  if (streetSide === "right") return <span className={`${streetClasses} top-1 -right-14 rotate-90`}>street</span>;
                  return <span className={`${streetClasses} top-1 -left-14 -rotate-90`}>street</span>;
                })()}

                {/* Sidewalks — rendered inside lot boundary (property line includes planting strip + sidewalk) */}
                {location.sidewalks?.map((sw) => {
                  // Map compass edge to visual side accounting for E/W orientation swap
                  const visualEdge = isEWFacing
                    ? (sw.edge === "north" ? "top" : sw.edge === "south" ? "bottom" : sw.edge === "east" ? "right" : "left")
                    : (sw.edge === "north" ? "top" : sw.edge === "south" ? "bottom" : sw.edge === "east" ? "right" : "left");
                  const swW = sw.width * scaleFactor;
                  const swInset = sw.inset * scaleFactor;
                  const lotPxW = lotW * scaleFactor;
                  const lotPxH = lotD * scaleFactor;

                  // Sidewalk sits inside the lot: property line → inset (planting strip) → sidewalk
                  let style: React.CSSProperties = {};
                  if (visualEdge === "top") {
                    style = { left: 0, top: swInset, width: lotPxW, height: swW };
                  } else if (visualEdge === "bottom") {
                    style = { left: 0, bottom: swInset, width: lotPxW, height: swW };
                  } else if (visualEdge === "right") {
                    style = { right: swInset, top: 0, width: swW, height: lotPxH };
                  } else {
                    style = { left: swInset, top: 0, width: swW, height: lotPxH };
                  }

                  return (
                    <div
                      key={`sw-${sw.edge}`}
                      className="absolute bg-stone-400/15 border border-stone-500/25 rounded-sm"
                      style={style}
                      title={`Sidewalk (${sw.edge} edge) — ${sw.width}ft wide, ${sw.inset}ft from property line`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] text-stone-500 font-[family-name:var(--font-mono)]">
                        sidewalk
                      </span>
                    </div>
                  );
                })}

                {/* Structures as dark rectangles */}
                {structures?.map((s) => (
                  <div
                    key={`struct-${s.id}`}
                    className={`absolute bg-stone-700/60 border rounded text-xs text-stone-300 flex items-center justify-center p-0.5 ${
                      editMode
                        ? "cursor-move border-stone-500 hover:border-stone-400"
                        : "border-stone-600"
                    }`}
                    style={{
                      left: s.posX * scaleFactor,
                      top: s.posY * scaleFactor,
                      width: s.width * scaleFactor,
                      height: s.depth * scaleFactor,
                      transform: getDragTransform(s.id, "structure"),
                      zIndex: dragging?.id === s.id && dragging?.type === "structure" ? 20 : undefined,
                    }}
                    title={s.name}
                    onMouseDown={(e) => handleDragStart(e, "structure", s.id, s.posX, s.posY)}
                  >
                    <span className="truncate text-[10px]">{s.name}</span>
                  </div>
                ))}

                {/* Zones as colored semi-transparent rectangles */}
                {zones?.map((z) => {
                  const isSelected = selectedZone?.id === z.id;
                  return (
                    <div
                      key={z.id}
                      className={`absolute border rounded text-xs flex items-center justify-center p-1 transition-all ${
                        editMode
                          ? "cursor-move"
                          : "cursor-pointer hover:opacity-80"
                      } ${isSelected ? "ring-2 ring-emerald-400 z-10" : ""}`}
                      style={{
                        left: z.posX * scaleFactor,
                        top: z.posY * scaleFactor,
                        width: z.width * scaleFactor,
                        height: z.depth * scaleFactor,
                        backgroundColor: showSunOverlay
                          ? sunExposureOverlayColor(z.sunExposure)
                          : `${z.color ?? "#4ade80"}20`,
                        borderColor: isSelected
                          ? "#34d399"
                          : `${z.color ?? "#4ade80"}50`,
                        color: z.color ?? "#4ade80",
                        transform: getDragTransform(z.id, "zone"),
                        zIndex: dragging?.id === z.id && dragging?.type === "zone" ? 20 : undefined,
                      }}
                      onClick={(e) => {
                        if (editMode) return;
                        e.stopPropagation();
                        setSelectedZone(isSelected ? null : z);
                      }}
                      onMouseDown={(e) => handleDragStart(e, "zone", z.id, z.posX, z.posY)}
                    >
                      <span className="truncate">{z.name}</span>
                      {showSunOverlay && z.sunExposure && (
                        <Sun
                          size={10}
                          className="absolute top-0.5 right-0.5"
                          style={{
                            color: z.sunExposure === "full_sun" ? "#facc15"
                              : z.sunExposure === "partial_sun" ? "#fb923c"
                              : z.sunExposure === "partial_shade" ? "#9ca3af"
                              : "#6b7280",
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                {editMode && (
                  <div className="absolute bottom-1 left-1 text-[9px] text-emerald-400/60 font-[family-name:var(--font-mono)]">
                    Drag to reposition
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sun info bar */}
          {showSunOverlay && sunData && (
            <div className="flex items-center justify-center gap-6 text-xs text-stone-400 font-[family-name:var(--font-mono)] mt-2 pt-2 border-t border-stone-800">
              <span>Sunrise: {new Date(sunData.sunrise).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              <span>Solar Noon: {new Date(sunData.solarNoon).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              <span>Sunset: {new Date(sunData.sunset).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              <span>Day: {sunData.dayLength}</span>
            </div>
          )}
          {/* End normal lot preview */}
          </>)}

          {/* Zone popover */}
          {selectedZone && !editMode && !showSunMap && (
            <div className="mt-3 p-4 rounded-xl bg-stone-900 border border-stone-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold font-[family-name:var(--font-display)] text-stone-200">
                  {selectedZone.name}
                </h3>
                <button
                  onClick={() => setSelectedZone(null)}
                  className="p-1 rounded text-stone-500 hover:text-stone-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <p className="text-stone-500 font-[family-name:var(--font-display)]">Size</p>
                  <p className="text-stone-300 font-[family-name:var(--font-mono)]">{selectedZone.width}x{selectedZone.depth}ft</p>
                </div>
                {selectedZone.sunExposure && (
                  <div>
                    <p className="text-stone-500 font-[family-name:var(--font-display)]">Sun</p>
                    <p className="text-stone-300 font-[family-name:var(--font-mono)]">{selectedZone.sunExposure.replace("_", " ")}</p>
                  </div>
                )}
                {selectedZone.soilType && (
                  <div>
                    <p className="text-stone-500 font-[family-name:var(--font-display)]">Soil</p>
                    <p className="text-stone-300 font-[family-name:var(--font-mono)]">{selectedZone.soilType}</p>
                  </div>
                )}
                {selectedZone.moistureLevel && (
                  <div>
                    <p className="text-stone-500 font-[family-name:var(--font-display)]">Moisture</p>
                    <p className="text-stone-300 font-[family-name:var(--font-mono)]">{selectedZone.moistureLevel}</p>
                  </div>
                )}
              </div>

              {/* Mini plant grid */}
              {selectedZonePlants && selectedZonePlants.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-stone-500 font-[family-name:var(--font-display)] mb-2">
                    {selectedZonePlants.length} plant{selectedZonePlants.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedZonePlants.slice(0, 8).map((plant) => (
                      <div
                        key={plant.id}
                        className="flex flex-col items-center p-1.5 rounded-lg bg-stone-800/50 hover:bg-stone-800 cursor-pointer transition-colors"
                        onClick={() => navigate(`/my-plants/${plant.id}`)}
                        title={getMoodMessage(plant.mood, plant.nickname ?? undefined)}
                      >
                        <PlantSprite
                          type={(plant.plantReference?.plantType as PlantType) ?? "flower"}
                          mood={plant.mood}
                          size={28}
                        />
                        <span className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[60px]">
                          {plant.nickname ?? plant.plantReference?.commonName ?? "Plant"}
                        </span>
                      </div>
                    ))}
                    {selectedZonePlants.length > 8 && (
                      <div className="flex items-center text-[10px] text-stone-500 px-2">
                        +{selectedZonePlants.length - 8} more
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic mb-3">No plants in this zone</p>
              )}

              <button
                onClick={() => navigate(`/zones/${selectedZone.id}`)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-[family-name:var(--font-display)] transition-colors"
              >
                View Full Zone &rarr;
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Structures */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200">
            Structures
          </h2>
          <Button size="sm" variant="secondary" onClick={() => {
            resetStructForm();
            setShowAddStructure(true);
          }}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {structures && structures.length > 0 ? (
          <div className="space-y-2">
            {structures.map((s) => (
              <Card key={s.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Home size={18} className="text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-200 font-[family-name:var(--font-display)]">
                        {s.name}
                      </p>
                      <p className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">
                        {s.width}x{s.depth}ft · {s.stories} story · {s.roofType}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditStructure(s)}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: "structure", id: s.id, name: s.name })}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="flex items-center gap-3 text-stone-500">
              <Home size={20} />
              <p className="text-sm font-[family-name:var(--font-display)]">
                Structures help map your property layout (house, garage, shed,
                etc.)
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Zones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200">
            Zones
          </h2>
          <Button size="sm" onClick={() => setShowAddZone(true)}>
            <Plus size={14} /> Add Zone
          </Button>
        </div>
        {zones && zones.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <Card
                key={zone.id}
                hoverable
                onClick={() => navigate(`/zones/${zone.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${zone.color ?? "#4ade80"}20` }}>
                      <Grid3X3 size={18} style={{ color: zone.color ?? "#4ade80" }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                        {zone.name}
                      </h3>
                      <p className="text-xs text-stone-500 font-[family-name:var(--font-mono)] mt-0.5">
                        {zone.width}x{zone.depth}ft
                        {zone.sunExposure ? ` · ${zone.sunExposure.replace("_", " ")}` : ""}
                        {zone.isIndoor ? " · indoor" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditZone(zone);
                      }}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ type: "zone", id: zone.id, name: zone.name });
                      }}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-8">
            <Grid3X3 className="mx-auto text-stone-600 mb-2" size={32} />
            <p className="text-stone-400 text-sm font-[family-name:var(--font-display)]">
              No zones yet. Add garden beds, side yards, containers, etc.
            </p>
          </Card>
        )}
      </div>

      {/* Edit Property Modal */}
      <Modal
        open={showEditProp}
        onClose={() => setShowEditProp(false)}
        title="Edit Property Info"
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!locationId) return;
            updateLocation.mutate(
              {
                id: locationId,
                data: {
                  lotWidth: propForm.lotWidth
                    ? Number(propForm.lotWidth)
                    : undefined,
                  lotDepth: propForm.lotDepth
                    ? Number(propForm.lotDepth)
                    : undefined,
                  compassOrientation: propForm.compassOrientation
                    ? Number(propForm.compassOrientation)
                    : undefined,
                  sidewalks: propForm.sidewalks.length > 0 ? propForm.sidewalks : null,
                },
              },
              { onSuccess: () => setShowEditProp(false) }
            );
          }}
          className="space-y-5"
        >
          {/* Lot dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Frontage (ft)"
                type="number"
                step="any"
                placeholder="e.g., 50"
                value={propForm.lotWidth}
                onChange={(e) =>
                  setPropForm({ ...propForm, lotWidth: e.target.value })
                }
              />
              <p className="text-xs text-stone-500 mt-1">
                Width of lot along the street
              </p>
            </div>
            <div>
              <Input
                label="Depth (ft)"
                type="number"
                step="any"
                placeholder="e.g., 70"
                value={propForm.lotDepth}
                onChange={(e) =>
                  setPropForm({ ...propForm, lotDepth: e.target.value })
                }
              />
              <p className="text-xs text-stone-500 mt-1">
                Distance from street to back fence
              </p>
            </div>
          </div>

          {/* Computed area */}
          {propForm.lotWidth && propForm.lotDepth && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-700/50">
              <span className="text-xs text-stone-400">Estimated area:</span>
              <span className="text-sm font-[family-name:var(--font-mono)] text-stone-200">
                {Math.round(Number(propForm.lotWidth) * Number(propForm.lotDepth)).toLocaleString()} sqft
              </span>
            </div>
          )}

          {/* Compass orientation picker */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Which direction does your front door face?
            </label>
            <div className="flex justify-center">
              <div className="relative w-48 h-48">
                {/* Compass circle */}
                <div className="absolute inset-0 rounded-full border-2 border-stone-700 bg-stone-900/50" />
                {/* Cardinal/ordinal direction buttons */}
                {([
                  { label: "N", deg: 0, x: "50%", y: "4%", tx: "-50%" },
                  { label: "NE", deg: 45, x: "85%", y: "12%", tx: "-50%" },
                  { label: "E", deg: 90, x: "96%", y: "50%", tx: "-100%" },
                  { label: "SE", deg: 135, x: "85%", y: "85%", tx: "-50%" },
                  { label: "S", deg: 180, x: "50%", y: "96%", tx: "-50%" },
                  { label: "SW", deg: 225, x: "15%", y: "85%", tx: "-50%" },
                  { label: "W", deg: 270, x: "4%", y: "50%", tx: "0%" },
                  { label: "NW", deg: 315, x: "15%", y: "12%", tx: "-50%" },
                ] as const).map((dir) => {
                  const isSelected = propForm.compassOrientation === String(dir.deg);
                  return (
                    <button
                      key={dir.label}
                      type="button"
                      onClick={() => setPropForm({ ...propForm, compassOrientation: String(dir.deg) })}
                      className={`absolute px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-sky-500 text-white scale-110 shadow-lg shadow-sky-500/30"
                          : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
                      }`}
                      style={{
                        left: dir.x,
                        top: dir.y,
                        transform: `translate(${dir.tx}, -50%)`,
                      }}
                    >
                      {dir.label}
                    </button>
                  );
                })}
                {/* Center compass icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Compass size={24} className="text-stone-600" />
                </div>
              </div>
            </div>
            {propForm.compassOrientation && (
              <p className="text-center text-xs text-stone-400 mt-2 font-[family-name:var(--font-mono)]">
                {propForm.compassOrientation}° from North
              </p>
            )}
            {/* Manual override */}
            <details className="mt-2">
              <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-400">
                Enter exact degrees instead
              </summary>
              <Input
                type="number"
                step="any"
                min="0"
                max="359"
                placeholder="0-359"
                value={propForm.compassOrientation}
                onChange={(e) =>
                  setPropForm({ ...propForm, compassOrientation: e.target.value })
                }
                className="mt-2"
              />
            </details>
          </div>

          {/* Sidewalks */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Sidewalks
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["north", "east", "south", "west"] as const).map((edge) => {
                const existing = propForm.sidewalks.find((s) => s.edge === edge);
                const isActive = !!existing;
                return (
                  <button
                    key={edge}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        setPropForm({
                          ...propForm,
                          sidewalks: propForm.sidewalks.filter((s) => s.edge !== edge),
                        });
                      } else {
                        setPropForm({
                          ...propForm,
                          sidewalks: [...propForm.sidewalks, { edge, width: 5, inset: 6 }],
                        });
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-[family-name:var(--font-display)] font-semibold transition-all ${
                      isActive
                        ? "bg-stone-600/40 text-stone-200 border border-stone-500"
                        : "bg-stone-800/50 text-stone-500 border border-stone-700 hover:border-stone-600 hover:text-stone-400"
                    }`}
                  >
                    {edge.charAt(0).toUpperCase() + edge.slice(1)} edge
                  </button>
                );
              })}
            </div>
            {propForm.sidewalks.length > 0 && (
              <div className="mt-3 space-y-2">
                {propForm.sidewalks.map((sw) => (
                  <div key={sw.edge} className="flex items-center gap-3 text-sm">
                    <span className="text-stone-400 w-14 font-[family-name:var(--font-display)] capitalize">{sw.edge}</span>
                    <label className="flex items-center gap-1 text-stone-500">
                      <span className="text-xs">Width</span>
                      <input
                        type="number"
                        step="any"
                        value={sw.width}
                        onChange={(e) => setPropForm({
                          ...propForm,
                          sidewalks: propForm.sidewalks.map((s) =>
                            s.edge === sw.edge ? { ...s, width: Number(e.target.value) || 0 } : s
                          ),
                        })}
                        className="w-14 bg-stone-800 border border-stone-700 rounded px-1.5 py-0.5 text-stone-200 text-xs font-[family-name:var(--font-mono)]"
                      />
                      <span className="text-xs">ft</span>
                    </label>
                    <label className="flex items-center gap-1 text-stone-500">
                      <span className="text-xs">Inset</span>
                      <input
                        type="number"
                        step="any"
                        value={sw.inset}
                        onChange={(e) => setPropForm({
                          ...propForm,
                          sidewalks: propForm.sidewalks.map((s) =>
                            s.edge === sw.edge ? { ...s, inset: Number(e.target.value) || 0 } : s
                          ),
                        })}
                        className="w-14 bg-stone-800 border border-stone-700 rounded px-1.5 py-0.5 text-stone-200 text-xs font-[family-name:var(--font-mono)]"
                      />
                      <span className="text-xs">ft</span>
                    </label>
                  </div>
                ))}
                <p className="text-[10px] text-stone-600 mt-1">
                  Width = sidewalk width. Inset = planting strip distance from property line to sidewalk edge.
                  Both render inside the lot boundary (your property line extends to the curb).
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowEditProp(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateLocation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Zone Modal */}
      <Modal
        open={showAddZone}
        onClose={() => {
          setShowAddZone(false);
          setEditingZone(null);
        }}
        title={editingZone ? "Edit Zone" : "Add Zone"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!locationId) return;
            const zoneData = {
              name: zoneForm.name,
              sunExposure: zoneForm.sunExposure || undefined,
              soilType: zoneForm.soilType || undefined,
              moistureLevel: zoneForm.moistureLevel || undefined,
              windExposure: zoneForm.windExposure || undefined,
              isIndoor: zoneForm.isIndoor,
              width: Number(zoneForm.width) || 10,
              depth: Number(zoneForm.depth) || 10,
              posX: Number(zoneForm.posX) || 0,
              posY: Number(zoneForm.posY) || 0,
              color: zoneForm.color || "#4ade80",
              notes: zoneForm.notes || undefined,
            };
            const resetZoneForm = () => {
              setShowAddZone(false);
              setEditingZone(null);
              setZoneForm({
                name: "",
                sunExposure: "",
                soilType: "",
                moistureLevel: "",
                windExposure: "",
                isIndoor: false,
                width: "10",
                depth: "10",
                posX: "0",
                posY: "0",
                color: "#4ade80",
                notes: "",
              });
            };
            if (editingZone) {
              updateZone.mutate(
                { id: editingZone.id, data: zoneData },
                {
                  onSuccess: () => {
                    resetZoneForm();
                    showToast("Zone updated", "success");
                  },
                  onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                }
              );
            } else {
              createZone.mutate(
                { locationId, ...zoneData },
                {
                  onSuccess: () => {
                    resetZoneForm();
                    showToast("Zone added!", "success");
                  },
                  onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                }
              );
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Name"
            placeholder="e.g., Front Bed"
            value={zoneForm.name}
            onChange={(e) =>
              setZoneForm({ ...zoneForm, name: e.target.value })
            }
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Width (ft)"
              type="number"
              value={zoneForm.width}
              onChange={(e) => setZoneForm({ ...zoneForm, width: e.target.value })}
            />
            <Input
              label="Depth (ft)"
              type="number"
              value={zoneForm.depth}
              onChange={(e) => setZoneForm({ ...zoneForm, depth: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Position X (ft)"
              type="number"
              value={zoneForm.posX}
              onChange={(e) => setZoneForm({ ...zoneForm, posX: e.target.value })}
            />
            <Input
              label="Position Y (ft)"
              type="number"
              value={zoneForm.posY}
              onChange={(e) => setZoneForm({ ...zoneForm, posY: e.target.value })}
            />
          </div>
          <Select
            label="Sun Exposure"
            value={zoneForm.sunExposure}
            onChange={(e) =>
              setZoneForm({ ...zoneForm, sunExposure: e.target.value })
            }
          >
            <option value="">-- Select --</option>
            <option value="full_sun">Full Sun (6+ hrs)</option>
            <option value="partial_sun">Partial Sun (4-6 hrs)</option>
            <option value="partial_shade">Partial Shade (2-4 hrs)</option>
            <option value="full_shade">Full Shade (&lt;2 hrs)</option>
          </Select>
          <Select
            label="Soil Type"
            value={zoneForm.soilType}
            onChange={(e) => setZoneForm({ ...zoneForm, soilType: e.target.value })}
          >
            <option value="">-- Select --</option>
            <option value="clay">Clay</option>
            <option value="sandy">Sandy</option>
            <option value="loamy">Loamy</option>
            <option value="silty">Silty</option>
            <option value="peaty">Peaty</option>
            <option value="chalky">Chalky</option>
            <option value="mixed">Mixed</option>
          </Select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={zoneForm.isIndoor}
              onChange={(e) => setZoneForm({ ...zoneForm, isIndoor: e.target.checked })}
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-[family-name:var(--font-display)]">Indoor zone</span>
          </label>
          <div className="flex items-center gap-3">
            <label className="text-sm text-stone-400 font-[family-name:var(--font-display)]">Color</label>
            <input
              type="color"
              value={zoneForm.color}
              onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
              className="w-8 h-8 rounded border border-stone-700 bg-stone-800 cursor-pointer"
            />
          </div>
          <Textarea
            label="Notes"
            value={zoneForm.notes}
            onChange={(e) =>
              setZoneForm({ ...zoneForm, notes: e.target.value })
            }
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowAddZone(false);
                setEditingZone(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createZone.isPending || updateZone.isPending}>
              {editingZone
                ? (updateZone.isPending ? "Saving..." : "Save")
                : (createZone.isPending ? "Adding..." : "Add Zone")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Structure Modal */}
      <Modal
        open={showAddStructure}
        onClose={() => {
          setShowAddStructure(false);
          resetStructForm();
        }}
        title={editingStructure ? "Edit Structure" : "Add Structure"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!locationId) return;
            const data = {
              name: structForm.name,
              width: Number(structForm.width) || 0,
              depth: Number(structForm.depth) || 0,
              height: Number(structForm.height) || 10,
              stories: Number(structForm.stories) || 1,
              roofType: structForm.roofType,
              posX: Number(structForm.posX) || 0,
              posY: Number(structForm.posY) || 0,
            };
            if (editingStructure) {
              updateStructure.mutate(
                { locationId, id: editingStructure.id, data },
                {
                  onSuccess: () => {
                    setShowAddStructure(false);
                    resetStructForm();
                    showToast("Structure updated", "success");
                  },
                  onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                }
              );
            } else {
              createStructure.mutate(
                { locationId, data },
                {
                  onSuccess: () => {
                    setShowAddStructure(false);
                    resetStructForm();
                    showToast("Structure added!", "success");
                  },
                  onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                }
              );
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Name"
            placeholder="e.g., Main House"
            value={structForm.name}
            onChange={(e) =>
              setStructForm({ ...structForm, name: e.target.value })
            }
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Width (ft)"
              type="number"
              step="any"
              placeholder="e.g., 30"
              value={structForm.width}
              onChange={(e) => setStructForm({ ...structForm, width: e.target.value })}
              required
            />
            <Input
              label="Depth (ft)"
              type="number"
              step="any"
              placeholder="e.g., 32"
              value={structForm.depth}
              onChange={(e) => setStructForm({ ...structForm, depth: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Stories"
                type="number"
                min="1"
                max="4"
                value={structForm.stories}
                onChange={(e) => {
                  const stories = Number(e.target.value);
                  const suggestedHeight = stories === 1 ? "10" : stories === 2 ? "22" : stories === 3 ? "32" : String(stories * 10 + 2);
                  setStructForm({
                    ...structForm,
                    stories: e.target.value,
                    height: suggestedHeight,
                  });
                }}
              />
            </div>
            <div>
              <Input
                label="Height (ft)"
                type="number"
                step="any"
                value={structForm.height}
                onChange={(e) => setStructForm({ ...structForm, height: e.target.value })}
              />
              <p className="text-xs text-stone-500 mt-1">
                Auto-estimated from stories
              </p>
            </div>
          </div>

          {/* Roof type visual picker */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-2">
              Roof Type
            </label>
            <div className="grid grid-cols-5 gap-2">
              {([
                { value: "flat", label: "Flat", desc: "Level top",
                  path: "M8 22 L8 12 L40 12 L40 22" },
                { value: "gable", label: "Gable", desc: "Classic triangle peak",
                  path: "M8 22 L8 14 L24 4 L40 14 L40 22" },
                { value: "hip", label: "Hip", desc: "Slopes on all four sides",
                  path: "M8 22 L8 14 L16 6 L32 6 L40 14 L40 22" },
                { value: "shed", label: "Shed", desc: "Single sloped surface",
                  path: "M8 22 L8 8 L40 14 L40 22" },
                { value: "gambrel", label: "Gambrel", desc: "Barn-style, two slopes per side",
                  path: "M8 22 L8 14 L14 8 L24 4 L34 8 L40 14 L40 22" },
              ] as const).map((roof) => {
                const isSelected = structForm.roofType === roof.value;
                return (
                  <button
                    key={roof.value}
                    type="button"
                    onClick={() => setStructForm({ ...structForm, roofType: roof.value })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 text-sky-300"
                        : "border-stone-700 bg-stone-800/50 text-stone-400 hover:border-stone-600 hover:text-stone-300"
                    }`}
                    title={roof.desc}
                  >
                    <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
                      <path
                        d={roof.path}
                        stroke={isSelected ? "#38bdf8" : "#78716c"}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        fill={isSelected ? "rgba(56,189,248,0.1)" : "rgba(120,113,108,0.1)"}
                      />
                      {/* Ground line */}
                      <line x1="4" y1="22" x2="44" y2="22" stroke={isSelected ? "#38bdf8" : "#78716c"} strokeWidth={1} opacity={0.4} />
                    </svg>
                    <span className="text-[10px] font-[family-name:var(--font-display)] font-semibold">
                      {roof.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Position X (ft from left edge)"
              type="number"
              step="any"
              value={structForm.posX}
              onChange={(e) => setStructForm({ ...structForm, posX: e.target.value })}
            />
            <Input
              label="Position Y (ft from top edge)"
              type="number"
              step="any"
              value={structForm.posY}
              onChange={(e) => setStructForm({ ...structForm, posY: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowAddStructure(false);
                resetStructForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createStructure.isPending || updateStructure.isPending}>
              {editingStructure ? "Save" : "Add Structure"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete || !locationId) return;
          if (confirmDelete.type === "zone") {
            deleteZone.mutate(confirmDelete.id);
          } else {
            deleteStructureHook.mutate({ locationId, id: confirmDelete.id });
          }
        }}
        title={`Delete ${confirmDelete?.type === "zone" ? "Zone" : "Structure"}`}
        message={`Are you sure you want to delete "${confirmDelete?.name ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
