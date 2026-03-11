import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, X, Sprout } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import StatusBadge from "../components/ui/StatusBadge";
import { usePlantInstances, useLocations } from "../api/hooks";
import type { PlantType, PlantStatus } from "../api";

const statusOptions: PlantStatus[] = [
  "planned",
  "planted",
  "established",
  "struggling",
  "dormant",
  "dead",
  "removed",
];

type SortKey = "name" | "date" | "status";

export default function MyPlants() {
  const navigate = useNavigate();
  const { data: plants, isLoading } = usePlantInstances();
  const { data: locations } = useLocations();

  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");

  let filtered = plants ?? [];

  if (statusFilter) {
    filtered = filtered.filter((p) => p.status === statusFilter);
  }
  if (locationFilter) {
    filtered = filtered.filter(
      (p) => p.zone && String((p.zone as { locationId?: number }).locationId) === locationFilter
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "name": {
        const nameA =
          a.nickname ?? a.plantReference?.commonName ?? "";
        const nameB =
          b.nickname ?? b.plantReference?.commonName ?? "";
        return nameA.localeCompare(nameB);
      }
      case "date":
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      case "status":
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">
            My Plants
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {plants?.length ?? 0} plants in your garden
          </p>
        </div>
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
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
          <Select
            label="Location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All Locations</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="name">Name</option>
            <option value="date">Date Added</option>
            <option value="status">Status</option>
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
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((plant) => (
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
              {plant.zone && (
                <p className="text-xs text-stone-500 mt-1 font-mono">
                  {plant.zone.name}
                </p>
              )}
              <p className="text-xs text-stone-400 mt-1.5 font-mono italic px-2">
                {getMoodMessage(plant.mood, plant.nickname ?? undefined)}
              </p>
            </Card>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}
