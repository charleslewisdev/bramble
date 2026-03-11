import { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import PlantSprite from "../components/sprites/PlantSprite";
import {
  useShoppingList,
  useCreateShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearCheckedItems,
} from "../api/hooks";
import type { PlantType } from "../api";

export default function ShoppingList() {
  const { data: items, isLoading } = useShoppingList();
  const createItem = useCreateShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    quantity: "1",
    notes: "",
  });

  const unchecked = items?.filter((i) => !i.isChecked) ?? [];
  const checked = items?.filter((i) => i.isChecked) ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createItem.mutate(
      {
        name: form.name,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setForm({ name: "", quantity: "1", notes: "" });
          setShowAdd(false);
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">
            Shopping List
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {unchecked.length} item{unchecked.length !== 1 ? "s" : ""} to get
          </p>
        </div>
        <div className="flex gap-2">
          {checked.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearChecked.mutate()}
            >
              <X size={14} /> Clear Done
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Item
          </Button>
        </div>
      </div>

      {/* Quick add inline form */}
      {showAdd && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Item name..."
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  placeholder="Qty"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </div>
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={createItem.isPending}
              >
                Add
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-stone-800 animate-pulse" />
                <div className="h-4 w-40 bg-stone-800 rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-1">
          {/* Unchecked items */}
          {unchecked.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800/60 transition-colors group"
            >
              <button
                onClick={() => toggleItem.mutate(item.id)}
                aria-label={`Mark ${item.name} as done`}
                className="w-5 h-5 rounded border-2 border-stone-600 hover:border-emerald-500 transition-colors shrink-0"
              />
              {item.plantReference && (
                <PlantSprite
                  type={item.plantReference.plantType as PlantType}
                  mood="happy"
                  size={24}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-200 font-display">
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-stone-500 font-mono ml-2">
                      x{item.quantity}
                    </span>
                  )}
                </p>
                {item.notes && (
                  <p className="text-xs text-stone-500 truncate">
                    {item.notes}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteItem.mutate(item.id)}
                className="p-1 rounded text-stone-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Checked items */}
          {checked.length > 0 && (
            <div className="pt-3">
              <p className="text-xs text-stone-600 font-display mb-2 uppercase tracking-wider">
                Done
              </p>
              {checked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg group opacity-50 hover:opacity-70 transition-opacity"
                >
                  <button
                    onClick={() => toggleItem.mutate(item.id)}
                    aria-label={`Uncheck ${item.name}`}
                    className="w-5 h-5 rounded border-2 border-emerald-600 bg-emerald-600/20 flex items-center justify-center shrink-0"
                  >
                    <svg
                      width={10}
                      height={10}
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M2 5l2 2 4-4"
                        stroke="#34d399"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <p className="text-sm text-stone-500 line-through font-display flex-1">
                    {item.name}
                    {item.quantity > 1 && (
                      <span className="ml-2">x{item.quantity}</span>
                    )}
                  </p>
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    className="p-1 rounded text-stone-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="text-center py-12">
          <PlantSprite type="succulent" mood="happy" size={64} className="mx-auto" />
          <p className="text-lg font-semibold text-stone-200 font-display mt-4">
            List is empty. Your garden has everything it needs!
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Add items from the plant browser or manually
          </p>
        </Card>
      )}
    </div>
  );
}
