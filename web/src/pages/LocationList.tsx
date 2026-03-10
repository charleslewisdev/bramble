import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Trash2, Search, CheckCircle, XCircle, Loader2, Gamepad2 } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PlantSprite from "../components/sprites/PlantSprite";
import { useToast } from "../components/ui/Toast";
import {
  useLocations,
  useCreateLocation,
  useDeleteLocation,
  useGeocode,
  useHardinessLookup,
} from "../api/hooks";

export default function LocationList() {
  const navigate = useNavigate();
  const { data: locations, isLoading } = useLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const geocode = useGeocode();
  const hardinessLookup = useHardinessLookup();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    hardinessZone: "",
    latitude: "",
    longitude: "",
  });
  const [geocodeResults, setGeocodeResults] = useState<
    { lat: number; lng: number; displayName: string }[] | null
  >(null);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [hardinessStatus, setHardinessStatus] = useState<"idle" | "success" | "error" | "loading">("idle");

  function resetForm() {
    setForm({ name: "", address: "", hardinessZone: "", latitude: "", longitude: "" });
    setGeocodeResults(null);
    setGeocodeStatus("idle");
    setHardinessStatus("idle");
  }

  function lookupHardiness(lat: number, lng: number) {
    setHardinessStatus("loading");
    hardinessLookup.mutate(
      { lat, lng },
      {
        onSuccess: (result) => {
          setForm((f) => ({ ...f, hardinessZone: result.zone }));
          setHardinessStatus("success");
        },
        onError: () => {
          setHardinessStatus("error");
        },
      },
    );
  }

  function selectGeoResult(r: { lat: number; lng: number; displayName: string }) {
    setForm((f) => ({
      ...f,
      latitude: String(r.lat),
      longitude: String(r.lng),
    }));
    setGeocodeResults(null);
    setGeocodeStatus("success");
    // Auto-lookup hardiness zone
    lookupHardiness(r.lat, r.lng);
  }

  function handleGeocode() {
    if (!form.address) return;
    setGeocodeStatus("loading");
    setHardinessStatus("idle");
    geocode.mutate(form.address, {
      onSuccess: (results) => {
        if (results.length === 0) {
          setGeocodeStatus("error");
          setGeocodeResults(null);
        } else if (results.length === 1) {
          selectGeoResult(results[0]!);
        } else {
          setGeocodeResults(results);
          setGeocodeStatus("idle"); // waiting for user to pick
        }
      },
      onError: () => {
        setGeocodeStatus("error");
        setGeocodeResults(null);
      },
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createLocation.mutate(
      {
        name: form.name,
        address: form.address || undefined,
        hardinessZone: form.hardinessZone || undefined,
        latitude: form.latitude ? Number(form.latitude) : 0,
        longitude: form.longitude ? Number(form.longitude) : 0,
      },
      {
        onSuccess: (loc) => {
          setShowAdd(false);
          resetForm();
          showToast("Location added!", "success");
          navigate(`/locations/${loc.id}`);
        },
        onError: (err) =>
          showToast(`Failed to add location: ${(err as Error).message}`, "error"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-stone-100">
            Locations
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Your properties and gardens
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Location
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <div className="space-y-3">
                <div className="h-5 w-40 bg-stone-800 rounded animate-pulse" />
                <div className="h-4 w-56 bg-stone-800 rounded animate-pulse" />
                <div className="h-3 w-24 bg-stone-800 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : locations && locations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <Card
              key={loc.id}
              hoverable
              onClick={() => navigate(`/locations/${loc.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10">
                    <MapPin size={20} className="text-sky-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-200 font-[family-name:var(--font-display)]">
                      {loc.name}
                    </h3>
                    {loc.address && (
                      <p className="text-sm text-stone-400 mt-0.5">
                        {loc.address}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-stone-500 font-[family-name:var(--font-mono)]">
                      {loc.hardinessZone && (
                        <span>Zone {loc.hardinessZone}</span>
                      )}
                      {loc.lotWidth && loc.lotDepth && (
                        <span>
                          {loc.lotWidth}x{loc.lotDepth} ft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {loc.lotWidth && loc.lotDepth && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/locations/${loc.id}/map`);
                      }}
                      className="p-1.5 rounded-lg text-stone-600 hover:text-emerald-400 hover:bg-stone-800 transition-colors"
                      title="Garden Map"
                    >
                      <Gamepad2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(loc.id);
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
        <Card className="text-center py-12">
          <PlantSprite type="tree" mood="new" size={64} className="mx-auto" />
          <p className="text-lg font-semibold text-stone-200 font-[family-name:var(--font-display)] mt-4">
            No locations yet. Where does your garden grow?
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Add your first property to start mapping your garden
          </p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Location
          </Button>
        </Card>
      )}

      {/* Add modal */}
      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title="Add Location"
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Home Garden"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          {/* Address + geocode */}
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Address"
                  placeholder="123 Garden St, Portland OR 97000"
                  value={form.address}
                  onChange={(e) => {
                    setForm({ ...form, address: e.target.value });
                    setGeocodeStatus("idle");
                    setGeocodeResults(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && form.address && !form.latitude) {
                      e.preventDefault();
                      handleGeocode();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGeocode}
                disabled={!form.address || geocode.isPending}
                className="mb-[1px]"
              >
                {geocode.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                Look up
              </Button>
            </div>

            {/* Geocode status indicator */}
            {geocodeStatus === "success" && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-[family-name:var(--font-mono)]">
                <CheckCircle size={14} />
                Coordinates found ({Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)})
              </div>
            )}
            {geocodeStatus === "error" && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-[family-name:var(--font-mono)]">
                <XCircle size={14} />
                Could not find coordinates for this address. Try adding city/state/zip, or enter coordinates manually.
              </div>
            )}

            {/* Multiple results picker */}
            {geocodeResults && geocodeResults.length > 1 && (
              <div className="border border-stone-700 rounded-lg p-2 space-y-1 bg-stone-900">
                <p className="text-xs text-stone-400 font-[family-name:var(--font-display)] mb-1">
                  Multiple matches found — select one:
                </p>
                {geocodeResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 transition-colors"
                    onClick={() => selectGeoResult(r)}
                  >
                    <span className="font-[family-name:var(--font-display)]">
                      {r.displayName}
                    </span>
                    <span className="text-xs text-stone-500 font-[family-name:var(--font-mono)] ml-2">
                      ({r.lat.toFixed(4)}, {r.lng.toFixed(4)})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              placeholder="45.5231"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              placeholder="-122.6765"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            />
          </div>

          {/* Hardiness zone with auto-detect status */}
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="USDA Hardiness Zone"
                  placeholder="e.g., 8b"
                  value={form.hardinessZone}
                  onChange={(e) => setForm({ ...form, hardinessZone: e.target.value })}
                />
              </div>
              {form.latitude && form.longitude && !form.hardinessZone && hardinessStatus !== "loading" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => lookupHardiness(Number(form.latitude), Number(form.longitude))}
                  className="mb-[1px]"
                >
                  <Search size={14} /> Detect
                </Button>
              )}
            </div>

            {hardinessStatus === "loading" && (
              <div className="flex items-center gap-2 text-stone-400 text-xs font-[family-name:var(--font-mono)]">
                <Loader2 size={14} className="animate-spin" />
                Looking up hardiness zone...
              </div>
            )}
            {hardinessStatus === "success" && form.hardinessZone && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-[family-name:var(--font-mono)]">
                <CheckCircle size={14} />
                Zone {form.hardinessZone} detected (via ZIP code — adjust if your area differs)
              </div>
            )}
            {hardinessStatus === "error" && (
              <div className="flex items-center gap-2 text-amber-400 text-xs font-[family-name:var(--font-mono)]">
                <XCircle size={14} />
                Could not auto-detect zone. You can enter it manually.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowAdd(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLocation.isPending || !form.name || (!form.latitude && !form.address)}
            >
              {createLocation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Location */}
      <ConfirmModal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            deleteLocation.mutate(confirmDeleteId, {
              onSuccess: () => showToast("Location deleted", "success"),
              onError: (err) =>
                showToast(`Failed: ${(err as Error).message}`, "error"),
            });
          }
        }}
        title="Delete Location"
        message="Are you sure you want to delete this location? All zones and structures will also be removed. Plants will be kept but unassigned."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
