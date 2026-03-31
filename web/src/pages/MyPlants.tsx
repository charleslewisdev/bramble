import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, X, Skull, MapPin, Pencil } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import ViewToggle from "../components/ui/ViewToggle";
import DataTable, { type ColumnDef } from "../components/ui/DataTable";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import StatusBadge from "../components/ui/StatusBadge";
import BulkEditModal from "../components/plants/BulkEditModal";
import { usePlantInstances, useLocations, useBulkUpdatePlantInstances } from "../api/hooks";
import { useTableState } from "../hooks/useTableState";
import type { PlantType, PlantInstance, PlantStatus } from "../api";

const activeStatusOptions: PlantStatus[] = [
  "planned",
  "planted",
  "established",
  "struggling",
  "dormant",
];

const GRAVEYARD_STATUSES: PlantStatus[] = ["dead", "removed"];

const statusOptions = [
  ...activeStatusOptions,
  ...GRAVEYARD_STATUSES,
].map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }));

const moodOptions = [
  "happy", "thirsty", "cold", "hot", "wilting", "sleeping", "new",
].map((m) => ({ label: m.charAt(0).toUpperCase() + m.slice(1), value: m }));

const boolOptions = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
];

export default function MyPlants() {
  const navigate = useNavigate();
  const { data: plants, isLoading } = usePlantInstances();
  const { data: locations } = useLocations();
  const bulkUpdate = useBulkUpdatePlantInstances();

  const [tableState, actions] = useTableState({ defaultSort: "name" });
  const { view, sort, sortDir, filters, visibleCols, colOrder, tab, statusFilter, locationFilter } = tableState;

  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const allPlants = plants ?? [];
  const gardenPlants = allPlants.filter((p) => !GRAVEYARD_STATUSES.includes(p.status));
  const graveyardPlants = allPlants.filter((p) => GRAVEYARD_STATUSES.includes(p.status));

  let filtered = tab === "garden" ? gardenPlants : graveyardPlants;

  if (statusFilter) {
    filtered = filtered.filter((p) => p.status === statusFilter);
  }
  if (locationFilter) {
    filtered = filtered.filter(
      (p) => p.zone && String((p.zone as { locationId?: number }).locationId) === locationFilter
    );
  }

  // Sort for grid view only (table handles its own sort)
  const gridSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const nameA = a.nickname ?? a.plantReference?.commonName ?? "";
      const nameB = b.nickname ?? b.plantReference?.commonName ?? "";
      return nameA.localeCompare(nameB);
    });
  }, [filtered]);

  // ─── Column definitions for table view ──────────────────────
  const zoneOptions = useMemo(() => {
    const zones = new Map<string, string>();
    allPlants.forEach((p) => {
      if (p.zone) zones.set(String(p.zone.id), p.zone.name);
    });
    return [...zones.entries()].map(([value, label]) => ({ value, label }));
  }, [allPlants]);

  const columns = useMemo<ColumnDef<PlantInstance>[]>(() => [
    {
      key: "name",
      label: "Name",
      sortable: true,
      filterable: true,
      minWidth: 180,
      accessor: (row) => row.nickname ?? row.plantReference?.commonName ?? "",
      render: (row) => (
        <div className="flex items-center gap-2">
          <PlantSprite
            type={(row.plantReference?.plantType as PlantType) ?? "flower"}
            mood={row.mood}
            size={28}
            showOverlay={false}
          />
          <div className="min-w-0">
            <span className="text-stone-200 font-display text-sm truncate block">
              {row.nickname ?? row.plantReference?.commonName ?? "Plant"}
            </span>
            {row.nickname && row.plantReference?.commonName && (
              <span className="text-stone-500 text-[10px] truncate block">
                {row.plantReference.commonName}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "latinName",
      label: "Latin Name",
      sortable: true,
      filterable: true,
      minWidth: 150,
      defaultVisible: false,
      accessor: (row) => row.plantReference?.latinName ?? "",
      render: (row) => (
        <span className="italic text-stone-400">
          {row.plantReference?.latinName ?? "—"}
        </span>
      ),
    },
    {
      key: "cultivar",
      label: "Cultivar",
      sortable: true,
      filterable: true,
      minWidth: 120,
      defaultVisible: false,
      accessor: (row) => row.plantReference?.cultivar ?? "",
      render: (row) => row.plantReference?.cultivar ?? "—",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterable: true,
      filterOptions: statusOptions,
      minWidth: 110,
      accessor: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "mood",
      label: "Mood",
      sortable: true,
      filterable: true,
      filterOptions: moodOptions,
      minWidth: 120,
      accessor: (row) => row.mood,
      render: (row) => (
        <span className="text-stone-400 italic">
          {getMoodMessage(row.mood, row.nickname ?? undefined)}
        </span>
      ),
    },
    {
      key: "zone",
      label: "Zone",
      sortable: true,
      filterable: true,
      filterOptions: zoneOptions,
      minWidth: 130,
      accessor: (row) => row.zone?.name ?? "",
      render: (row) =>
        row.zone ? (
          <span className="text-stone-300">{row.zone.name}</span>
        ) : (
          <span className="flex items-center gap-1 text-stone-600">
            <MapPin size={10} /> No zone
          </span>
        ),
    },
    {
      key: "plantType",
      label: "Type",
      sortable: true,
      filterable: true,
      filterOptions: [
        "flower", "shrub", "tree", "herb", "grass", "fern", "succulent",
        "cactus", "vine", "bulb", "vegetable", "fruit", "houseplant", "groundcover",
      ].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t })),
      minWidth: 100,
      accessor: (row) => row.plantReference?.plantType ?? "",
      render: (row) => (
        <span className="capitalize">{row.plantReference?.plantType ?? "—"}</span>
      ),
    },
    {
      key: "sunRequirement",
      label: "Sun",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Full Sun", value: "full_sun" },
        { label: "Partial Sun", value: "partial_sun" },
        { label: "Partial Shade", value: "partial_shade" },
        { label: "Full Shade", value: "full_shade" },
      ],
      minWidth: 110,
      accessor: (row) => row.plantReference?.sunRequirement ?? "",
      render: (row) => (
        <span className="capitalize">
          {row.plantReference?.sunRequirement?.replace("_", " ") ?? "—"}
        </span>
      ),
    },
    {
      key: "waterNeeds",
      label: "Water",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Low", value: "low" },
        { label: "Moderate", value: "moderate" },
        { label: "High", value: "high" },
        { label: "Aquatic", value: "aquatic" },
      ],
      minWidth: 90,
      accessor: (row) => row.plantReference?.waterNeeds ?? "",
      render: (row) => (
        <span className="capitalize">{row.plantReference?.waterNeeds ?? "—"}</span>
      ),
    },
    {
      key: "isContainer",
      label: "Container",
      sortable: true,
      filterable: true,
      filterOptions: boolOptions,
      minWidth: 90,
      accessor: (row) => row.isContainer ? "true" : "false",
      render: (row) => (row.isContainer ? "Yes" : "No"),
    },
    {
      key: "containerMaterial",
      label: "Material",
      sortable: true,
      filterable: true,
      minWidth: 100,
      defaultVisible: false,
      accessor: (row) => row.containerMaterial ?? "",
      render: (row) => (
        <span className="capitalize">{row.containerMaterial ?? "—"}</span>
      ),
    },
    {
      key: "datePlanted",
      label: "Planted",
      sortable: true,
      minWidth: 100,
      accessor: (row) => row.datePlanted ?? "",
      render: (row) =>
        row.datePlanted
          ? new Date(row.datePlanted).toLocaleDateString()
          : "—",
    },
    {
      key: "createdAt",
      label: "Added",
      sortable: true,
      minWidth: 100,
      defaultVisible: false,
      accessor: (row) => row.createdAt,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: "toxicityDogs",
      label: "Dogs",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Safe", value: "safe" },
        { label: "Caution", value: "caution" },
        { label: "Toxic", value: "toxic" },
        { label: "Highly Toxic", value: "highly_toxic" },
      ],
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.plantReference?.toxicityDogs ?? "",
      render: (row) => (
        <span className="capitalize">{row.plantReference?.toxicityDogs ?? "—"}</span>
      ),
    },
    {
      key: "toxicityCats",
      label: "Cats",
      sortable: true,
      filterable: true,
      filterOptions: [
        { label: "Safe", value: "safe" },
        { label: "Caution", value: "caution" },
        { label: "Toxic", value: "toxic" },
        { label: "Highly Toxic", value: "highly_toxic" },
      ],
      minWidth: 80,
      defaultVisible: false,
      accessor: (row) => row.plantReference?.toxicityCats ?? "",
      render: (row) => (
        <span className="capitalize">{row.plantReference?.toxicityCats ?? "—"}</span>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      filterable: true,
      minWidth: 200,
      defaultVisible: false,
      accessor: (row) => row.notes ?? "",
      render: (row) => (
        <span className="text-stone-400 truncate block max-w-[200px]">
          {row.notes ?? "—"}
        </span>
      ),
    },
  ], [zoneOptions]);

  async function handleBulkEdit(data: Partial<PlantInstance>) {
    const ids = [...selectedIds].map(Number);
    try {
      await bulkUpdate.mutateAsync({ ids, data });
      setSelectedIds(new Set());
      setShowBulkEdit(false);
    } catch {
      // Error surfaced by TanStack Query
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">
            My Plants
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {gardenPlants.length} plant{gardenPlants.length !== 1 ? "s" : ""} in your garden
            {graveyardPlants.length > 0 && (
              <span className="text-stone-600"> · {graveyardPlants.length} in the graveyard</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={actions.setView} />
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-800">
        <button
          onClick={() => { actions.setTab("garden"); actions.setStatusFilter(""); setSelectedIds(new Set()); }}
          className={`px-4 py-2 text-sm font-display transition-colors border-b-2 -mb-px ${
            tab === "garden"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-stone-500 hover:text-stone-300"
          }`}
        >
          My Garden
          {gardenPlants.length > 0 && (
            <span className="ml-2 text-xs font-mono text-stone-500">{gardenPlants.length}</span>
          )}
        </button>
        <button
          onClick={() => { actions.setTab("graveyard"); actions.setStatusFilter(""); setSelectedIds(new Set()); }}
          className={`px-4 py-2 text-sm font-display transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            tab === "graveyard"
              ? "border-stone-500 text-stone-300"
              : "border-transparent text-stone-600 hover:text-stone-400"
          }`}
        >
          <Skull size={13} />
          Graveyard
          {graveyardPlants.length > 0 && (
            <span className="text-xs font-mono text-stone-600">{graveyardPlants.length}</span>
          )}
        </button>
      </div>

      {view === "grid" && showFilters && (
        <Card className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => actions.setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {(tab === "garden" ? activeStatusOptions : GRAVEYARD_STATUSES).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
          <Select
            label="Location"
            value={locationFilter}
            onChange={(e) => actions.setLocationFilter(e.target.value)}
          >
            <option value="">All Locations</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded bg-stone-800 animate-pulse" />
                <div className="h-4 w-20 mx-auto bg-stone-800 rounded animate-pulse" />
                <div className="h-3 w-16 mx-auto bg-stone-800 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : view === "table" ? (
        <DataTable<PlantInstance>
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/my-plants/${r.id}`)}
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
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          selectionActions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowBulkEdit(true)}
            >
              <Pencil size={14} />
              Edit Selected
            </Button>
          }
          emptyMessage={
            tab === "garden"
              ? "No plants in your garden yet"
              : "Nothing in the graveyard — that's a good thing!"
          }
        />
      ) : gridSorted.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {gridSorted.map((plant) => (
            <Card
              key={plant.id}
              hoverable
              onClick={() => navigate(`/my-plants/${plant.id}`)}
              className="text-center py-4"
            >
              <PlantSprite
                type={
                  (plant.plantReference?.plantType as PlantType) ?? "flower"
                }
                mood={plant.mood}
                size={56}
              />
              <p className="text-sm font-medium text-stone-200 mt-2 font-display truncate px-1">
                {plant.nickname ??
                  plant.plantReference?.commonName ??
                  "Plant"}
              </p>
              <div className="mt-1">
                <StatusBadge status={plant.status} />
              </div>
              {plant.zone ? (
                <p className="text-xs text-stone-500 mt-1 font-mono">
                  {plant.zone.name}
                </p>
              ) : tab === "garden" ? (
                <p className="flex items-center justify-center gap-1 text-xs text-stone-600 mt-1 font-mono">
                  <MapPin size={10} /> No zone
                </p>
              ) : null}
              <p className="text-xs text-stone-400 mt-1.5 font-mono italic px-2">
                {getMoodMessage(plant.mood, plant.nickname ?? undefined)}
              </p>
            </Card>
          ))}
        </div>
      ) : tab === "garden" ? (
        <Card className="text-center py-12">
          <PlantSprite type="flower" mood="new" size={64} className="mx-auto" />
          <p className="text-lg font-semibold text-stone-200 font-display mt-4">
            Your garden is empty! Time to get planting.
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Browse the plant database and add some to your zones!
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate("/plants")}
          >
            Browse Plants
          </Button>
        </Card>
      ) : (
        <Card className="text-center py-12">
          <PlantSprite type="flower" mood="happy" size={64} className="mx-auto" />
          <p className="text-lg font-semibold text-stone-200 font-display mt-4">
            Nothing here — and that's a good thing.
          </p>
          <p className="text-stone-400 text-sm mt-1">
            No plants have been marked as dead or removed. Keep it up!
          </p>
        </Card>
      )}

      <BulkEditModal
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedCount={selectedIds.size}
        onSubmit={handleBulkEdit}
        isPending={bulkUpdate.isPending}
      />
    </div>
  );
}
