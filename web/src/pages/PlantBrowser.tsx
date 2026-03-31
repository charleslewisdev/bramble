import { useState, useMemo, type FormEvent } from "react";
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
import ViewToggle from "../components/ui/ViewToggle";
import DataTable, { type ColumnDef } from "../components/ui/DataTable";
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
import { useTableState } from "../hooks/useTableState";
import type { PlantType, SafetyLevel, PlantReference } from "../api";

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

const plantTypeOptions = [
  "flower", "shrub", "tree", "herb", "grass", "fern", "succulent",
  "cactus", "vine", "bulb", "vegetable", "fruit", "houseplant", "groundcover", "aquatic",
].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }));

const sunOptions = [
  { label: "Full Sun", value: "full_sun" },
  { label: "Partial Sun", value: "partial_sun" },
  { label: "Partial Shade", value: "partial_shade" },
  { label: "Full Shade", value: "full_shade" },
];

const waterOptions = [
  { label: "Low", value: "low" },
  { label: "Moderate", value: "moderate" },
  { label: "High", value: "high" },
  { label: "Aquatic", value: "aquatic" },
];

const toxicityOptions = [
  { label: "Safe", value: "safe" },
  { label: "Caution", value: "caution" },
  { label: "Toxic", value: "toxic" },
  { label: "Highly Toxic", value: "highly_toxic" },
];

const boolOptions = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
];

const lifecycleOptions = [
  { label: "Annual", value: "annual" },
  { label: "Biennial", value: "biennial" },
  { label: "Perennial", value: "perennial" },
  { label: "Tender Perennial", value: "tender_perennial" },
];

