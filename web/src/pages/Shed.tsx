import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  Leaf,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Textarea, Select } from "../components/ui/Input";
import {
  useFertilizers,
  useCreateFertilizer,
  useUpdateFertilizer,
  useDeleteFertilizer,
} from "../api/hooks";
import type { Fertilizer } from "../api";

const FERTILIZER_TYPES = [
  { value: "liquid", label: "Liquid" },
  { value: "granular", label: "Granular" },
  { value: "slow_release", label: "Slow Release" },
  { value: "compost", label: "Compost" },
  { value: "compost_tea", label: "Compost Tea" },
  { value: "fish_emulsion", label: "Fish Emulsion" },
  { value: "other", label: "Other" },
] as const;

const STATUS_OPTIONS = [
  { value: "have_it", label: "Have It" },
  { value: "running_low", label: "Running Low" },
  { value: "out", label: "Out" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  have_it: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40",
  running_low: "bg-amber-600/20 text-amber-400 border-amber-600/40",
  out: "bg-red-600/20 text-red-400 border-red-600/40",
};

const TYPE_COLORS: Record<string, string> = {
  liquid: "bg-sky-600/20 text-sky-400",
  granular: "bg-orange-600/20 text-orange-400",
  slow_release: "bg-violet-600/20 text-violet-400",
  compost: "bg-amber-700/20 text-amber-500",
  compost_tea: "bg-lime-600/20 text-lime-400",
  fish_emulsion: "bg-cyan-600/20 text-cyan-400",
  other: "bg-stone-600/20 text-stone-400",
};

interface FertilizerForm {
  name: string;
  type: string;
  npkN: string;
  npkP: string;
  npkK: string;
  organic: boolean;
  status: string;
  notes: string;
}

const EMPTY_FORM: FertilizerForm = {
  name: "",
  type: "granular",
  npkN: "",
  npkP: "",
  npkK: "",
  organic: false,
  status: "have_it",
  notes: "",
};

function formToPayload(form: FertilizerForm): Partial<Fertilizer> {
  return {
    name: form.name,
    type: form.type as Fertilizer["type"],
    npkN: form.npkN ? Number(form.npkN) : null,
    npkP: form.npkP ? Number(form.npkP) : null,
    npkK: form.npkK ? Number(form.npkK) : null,
    organic: form.organic,
    status: form.status as Fertilizer["status"],
    notes: form.notes || null,
  };
}

function fertilizerToForm(f: Fertilizer): FertilizerForm {
  return {
    name: f.name,
    type: f.type,
    npkN: f.npkN != null ? String(f.npkN) : "",
    npkP: f.npkP != null ? String(f.npkP) : "",
    npkK: f.npkK != null ? String(f.npkK) : "",
    organic: f.organic,
    status: f.status,
    notes: f.notes ?? "",
  };
}

export default function Shed() {
  const { id } = useParams<{ id: string }>();
  const locationId = Number(id);

  const { data: fertilizers, isLoading } = useFertilizers(locationId);
  const createFertilizer = useCreateFertilizer(locationId);
  const updateFertilizer = useUpdateFertilizer(locationId);
  const deleteFertilizer = useDeleteFertilizer(locationId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FertilizerForm>(EMPTY_FORM);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(f: Fertilizer) {
    setEditingId(f.id);
    setForm(fertilizerToForm(f));
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = formToPayload(form);

    if (editingId !== null) {
      updateFertilizer.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            setShowForm(false);
            setEditingId(null);
          },
        },
      );
    } else {
      createFertilizer.mutate(payload, {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
        },
      });
    }
  }

  function handleDelete(fertId: number) {
    deleteFertilizer.mutate(fertId);
  }

  function formatNpk(f: Fertilizer): string | null {
    if (f.npkN == null && f.npkP == null && f.npkK == null) return null;
    return `${f.npkN ?? 0}-${f.npkP ?? 0}-${f.npkK ?? 0}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Warehouse size={24} className="text-emerald-400" />
            <h1 className="text-2xl font-bold font-display text-stone-100">
              Shed
            </h1>
          </div>
          <p className="text-stone-400 text-sm mt-1">
            {fertilizers?.length ?? 0} fertilizer{fertilizers?.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> Add Fertilizer
        </Button>
      </div>

      {/* Tab header */}
      <div className="border-b border-stone-800">
        <button className="px-4 py-2 text-sm font-display font-medium text-emerald-400 border-b-2 border-emerald-400">
          Fertilizers
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Name"
                  placeholder="e.g. Fish Fertilizer 5-1-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="w-44">
                <Select
                  label="Type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {FERTILIZER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <div className="w-20">
                <Input
                  label="N"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="N"
                  value={form.npkN}
                  onChange={(e) => setForm({ ...form, npkN: e.target.value })}
                />
              </div>
              <span className="text-stone-500 pb-2 font-mono">-</span>
              <div className="w-20">
                <Input
                  label="P"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="P"
                  value={form.npkP}
                  onChange={(e) => setForm({ ...form, npkP: e.target.value })}
                />
              </div>
              <span className="text-stone-500 pb-2 font-mono">-</span>
              <div className="w-20">
                <Input
                  label="K"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="K"
                  value={form.npkK}
                  onChange={(e) => setForm({ ...form, npkK: e.target.value })}
                />
              </div>

              <div className="w-40">
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.organic}
                  onChange={(e) =>
                    setForm({ ...form, organic: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span className="text-sm text-stone-300 font-display">
                  Organic
                </span>
              </label>
            </div>

            <Textarea
              label="Notes"
              placeholder="Application tips, dilution ratios, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={
                  createFertilizer.isPending || updateFertilizer.isPending
                }
              >
                {editingId !== null ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <div className="h-5 w-32 bg-stone-800 rounded animate-pulse" />
                <div className="h-5 w-20 bg-stone-800 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : fertilizers && fertilizers.length > 0 ? (
        <div className="space-y-2">
          {fertilizers.map((f) => {
            const npk = formatNpk(f);
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 px-4 py-3 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-display font-semibold text-stone-200">
                      {f.name}
                    </p>
                    {/* Type badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono ${TYPE_COLORS[f.type] ?? TYPE_COLORS.other}`}
                    >
                      {FERTILIZER_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                    </span>
                    {/* NPK */}
                    {npk && (
                      <span className="text-xs font-mono text-stone-400">
                        {npk}
                      </span>
                    )}
                    {/* Organic badge */}
                    {f.organic && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 font-mono">
                        <Leaf size={10} />
                        organic
                      </span>
                    )}
                  </div>
                  {f.notes && (
                    <p className="text-xs text-stone-500 mt-1 truncate">
                      {f.notes}
                    </p>
                  )}
                </div>

                {/* Status pill */}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-mono shrink-0 ${STATUS_COLORS[f.status] ?? ""}`}
                >
                  {STATUS_OPTIONS.find((s) => s.value === f.status)?.label ?? f.status}
                </span>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(f)}
                    className="p-1.5 rounded text-stone-500 hover:text-stone-200 transition-colors"
                    aria-label={`Edit ${f.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="p-1.5 rounded text-stone-600 hover:text-red-400 transition-colors"
                    aria-label={`Delete ${f.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Warehouse size={48} className="mx-auto text-stone-600" />
          <p className="text-lg font-semibold text-stone-200 font-display mt-4">
            Your shed is empty
          </p>
          <p className="text-stone-400 text-sm mt-1 max-w-md mx-auto">
            Add fertilizers you own to get reminders when plants need feeding.
          </p>
        </Card>
      )}
    </div>
  );
}
