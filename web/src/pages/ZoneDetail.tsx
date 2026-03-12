import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Sun, Droplets, Wind, Layers, Check, X, Clock, Sunrise, Bell, ChevronDown, ChevronRight, Unlink } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import StatusBadge from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toast";
import {
  useZone,
  usePlantInstances,
  usePlantReferences,
  useCreatePlantInstance,
  useUpdatePlantInstance,
  useSunData,
  useUpdateZone,
} from "../api/hooks";
import type { PlantType, PlantMood, PlantStatus, PlantInstance, CareTaskType } from "../api";
import { taskTypes, taskTypeIcons } from "../utils/constants";

const statusOptions: PlantStatus[] = [
  "planned", "planted", "established", "struggling", "dormant",
];

function sunHoursEstimate(sunExposure?: string | null): string {
  switch (sunExposure) {
    case "full_sun": return "~6-8+ hours of direct sun";
    case "partial_sun": return "~4-6 hours of direct sun";
    case "partial_shade": return "~2-4 hours of direct sun";
    case "full_shade": return "~0-2 hours of direct sun";
    default: return "Sun exposure not set";
  }
}

function getCompanionList(plant: PlantInstance): string[] {
  const companions = plant.plantReference?.companionPlants;
  if (!companions) return [];
  return companions.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function checkCompanionCompatibility(plantA: PlantInstance, plantB: PlantInstance): "compatible" | "incompatible" | "unknown" {
  const aCompanions = getCompanionList(plantA);
  const bCompanions = getCompanionList(plantB);
  const aName = plantA.plantReference?.commonName?.toLowerCase() ?? "";
  const bName = plantB.plantReference?.commonName?.toLowerCase() ?? "";

  // Check if A lists B as companion or vice versa
  if (aCompanions.some((c) => bName.includes(c) || c.includes(bName))) return "compatible";
  if (bCompanions.some((c) => aName.includes(c) || c.includes(aName))) return "compatible";

  // If both have companion data but neither mentions the other, unknown
  if (aCompanions.length > 0 || bCompanions.length > 0) return "unknown";
  return "unknown";
}

export default function ZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const zoneId = id ? Number(id) : undefined;
  const { data: zone, isLoading } = useZone(zoneId);
  const { data: plants } = usePlantInstances(
    zoneId ? { zoneId } : undefined
  );
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");
  const { data: plantRefs } = usePlantReferences(
    plantSearch || undefined
  );
  const createPlantInstance = useCreatePlantInstance();
  const updatePlantInstance = useUpdatePlantInstance();
  const [selectedRef, setSelectedRef] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<PlantStatus>("planned");
  const [datePlanted, setDatePlanted] = useState("");
  const [isContainer, setIsContainer] = useState(false);
  const [showBedView, setShowBedView] = useState(true);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [overrideGlobal, setOverrideGlobal] = useState(false);
  const updateZone = useUpdateZone();
  const { showToast } = useToast();

  // Sun data for the zone's location
  const { data: sunData } = useSunData(zone?.locationId);

  // Companion planting analysis
  const companionPairs = useMemo(() => {
    if (!plants || plants.length < 2) return [];
    const pairs: { a: PlantInstance; b: PlantInstance; status: "compatible" | "incompatible" | "unknown" }[] = [];
    for (let i = 0; i < plants.length; i++) {
      for (let j = i + 1; j < plants.length; j++) {
        const compatibility = checkCompanionCompatibility(plants[i]!, plants[j]!);
        if (compatibility !== "unknown") {
          pairs.push({ a: plants[i]!, b: plants[j]!, status: compatibility });
        }
      }
    }
    return pairs;
  }, [plants]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-800 rounded animate-pulse" />
        <div className="h-40 bg-stone-900 border border-stone-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400">Zone not found</p>
      </div>
    );
  }

  const attrItems = [
    { icon: Sun, label: "Sun", value: zone.sunExposure?.replace("_", " ") },
    { icon: Layers, label: "Soil", value: zone.soilType },
    { icon: Droplets, label: "Moisture", value: zone.moistureLevel },
    { icon: Wind, label: "Wind", value: zone.windExposure },
  ];

  // Grid layout for bed view
  const gridCols = Math.max(2, Math.ceil(Math.sqrt(plants?.length ?? 0)));
  const cellSize = Math.min(80, Math.floor((zone.width * 5) / gridCols));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 font-display mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-2xl font-bold font-display text-stone-100">
          {zone.name}
        </h1>
        <p className="text-stone-400 text-sm mt-1 font-mono">
          {zone.width}x{zone.depth}ft
          {zone.isIndoor ? " · indoor" : ""}
        </p>
        {zone.description && (
          <p className="text-stone-400 text-sm mt-1">{zone.description}</p>
        )}
      </div>

      {/* Zone Attributes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {attrItems.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-stone-500" />
              <span className="text-xs text-stone-500 font-display">
                {label}
              </span>
            </div>
            <p className="text-sm text-stone-200 font-mono">
              {value ?? "--"}
            </p>
          </Card>
        ))}
      </div>

      {/* Sun Analysis */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
          Sun Analysis
        </h2>
        <div className="flex items-start gap-4">
          {sunData && (
            <div className="shrink-0">
              <svg width={120} height={40} viewBox="0 0 120 40">
                <path
                  d="M 5 35 Q 60 -10 115 35"
                  fill="none"
                  stroke="rgba(250, 204, 21, 0.2)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <line x1={3} y1={35} x2={117} y2={35} stroke="rgba(120,113,108,0.2)" strokeWidth={1} />
                {(() => {
                  const now = new Date();
                  const sunrise = new Date(sunData.sunrise);
                  const sunset = new Date(sunData.sunset);
                  const total = sunset.getTime() - sunrise.getTime();
                  const elapsed = now.getTime() - sunrise.getTime();
                  const t = Math.max(0, Math.min(1, elapsed / total));
                  const isDaytime = t > 0 && t < 1;
                  if (!isDaytime) return null;
                  const sx = 5 + t * 110;
                  const sy = (1-t)*(1-t)*35 + 2*(1-t)*t*(-10) + t*t*35;
                  return <circle cx={sx} cy={sy} r={4} fill="#facc15" opacity={0.8} />;
                })()}
              </svg>
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm text-stone-200 font-display">
              {sunHoursEstimate(zone.sunExposure)}
            </p>
            {sunData && (
              <div className="flex gap-4 mt-1.5 text-xs text-stone-500 font-mono">
                <span className="flex items-center gap-1">
                  <Sunrise size={10} />
                  {new Date(sunData.sunrise).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span>
                  Day: {sunData.dayLength}
                </span>
              </div>
            )}
            {zone.sunExposure === "full_sun" && (
              <p className="text-xs text-emerald-400/80 mt-1">
                Great for sun-loving vegetables, herbs, and flowers.
              </p>
            )}
            {zone.sunExposure === "partial_sun" && (
              <p className="text-xs text-amber-400/80 mt-1">
                Good for many perennials, some vegetables, and herbs.
              </p>
            )}
            {zone.sunExposure === "partial_shade" && (
              <p className="text-xs text-sky-400/80 mt-1">
                Ideal for hostas, ferns, and shade-tolerant groundcovers.
              </p>
            )}
            {zone.sunExposure === "full_shade" && (
              <p className="text-xs text-stone-400/80 mt-1">
                Best for deep shade plants like ferns, mosses, and some hostas.
              </p>
            )}
          </div>
        </div>
      </Card>

      {zone.notes && (
        <Card>
          <p className="text-sm text-stone-300">{zone.notes}</p>
        </Card>
      )}

      {/* Companion Planting Alerts */}
      {companionPairs.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
            Companion Planting
          </h2>
          <div className="space-y-1.5">
            {companionPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {pair.status === "compatible" ? (
                  <Check size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <X size={12} className="text-red-400 shrink-0" />
                )}
                <span className="text-stone-300 font-display">
                  {pair.a.nickname ?? pair.a.plantReference?.commonName ?? "Plant"}
                </span>
                <span className="text-stone-600">&amp;</span>
                <span className="text-stone-300 font-display">
                  {pair.b.nickname ?? pair.b.plantReference?.commonName ?? "Plant"}
                </span>
                <span className={`font-mono ${pair.status === "compatible" ? "text-emerald-400/60" : "text-red-400/60"}`}>
                  {pair.status === "compatible" ? "good companions" : "avoid together"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Visual Planting Bed View */}
      {plants && plants.length > 0 && showBedView && (
        <Card>
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
            Bed View
          </h2>
          <div className="flex justify-center p-3">
            <div
              className="border-2 border-dashed border-stone-700 rounded-lg relative p-3 bg-stone-950/50"
              style={{
                width: Math.min(zone.width * 5, 400),
                minHeight: Math.min(zone.depth * 5, 300),
              }}
            >
              <div
                className="grid gap-2 justify-items-center"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                }}
              >
                {plants.map((plant) => (
                  <div
                    key={plant.id}
                    className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/my-plants/${plant.id}`)}
                    title={getMoodMessage(plant.mood, plant.nickname ?? undefined)}
                  >
                    <PlantSprite
                      type={(plant.plantReference?.plantType as PlantType) ?? "flower"}
                      mood={plant.mood}
                      size={36}
                    />
                    <span className="text-[9px] text-stone-400 mt-0.5 truncate max-w-[60px] text-center">
                      {plant.nickname ?? plant.plantReference?.commonName ?? "Plant"}
                    </span>
                  </div>
                ))}
              </div>
              {/* Zone dimensions label */}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-stone-600 font-mono">
                {zone.width}x{zone.depth}ft
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Plants Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-display text-stone-200">
            Plants in this Zone
          </h2>
          <Button size="sm" onClick={() => setShowAddPlant(true)}>
            <Plus size={14} /> Add Plant
          </Button>
        </div>
        {plants && plants.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {plants.map((plant) => (
              <Card
                key={plant.id}
                hoverable
                onClick={() => navigate(`/my-plants/${plant.id}`)}
                className="text-center py-4 relative group"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePlantInstance.mutate(
                      { id: plant.id, data: { zoneId: null } },
                      { onSuccess: () => showToast(`${plant.nickname ?? plant.plantReference?.commonName ?? "Plant"} removed from zone`, "success") },
                    );
                  }}
                  className="absolute top-2 right-2 p-1 rounded text-stone-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from zone"
                >
                  <Unlink size={12} />
                </button>
                <PlantSprite
                  type={
                    (plant.plantReference?.plantType as PlantType) ?? "flower"
                  }
                  mood={plant.mood}
                  size={56}
                />
                <p className="text-sm font-medium text-stone-200 mt-2 font-display truncate">
                  {plant.nickname ??
                    plant.plantReference?.commonName ??
                    "Plant"}
                </p>
                <StatusBadge status={plant.status} />
                <p className="text-xs text-stone-400 mt-1.5 font-mono italic">
                  {getMoodMessage(plant.mood, plant.nickname ?? undefined)}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-10">
            <PlantSprite
              type="herb"
              mood="new"
              size={48}
              className="mx-auto"
            />
            <p className="text-stone-400 text-sm mt-3 font-display">
              This zone is empty. Time to plant something!
            </p>
          </Card>
        )}
      </div>

      {/* Notification Settings */}
      <Card>
        <button
          onClick={() => setShowNotifSettings(!showNotifSettings)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showNotifSettings ? <ChevronDown size={14} className="text-stone-500" /> : <ChevronRight size={14} className="text-stone-500" />}
          <Bell size={14} className="text-stone-500" />
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
            Notification Settings
          </h2>
        </button>
        {showNotifSettings && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-stone-500">
              These settings apply to all plants in this zone unless overridden on individual plants.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideGlobal}
                onChange={(e) => setOverrideGlobal(e.target.checked)}
                className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span className="text-sm text-stone-300 font-display">
                Override global settings for all plants in this zone
              </span>
            </label>
            {overrideGlobal && (
              <div className="space-y-2">
                {(taskTypes.filter((t) => t !== "custom") as CareTaskType[]).map((tt) => (
                  <div key={tt} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-stone-800/50">
                    <span className="text-sm w-5 text-center">{taskTypeIcons[tt]}</span>
                    <span className="text-xs text-stone-200 font-display flex-1 capitalize">
                      {tt.replace("_", " ")}
                    </span>
                    <select
                      defaultValue="default"
                      onChange={(e) => {
                        if (!zoneId) return;
                        showToast(`Zone ${tt} notifications set to: ${e.target.value}`, "success");
                      }}
                      className="bg-stone-800 border border-stone-700 rounded-lg text-xs text-stone-300 px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    >
                      <option value="default">Use global default</option>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add Plant Modal */}
      <Modal
        open={showAddPlant}
        onClose={() => {
          setShowAddPlant(false);
          setSelectedRef(null);
          setNickname("");
          setPlantSearch("");
          setStatus("planned");
          setDatePlanted("");
          setIsContainer(false);
        }}
        title="Add Plant to Zone"
        wide
      >
        <div className="space-y-4">
          <Input
            label="Search Plant Database"
            placeholder="Search by name..."
            value={plantSearch}
            onChange={(e) => setPlantSearch(e.target.value)}
          />

          {plantRefs && plantRefs.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-stone-800 rounded-lg p-2">
              {plantRefs.map((ref) => (
                <button
                  key={ref.id}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                    selectedRef === ref.id
                      ? "bg-emerald-600/20 text-emerald-400"
                      : "text-stone-300 hover:bg-stone-800"
                  }`}
                  onClick={() => setSelectedRef(ref.id)}
                >
                  <PlantSprite
                    type={(ref.plantType as PlantType) ?? "flower"}
                    mood="happy"
                    size={24}
                  />
                  <div>
                    <span className="font-display font-medium">
                      {ref.commonName}
                    </span>
                    {ref.latinName && (
                      <span className="text-xs text-stone-500 ml-2 italic font-mono">
                        {ref.latinName}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedRef && (
            <>
              <Input
                label="Nickname (optional)"
                placeholder="Give it a name!"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PlantStatus)}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
              <Input
                label="Date Planted"
                type="date"
                value={datePlanted}
                onChange={(e) => setDatePlanted(e.target.value)}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isContainer}
                  onChange={(e) => setIsContainer(e.target.checked)}
                  className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span className="text-sm text-stone-300 font-display">Container plant</span>
              </label>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddPlant(false);
                setSelectedRef(null);
                setNickname("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedRef || createPlantInstance.isPending}
              onClick={() => {
                if (!selectedRef || !zoneId) return;
                createPlantInstance.mutate(
                  {
                    plantReferenceId: selectedRef,
                    zoneId,
                    nickname: nickname || undefined,
                    status,
                    mood: "new" as PlantMood,
                    datePlanted: datePlanted || undefined,
                    isContainer,
                  },
                  {
                    onSuccess: () => {
                      setShowAddPlant(false);
                      setSelectedRef(null);
                      setNickname("");
                      setPlantSearch("");
                      setStatus("planned");
                      setDatePlanted("");
                      setIsContainer(false);
                    },
                  }
                );
              }}
            >
              {createPlantInstance.isPending ? "Adding..." : "Add Plant"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