export default function PlantBrowser() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tableState, actions] = useTableState({ defaultSort: "commonName" });
  const { view, sort, sortDir, filters, visibleCols, colOrder } = tableState;

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

  function handleSearchChange(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set("search", value);
      } else {
        next.delete("search");
      }
      return next;
    }, { replace: true });
  }

  // ─── Column definitions for table view ──────────────────────
  const columns = useMemo<ColumnDef<PlantReference>[]>(() => [
    {
      key: "commonName",
      label: "Name",
      sortable: true,
      filterable: true,
      minWidth: 180,
      accessor: (row) => row.commonName,
      render: (row) => (
        <div className="flex items-center gap-2">
          <PlantSprite
            type={(row.plantType as PlantType) ?? "flower"}
            mood="happy"
            size={28}
            showOverlay={false}
          />
          <span className="text-stone-200 font-display text-sm">
            {row.commonName}
          </span>
        </div>
      ),
    },
    {
      key: "latinName",
      label: "Latin Name",
      sortable: true,
      filterable: true,
      minWidth: 160,
      accessor: (row) => row.latinName ?? "",
      render: (row) => (
        <span className="italic text-stone-400">{row.latinName ?? "—"}</span>
      ),
    },
    {
      key: "cultivar",
      label: "Cultivar",
      sortable: true,
      filterable: true,
      minWidth: 120,
      accessor: (row) => row.cultivar ?? "",
      render: (row) => row.cultivar ?? "—",
    },
    {
      key: "plantType",
      label: "Type",
      sortable: true,
      filterable: true,
      filterOptions: plantTypeOptions,
      minWidth: 100,
      accessor: (row) => row.plantType ?? "",
      render: (row) => (
        <span className="capitalize">{row.plantType ?? "—"}</span>
      ),
    },
    {
      key: "lifecycle",
      label: "Lifecycle",
      sortable: true,
      filterable: true,
      filterOptions: lifecycleOptions,
      minWidth: 110,
      accessor: (row) => row.lifecycle ?? "",
      render: (row) => (
        <span className="capitalize">{row.lifecycle?.replace("_", " ") ?? "—"}</span>
      ),
    },
    {
      key: "sunRequirement",
      label: "Sun",
      sortable: true,
      filterable: true,
      filterOptions: sunOptions,
      minWidth: 110,
      accessor: (row) => row.sunRequirement ?? "",
      render: (row) => (
        <span className="capitalize">
          {row.sunRequirement?.replace("_", " ") ?? "—"}
        </span>
      ),
    },
    {
      key: "waterNeeds",
      label: "Water",
      sortable: true,
      filterable: true,
      filterOptions: waterOptions,
      minWidth: 90,
      accessor: (row) => row.waterNeeds ?? "",
      render: (row) => (
        <span className="capitalize">{row.waterNeeds ?? "—"}</span>
      ),
    },
    {
      key: "matureHeight",
      label: "Height",
      sortable: true,
      minWidth: 90,
      accessor: (row) => row.matureHeight ?? "",
      render: (row) => row.matureHeight ?? "—",
    },
    {
      key: "matureSpread",
      label: "Spread",
      sortable: true,
      minWidth: 90,
      accessor: (row) => row.matureSpread ?? "",
      render: (row) => row.matureSpread ?? "—",
    },
    {
      key: "bloomTime",
      label: "Bloom Time",
      sortable: true,
      filterable: true,
      minWidth: 100,
      defaultVisible: false,
      accessor: (row) => row.bloomTime ?? "",
      render: (row) => row.bloomTime ?? "—",
    },
    {
      key: "bloomColor",
      label: "Bloom Color",
      sortable: true,
      filterable: true,
      minWidth: 100,
      defaultVisible: false,
      accessor: (row) => row.bloomColor ?? "",
      render: (row) => row.bloomColor ?? "—",
    },
    {
      key: "hardinessZone",
      label: "Hardiness",
      sortable: true,
      filterable: true,
      minWidth: 90,
      accessor: (row) => {
        const min = row.hardinessZoneMin;
        const max = row.hardinessZoneMax;
        if (min != null && max != null) return `${min}-${max}`;
        if (min != null) return String(min);
        if (max != null) return String(max);
        return "";
      },
      render: (row) => {
        const min = row.hardinessZoneMin;
        const max = row.hardinessZoneMax;
        if (min != null && max != null) return `${min}–${max}`;
        if (min != null) return String(min);
        if (max != null) return String(max);
        return "—";
      },
    },
    {
      key: "tempRange",
      label: "Temp (°F)",
      sortable: true,
      minWidth: 100,
      accessor: (row) => row.minTempF ?? 999,
      render: (row) => {
        const min = row.minTempF;
        const max = row.maxTempF;
        if (min != null && max != null) return `${min}–${max}°F`;
        if (min != null) return `${min}°F+`;
        if (max != null) return `≤${max}°F`;
        return "—";
      },
    },
    {
      key: "growthRate",
      label: "Growth",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Slow", value: "slow" },
        { label: "Moderate", value: "moderate" },
        { label: "Fast", value: "fast" },
      ],
      minWidth: 90,
      defaultVisible: false,
      accessor: (row) => row.growthRate ?? "",
      render: (row) => (
        <span className="capitalize">{row.growthRate ?? "—"}</span>
      ),
    },
    {
      key: "foliageType",
      label: "Foliage",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Evergreen", value: "evergreen" },
        { label: "Deciduous", value: "deciduous" },
        { label: "Semi-evergreen", value: "semi-evergreen" },
      ],
      minWidth: 100,
      defaultVisible: false,
      accessor: (row) => row.foliageType ?? "",
      render: (row) => (
        <span className="capitalize">{row.foliageType?.replace("-", "-") ?? "—"}</span>
      ),
    },
    {
      key: "soilPreference",
      label: "Soil",
      sortable: true,
      filterable: true,
      minWidth: 120,
      defaultVisible: false,
      accessor: (row) => row.soilPreference ?? "",
      render: (row) => row.soilPreference ?? "—",
    },
    {
      key: "toxicityDogs",
      label: "Dogs",
      sortable: true,
      filterable: true,
      filterOptions: toxicityOptions,
      minWidth: 80,
      accessor: (row) => row.toxicityDogs ?? "",
      render: (row) =>
        row.toxicityDogs ? (
          <SafetyBadge level={row.toxicityDogs} for="dogs" />
        ) : (
          "—"
        ),
    },
    {
      key: "toxicityCats",
      label: "Cats",
      sortable: true,
      filterable: true,
      filterOptions: toxicityOptions,
      minWidth: 80,
      accessor: (row) => row.toxicityCats ?? "",
      render: (row) =>
        row.toxicityCats ? (
          <SafetyBadge level={row.toxicityCats} for="cats" />
        ) : (
          "—"
        ),
    },
    {
      key: "toxicityChildren",
      label: "Kids",
      sortable: true,
      filterable: true,
      filterOptions: toxicityOptions,
      minWidth: 80,
      accessor: (row) => row.toxicityChildren ?? "",
      render: (row) =>
        row.toxicityChildren ? (
          <SafetyBadge level={row.toxicityChildren} for="children" />
        ) : (
          "—"
        ),
    },
    {
      key: "droughtTolerant",
      label: "Drought",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.droughtTolerant ? "true" : "false",
      render: (row) => (row.droughtTolerant ? "Yes" : "—"),
    },
    {
      key: "deerResistant",
      label: "Deer",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.deerResistant ? "true" : "false",
      render: (row) => (row.deerResistant ? "Yes" : "—"),
    },
    {
      key: "attractsPollinators",
      label: "Pollinators",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 90,
      defaultVisible: false,
      accessor: (row) => row.attractsPollinators ? "true" : "false",
      render: (row) => (row.attractsPollinators ? "Yes" : "—"),
    },
    {
      key: "attractsBirds",
      label: "Birds",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.attractsBirds ? "true" : "false",
      render: (row) => (row.attractsBirds ? "Yes" : "—"),
    },
    {
      key: "attractsButterflies",
      label: "Butterflies",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 90,
      defaultVisible: false,
      accessor: (row) => row.attractsButterflies ? "true" : "false",
      render: (row) => (row.attractsButterflies ? "Yes" : "—"),
    },
    {
      key: "containerSuitable",
      label: "Container OK",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 90,
      defaultVisible: false,
      accessor: (row) => row.containerSuitable ? "true" : "false",
      render: (row) => (row.containerSuitable ? "Yes" : "—"),
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      filterable: true,
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.source ?? "",
      render: (row) => (
        <span className="capitalize">{row.source ?? "—"}</span>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100">
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
              className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-9 pr-3 py-2 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors font-display"
              placeholder="Search plants (local + online)..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <ViewToggle value={view} onChange={actions.setView} />
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Add Plant
          </Button>
          {view === "grid" && (
            <Button
              variant={showFilters ? "primary" : "secondary"}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? <X size={16} /> : <Filter size={16} />}
              Filters
            </Button>
          )}
        </div>

        {view === "grid" && showFilters && (
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

      {/* Table View */}
      {view === "table" && !isLoading && (
        <DataTable<PlantReference>
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/plants/${r.id}`)}
          sort={sort}
          sortDir={sortDir}
          onSort={actions.toggleSort}
          filters={filters}
          onFilterChange={actions.setFilter}
          onClearFilters={actions.clearAllFilters}
          visibleCols={visibleCols}
          onVisibleColsChange={actions.setVisibleCols}
          colOrder={colOrder}
          onColOrderChange={actions.setColOrder}
          emptyMessage="No plants found"
        />
      )}

      {/* Grid View — Local Results */}
      {view === "grid" && (
        <>
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
                        <h3 className="font-semibold text-stone-200 font-display truncate">
                          {plant.commonName}
                        </h3>
                        {plant.latinName && (
                          <p className="text-xs text-stone-500 italic font-mono truncate">
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
                        className="text-xs text-stone-400 hover:text-emerald-400 font-display flex items-center gap-1 transition-colors"
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
              <p className="text-lg font-semibold text-stone-200 font-display mt-4">
                Browse the plant database
              </p>
              <p className="text-stone-400 text-sm mt-1">
                Start typing to search local plants
                {apiAvailable ? " and discover new ones online" : ""}
              </p>
            </Card>
          ) : null}
        </>
      )}

      {/* API Results (grid view only) */}
      {view === "grid" && search && hasApiResults && (
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
                    <h3 className="font-semibold text-stone-200 font-display truncate">
                      {result.commonName}
                    </h3>
                    {result.latinName && (
                      <p className="text-xs text-stone-500 italic font-mono truncate">
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
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-display flex items-center gap-1 transition-colors disabled:opacity-50"
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
      {view === "grid" && search && search.length >= 2 && isSearching && !hasApiResults && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Globe size={14} className="animate-pulse" />
          Searching online databases...
        </div>
      )}

      {/* No results at all (grid view) */}
      {view === "grid" &&
        search &&
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
            <p className="text-lg font-semibold text-stone-200 font-display mt-4">
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
        plantType: plantType as PlantReference["plantType"],
        sunRequirement: (sunRequirement || null) as PlantReference["sunRequirement"],
        waterNeeds: (waterNeeds || null) as PlantReference["waterNeeds"],
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
