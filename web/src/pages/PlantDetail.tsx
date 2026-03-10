import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sun,
  Droplets,
  Ruler,
  Leaf,
  ShoppingCart,
  Plus,
  Thermometer,
  Bug,
  Bird,
  Flower2,
  Shield,
  MapPin,
  Scissors,
  Snowflake,
  Sprout,
  Container,
  Database,
  Globe,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import PlantSprite from "../components/sprites/PlantSprite";
import SafetyBadge from "../components/ui/SafetyBadge";
import { useToast } from "../components/ui/Toast";
import {
  usePlantReference,
  useLocations,
  useZones,
  useCreatePlantInstance,
  useCreateShoppingItem,
} from "../api/hooks";
import type { PlantMood, PlantStatus, PlantType } from "../api";

const statusOptions: PlantStatus[] = [
  "planned", "planted", "established", "struggling", "dormant",
];

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const plantId = id ? Number(id) : undefined;
  const { data: plant, isLoading } = usePlantReference(plantId);
  const { data: locations } = useLocations();
  const addToCart = useCreateShoppingItem();
  const createInstance = useCreatePlantInstance();
  const { showToast } = useToast();

  const [showAddToGarden, setShowAddToGarden] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const { data: zones } = useZones(
    selectedLocationId ? Number(selectedLocationId) : undefined
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<PlantStatus>("planned");
  const [datePlanted, setDatePlanted] = useState("");
  const [isContainer, setIsContainer] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-800 rounded animate-pulse" />
        <div className="h-60 bg-stone-900 border border-stone-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400">Plant not found</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/plants")}
        >
          <ArrowLeft size={16} /> Back to Plants
        </Button>
      </div>
    );
  }

  const infoItems = [
    {
      icon: Sun,
      label: "Sun",
      value: plant.sunRequirement?.replace("_", " "),
    },
    { icon: Droplets, label: "Water", value: plant.waterNeeds },
    {
      icon: Ruler,
      label: "Height",
      value: plant.matureHeight ?? undefined,
    },
    {
      icon: Ruler,
      label: "Spread",
      value: plant.matureSpread ?? undefined,
    },
    { icon: Leaf, label: "Growth Rate", value: plant.growthRate },
    { icon: Leaf, label: "Bloom Time", value: plant.bloomTime },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/plants")}
          className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 font-[family-name:var(--font-display)] mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Plants
        </button>
      </div>

      {/* Hero */}
      <Card className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="shrink-0">
          <PlantSprite type={(plant.plantType as PlantType) ?? "flower"} mood="happy" size={96} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-stone-100">
            {plant.commonName}
          </h1>
          {plant.latinName && (
            <p className="text-stone-400 italic font-[family-name:var(--font-mono)] mt-0.5">
              {plant.latinName}
            </p>
          )}
          {plant.cultivar && (
            <p className="text-stone-500 text-sm mt-0.5">
              Cultivar: {plant.cultivar}
            </p>
          )}
          {plant.family && (
            <p className="text-stone-500 text-sm mt-0.5">
              Family: {plant.family}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm text-emerald-400 capitalize font-[family-name:var(--font-display)]">
              {plant.plantType}
            </p>
            {plant.source && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-stone-800 text-stone-400">
                {plant.source === "perenual" ? <Globe size={10} /> : <Database size={10} />}
                {plant.source === "perenual" ? "Imported from Perenual" : "Local"}
              </span>
            )}
          </div>
          {plant.description && (
            <p className="text-stone-300 text-sm mt-3 leading-relaxed">
              {plant.description}
            </p>
          )}
          {plant.careNotes && (
            <p className="text-stone-400 text-sm mt-2 leading-relaxed italic">
              {plant.careNotes}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => setShowAddToGarden(true)} size="sm">
              <Plus size={14} /> Add to My Garden
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                addToCart.mutate({
                  name: plant.commonName,
                  plantReferenceId: plant.id,
                  quantity: 1,
                })
              }
            >
              <ShoppingCart size={14} /> Add to Shopping List
            </Button>
          </div>
        </div>
      </Card>

      {/* Care Requirements */}
      <div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200 mb-3">
          Care Requirements
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-stone-500" />
                <span className="text-xs text-stone-500 font-[family-name:var(--font-display)]">
                  {label}
                </span>
              </div>
              <p className="text-sm text-stone-200 font-[family-name:var(--font-mono)] capitalize">
                {value ?? "--"}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plant.soilPreference && (
          <Card>
            <p className="text-xs text-stone-500 mb-1 font-[family-name:var(--font-display)]">
              Soil Preference
            </p>
            <p className="text-sm text-stone-200">{plant.soilPreference}</p>
          </Card>
        )}
        {plant.bloomColor && (
          <Card>
            <p className="text-xs text-stone-500 mb-1 font-[family-name:var(--font-display)]">
              Bloom Color
            </p>
            <p className="text-sm text-stone-200">{plant.bloomColor}</p>
          </Card>
        )}
        {(plant.hardinessZoneMin != null || plant.hardinessZoneMax != null) && (
          <Card>
            <p className="text-xs text-stone-500 mb-1 font-[family-name:var(--font-display)]">
              Hardiness Zones
            </p>
            <p className="text-sm text-stone-200 font-[family-name:var(--font-mono)]">
              {plant.hardinessZoneMin ?? "?"} — {plant.hardinessZoneMax ?? "?"}
            </p>
          </Card>
        )}
        {plant.foliageType && (
          <Card>
            <p className="text-xs text-stone-500 mb-1 font-[family-name:var(--font-display)]">
              Foliage Type
            </p>
            <p className="text-sm text-stone-200 capitalize">
              {plant.foliageType}
            </p>
          </Card>
        )}
      </div>

      {/* Safety */}
      <div>
        <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200 mb-3">
          Safety Ratings
        </h2>
        <Card>
          <div className="flex flex-wrap gap-2">
            {plant.toxicityDogs ? (
              <SafetyBadge level={plant.toxicityDogs} for="dogs" />
            ) : (
              <span className="text-sm text-stone-500">
                No dog safety data
              </span>
            )}
            {plant.toxicityCats && (
              <SafetyBadge level={plant.toxicityCats} for="cats" />
            )}
            {plant.toxicityChildren && (
              <SafetyBadge level={plant.toxicityChildren} for="children" />
            )}
          </div>
        </Card>
      </div>

      {/* Extended Plant Info */}
      {(plant.lifecycle ||
        plant.nativeRegion ||
        plant.minTempF != null ||
        plant.maxTempF != null ||
        plant.droughtTolerant ||
        plant.deerResistant ||
        plant.containerSuitable ||
        plant.attractsPollinators ||
        plant.attractsBirds ||
        plant.attractsButterflies) && (
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200 mb-3">
            Plant Traits
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {plant.lifecycle && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Sprout size={14} className="text-stone-500" />
                  <span className="text-xs text-stone-500 font-[family-name:var(--font-display)]">
                    Lifecycle
                  </span>
                </div>
                <p className="text-sm text-stone-200 capitalize">
                  {plant.lifecycle.replace("_", " ")}
                </p>
              </Card>
            )}
            {plant.nativeRegion && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={14} className="text-stone-500" />
                  <span className="text-xs text-stone-500 font-[family-name:var(--font-display)]">
                    Native Region
                  </span>
                </div>
                <p className="text-sm text-stone-200">{plant.nativeRegion}</p>
              </Card>
            )}
            {(plant.minTempF != null || plant.maxTempF != null) && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer size={14} className="text-stone-500" />
                  <span className="text-xs text-stone-500 font-[family-name:var(--font-display)]">
                    Temperature Range
                  </span>
                </div>
                <p className="text-sm text-stone-200 font-[family-name:var(--font-mono)]">
                  {plant.minTempF ?? "?"}°F — {plant.maxTempF ?? "?"}°F
                </p>
              </Card>
            )}
          </div>

          {/* Trait badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {plant.droughtTolerant === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-amber-900/30 text-amber-400 flex items-center gap-1.5">
                <Droplets size={12} /> Drought Tolerant
              </span>
            )}
            {plant.deerResistant === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-green-900/30 text-green-400 flex items-center gap-1.5">
                <Shield size={12} /> Deer Resistant
              </span>
            )}
            {plant.containerSuitable === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-blue-900/30 text-blue-400 flex items-center gap-1.5">
                <Container size={12} /> Container Suitable
              </span>
            )}
            {plant.attractsPollinators === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-yellow-900/30 text-yellow-400 flex items-center gap-1.5">
                <Bug size={12} /> Attracts Pollinators
              </span>
            )}
            {plant.attractsBirds === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-sky-900/30 text-sky-400 flex items-center gap-1.5">
                <Bird size={12} /> Attracts Birds
              </span>
            )}
            {plant.attractsButterflies === 1 && (
              <span className="text-xs px-2 py-1 rounded-lg bg-pink-900/30 text-pink-400 flex items-center gap-1.5">
                <Flower2 size={12} /> Attracts Butterflies
              </span>
            )}
          </div>
        </div>
      )}

      {/* Care Notes */}
      {(plant.plantingNotes || plant.pruningNotes || plant.overwinteringNotes || plant.companionPlants) && (
        <div>
          <h2 className="text-lg font-semibold font-[family-name:var(--font-display)] text-stone-200 mb-3">
            Care Guides
          </h2>
          <div className="space-y-3">
            {plant.plantingNotes && (
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Sprout size={14} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                    Planting Notes
                  </span>
                </div>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {plant.plantingNotes}
                </p>
              </Card>
            )}
            {plant.pruningNotes && (
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Scissors size={14} className="text-amber-500" />
                  <span className="text-sm font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                    Pruning Notes
                  </span>
                </div>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {plant.pruningNotes}
                </p>
              </Card>
            )}
            {plant.overwinteringNotes && (
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Snowflake size={14} className="text-blue-400" />
                  <span className="text-sm font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                    Overwintering
                  </span>
                </div>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {plant.overwinteringNotes}
                </p>
              </Card>
            )}
            {plant.companionPlants && (
              <Card>
                <div className="flex items-center gap-2 mb-2">
                  <Leaf size={14} className="text-green-500" />
                  <span className="text-sm font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                    Companion Plants
                  </span>
                </div>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {plant.companionPlants}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Add to Garden Modal */}
      <Modal
        open={showAddToGarden}
        onClose={() => setShowAddToGarden(false)}
        title="Add to My Garden"
      >
        <div className="space-y-4">
          <Select
            label="Location"
            value={selectedLocationId}
            onChange={(e) => {
              setSelectedLocationId(e.target.value);
              setSelectedZoneId("");
            }}
          >
            <option value="">Select a location...</option>
            {locations?.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>

          {selectedLocationId && (
            <Select
              label="Zone"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
            >
              <option value="">Select a zone...</option>
              {zones?.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
          )}

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
            <span className="text-sm text-stone-300 font-[family-name:var(--font-display)]">Container plant</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowAddToGarden(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !selectedZoneId || createInstance.isPending
              }
              onClick={() => {
                if (!selectedZoneId || !plant.id) return;
                createInstance.mutate(
                  {
                    plantReferenceId: plant.id,
                    zoneId: Number(selectedZoneId),
                    nickname: nickname || undefined,
                    status,
                    mood: "new" as PlantMood,
                    datePlanted: datePlanted || undefined,
                    isContainer,
                  },
                  {
                    onSuccess: (result) => {
                      setShowAddToGarden(false);
                      setNickname("");
                      setStatus("planned");
                      setDatePlanted("");
                      setIsContainer(false);
                      showToast("Plant added to your garden!", "success");
                      navigate(`/my-plants/${result.id}`);
                    },
                    onError: (err) => showToast(`Failed to add plant: ${(err as Error).message}`, "error"),
                  }
                );
              }}
            >
              {createInstance.isPending ? "Adding..." : "Add Plant"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
