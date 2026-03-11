import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  Filter,
  X,
  Download,
  Globe,
  Database,
  Leaf,
  Droplets,
  Bug,
  Bird,
  Flower2,
  Shield,
  Plus,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Chip from "../components/ui/Chip";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import PlantSprite from "../components/sprites/PlantSprite";
import SafetyBadge from "../components/ui/SafetyBadge";
import {
  usePlantReferences,
  useCreateShoppingItem,
  useCreatePlantReference,
  usePlantSearch,
  useImportPlant,
} from "../api/hooks";
import type { PlantType, SafetyLevel } from "../api";

const plantTypes: PlantType[] = [
  "flower",
  "shrub",
  "tree",
  "herb",
  "fern",
  "succulent",
  "cactus",
  "vine",
  "grass",
  "bulb",
  "vegetable",
  "fruit",
];

export default function PlantBrowser() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [sunFilter, setSunFilter] = useState("");
  const [waterFilter, setWaterFilter] = useState("");
  const { data: plants, isLoading } = usePlantReferences(search || undefined);
  const {
    data: searchResults,
    isLoading: isSearching,
  } = usePlantSearch(search);
  const addToCart = useCreateShoppingItem();
  const importPlant = useImportPlant();
  const createPlantRef = useCreatePlantReference();
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  let filtered = plants ?? [];
  if (typeFilter) {
    filtered = filtered.filter((p) => p.plantType === typeFilter);
  }
  if (sunFilter) {
    filtered = filtered.filter((p) => p.sunRequirement === sunFilter);
  }
  if (waterFilter) {
    filtered = filtered.filter((p) => p.waterNeeds === waterFilter);
  }

  const apiResults = searchResults?.api ?? [];
  const hasApiResults = apiResults.length > 0;
  const apiAvailable = searchResults?.apiAvailable ?? false;

  async function handleImport(perenualId: number) {
    setImportingIds((prev) => new Set(prev).add(perenualId));
    try {
      const result = await importPlant.mutateAsync(perenualId);
      navigate(`/plants/${result.id}`);
    } catch {
      // Error handled by mutation
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(perenualId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-stone-100">
          Plant Browser
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Explore the reference database
          {apiAvailable && (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
              <Globe size={12} /> Perenual API connected
            </span>
          )}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
            />
            <input
              className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-9 pr-3 py-2 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors font-[family-name:var(--font-display)]"
              placeholder="Search plants (local + online)..."
              value={search}
              onChange={(e) => {
                if (e.target.value) {
                  setSearchParams({ search: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Add Plant
          </Button>
          <Button
            variant={showFilters ? "primary" : "secondary"}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? <X size={16} /> : <Filter size={16} />}
            Filters
          </Button>
        </div>

        {showFilters && (
          <Card className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Plant Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {plantTypes.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
            <Select
              label="Sun Requirement"
              value={sunFilter}
              onChange={(e) => setSunFilter(e.target.value)}
            >
              <option value="">Any Sun</option>
              <option value="full_sun">Full Sun</option>
              <option value="partial_sun">Partial Sun</option>
              <option value="partial_shade">Partial Shade</option>
              <option value="full_shade">Full Shade</option>
            </Select>
            <Select
              label="Water Needs"
              value={waterFilter}
              onChange={(e) => setWaterFilter(e.target.value)}
            >
              <option value="">Any Water</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </Select>
          </Card>
        )}
      </div>

      {/* Local Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-stone-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-stone-800 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-stone-800 rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {search && (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Database size={14} />
              <span>
                {filtered.length} local result{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((plant) => (
              <Card key={plant.id} hoverable>
                <div
                  className="flex items-start gap-3"
                  onClick={() => navigate(`/plants/${plant.id}`)}
                >
                  <PlantSprite
                    type={(plant.plantType as PlantType) ?? "flower"}
                    mood="happy"
                    size={48}
                    showOverlay={false}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-200 font-[family-name:var(--font-display)] truncate">
                      {plant.commonName}
                    </h3>
                    {plant.latinName && (
                      <p className="text-xs text-stone-500 italic font-[family-name:var(--font-mono)] truncate">
                        {plant.latinName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-stone-400 capitalize">
                        {plant.plantType}
                        {plant.sunRequirement
                          ? ` · ${plant.sunRequirement.replace("_", " ")}`
                          : ""}
                      </p>
                      {plant.lifecycle && (
                        <Chip className="capitalize">
                          {plant.lifecycle.replace("_", " ")}
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trait badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plant.toxicityDogs && (
                    <SafetyBadge level={plant.toxicityDogs} for="dogs" />
                  )}
                  {plant.toxicityCats && (
                    <SafetyBadge level={plant.toxicityCats} for="cats" />
                  )}
                  {plant.toxicityChildren && (
                    <SafetyBadge
                      level={plant.toxicityChildren}
                      for="children"
                    />
                  )}
                  {plant.droughtTolerant && (
                    <Chip color="amber">
                      <Droplets size={10} /> Drought tolerant
                    </Chip>
                  )}
                  {plant.deerResistant && (
                    <Chip color="green">
                      <Shield size={10} /> Deer resistant
                    </Chip>
                  )}
                  {plant.attractsPollinators && (
                    <Chip color="yellow">
                      <Bug size={10} /> Pollinators
                    </Chip>
                  )}
                  {plant.attractsBirds && (
                    <Chip color="sky">
                      <Bird size={10} /> Birds
                    </Chip>
                  )}
                  {plant.attractsButterflies && (
                    <Chip color="pink">
                      <Flower2 size={10} /> Butterflies
                    </Chip>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-stone-800">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart.mutate({
                        name: plant.commonName,
                        plantReferenceId: plant.id,
                        quantity: 1,
                      });
                    }}
                    className="text-xs text-stone-400 hover:text-emerald-400 font-[family-name:var(--font-display)] flex items-center gap-1 transition-colors"
                  >
                    <ShoppingCart size={12} /> Add to Shopping List
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : !search ? (
        <Card className="text-center py-12">
          <PlantSprite
            type="flower"
            mood="happy"
            size={64}
            className="mx-auto"
          />
          <p className="text-lg font-semibold text-stone-200 font-[family-name:var(--font-display)] mt-4">
            Browse the plant database
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Start typing to search local plants
            {apiAvailable ? " and discover new ones online" : ""}
          </p>
        </Card>
      ) : null}

      {/* API Results */}
      {search && hasApiResults && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-stone-400">
            <Globe size={14} />
            <span>
              {apiResults.length} online result
              {apiResults.length !== 1 ? "s" : ""}
              {searchResults?.apiTotal
                ? ` of ${searchResults.apiTotal} total`
                : ""}
            </span>
            <Chip>
              Perenual API
            </Chip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {apiResults.map((result) => (
              <Card
                key={`api-${result.perenualId}`}
                className="border border-stone-700/50"
              >
                <div className="flex items-start gap-3">
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.commonName}
                      className="w-12 h-12 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-stone-800 flex items-center justify-center">
                      <Leaf size={20} className="text-stone-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-200 font-[family-name:var(--font-display)] truncate">
                      {result.commonName}
                    </h3>
                    {result.latinName && (
                      <p className="text-xs text-stone-500 italic font-[family-name:var(--font-mono)] truncate">
                        {result.latinName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {result.cycle && (
                        <Chip>{result.cycle}</Chip>
                      )}
                      {result.watering && (
                        <Chip color="blue">{result.watering} water</Chip>
                      )}
                      {(Array.isArray(result.sunlight) ? result.sunlight : result.sunlight ? [result.sunlight] : []).map((s) => (
                        <Chip key={s} color="yellow">{s}</Chip>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-800">
                  <button
                    onClick={() => handleImport(result.perenualId!)}
                    disabled={importingIds.has(result.perenualId!)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-[family-name:var(--font-display)] flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Download size={12} />
                    {importingIds.has(result.perenualId!)
                      ? "Importing..."
                      : "Import to Local Database"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Loading API results */}
      {search && search.length >= 2 && isSearching && !hasApiResults && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Globe size={14} className="animate-pulse" />
          Searching online databases...
        </div>
      )}

      {/* No results at all */}
      {search &&
        !isLoading &&
        filtered.length === 0 &&
        !isSearching &&
        !hasApiResults && (
          <Card className="text-center py-12">
            <PlantSprite
              type="flower"
              mood="sleeping"
              size={64}
              className="mx-auto"
            />
            <p className="text-lg font-semibold text-stone-200 font-[family-name:var(--font-display)] mt-4">
              No plants found for "{search}"
            </p>
            <p className="text-stone-400 text-sm mt-1">
              {apiAvailable
                ? "No results found locally or online"
                : "Try a different search term, or set up a Perenual API key for online search"}
            </p>
          </Card>
        )}

      {/* Create Custom Plant Modal */}
      <CreatePlantModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(id) => navigate(`/plants/${id}`)}
        mutation={createPlantRef}
      />
    </div>
  );
}

// ---------- Create Plant Modal ----------

const allPlantTypes: PlantType[] = [
  "flower", "shrub", "tree", "herb", "grass", "fern", "succulent",
  "cactus", "vine", "bulb", "vegetable", "fruit", "houseplant",
  "groundcover", "aquatic",
];

function CreatePlantModal({
  open,
  onClose,
  onCreated,
  mutation,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  mutation: ReturnType<typeof useCreatePlantReference>;
}) {
  const [commonName, setCommonName] = useState("");
  const [latinName, setLatinName] = useState("");
  const [cultivar, setCultivar] = useState("");
  const [plantType, setPlantType] = useState("");
  const [sunRequirement, setSunRequirement] = useState("");
  const [waterNeeds, setWaterNeeds] = useState("");
  const [hardinessZoneMin, setHardinessZoneMin] = useState("");
  const [hardinessZoneMax, setHardinessZoneMax] = useState("");
  const [description, setDescription] = useState("");
  const [careNotes, setCareNotes] = useState("");
  const [error, setError] = useState("");

  function resetForm() {
    setCommonName("");
    setLatinName("");
    setCultivar("");
    setPlantType("");
    setSunRequirement("");
    setWaterNeeds("");
    setHardinessZoneMin("");
    setHardinessZoneMax("");
    setDescription("");
    setCareNotes("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!commonName.trim()) {
      setError("Common name is required.");
      return;
    }
    if (!plantType) {
      setError("Plant type is required.");
      return;
    }

    try {
      const result = await mutation.mutateAsync({
        commonName: commonName.trim(),
        latinName: latinName.trim() || null,
        cultivar: cultivar.trim() || null,
        plantType,
        sunRequirement: sunRequirement || null,
        waterNeeds: waterNeeds || null,
        hardinessZoneMin: hardinessZoneMin ? Number(hardinessZoneMin) : null,
        hardinessZoneMax: hardinessZoneMax ? Number(hardinessZoneMax) : null,
        description: description.trim() || null,
        careNotes: careNotes.trim() || null,
        source: "custom",
      });
      resetForm();
      onClose();
      onCreated(result.id);
    } catch {
      setError("Failed to create plant. Please try again.");
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Custom Plant" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Common Name *"
            placeholder="e.g. Japanese Maple"
            value={commonName}
            onChange={(e) => setCommonName(e.target.value)}
          />
          <Input
            label="Latin Name"
            placeholder="e.g. Acer palmatum"
            value={latinName}
            onChange={(e) => setLatinName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Cultivar"
            placeholder="e.g. Bloodgood"
            value={cultivar}
            onChange={(e) => setCultivar(e.target.value)}
          />
          <Select
            label="Plant Type *"
            value={plantType}
            onChange={(e) => setPlantType(e.target.value)}
          >
            <option value="">Select type...</option>
            {allPlantTypes.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Sun Requirement"
            value={sunRequirement}
            onChange={(e) => setSunRequirement(e.target.value)}
          >
            <option value="">Select sun...</option>
            <option value="full_sun">Full Sun</option>
            <option value="partial_sun">Partial Sun</option>
            <option value="partial_shade">Partial Shade</option>
            <option value="full_shade">Full Shade</option>
          </Select>
          <Select
            label="Water Needs"
            value={waterNeeds}
            onChange={(e) => setWaterNeeds(e.target.value)}
          >
            <option value="">Select water...</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="aquatic">Aquatic</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Hardiness Zone Min"
            type="number"
            min={1}
            max={13}
            placeholder="e.g. 5"
            value={hardinessZoneMin}
            onChange={(e) => setHardinessZoneMin(e.target.value)}
          />
          <Input
            label="Hardiness Zone Max"
            type="number"
            min={1}
            max={13}
            placeholder="e.g. 9"
            value={hardinessZoneMax}
            onChange={(e) => setHardinessZoneMax(e.target.value)}
          />
        </div>

        <Textarea
          label="Description"
          placeholder="General information about this plant..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <Textarea
          label="Care Notes"
          placeholder="Watering, pruning, fertilizing tips..."
          value={careNotes}
          onChange={(e) => setCareNotes(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Plant"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
