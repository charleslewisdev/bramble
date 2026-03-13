import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import Button from "./ui/Button";
import { useFertilizers, useCreateShoppingItem } from "../api/hooks";
import { useToast } from "./ui/Toast";

interface FertilizerNudgeProps {
  fertilizerType: string;
  locationId: number;
  plantName: string;
  fertilizerNotes: string | null;
}

export default function FertilizerNudge({
  fertilizerType,
  locationId,
  plantName,
  fertilizerNotes,
}: FertilizerNudgeProps) {
  const { data: fertilizers } = useFertilizers(locationId);
  const createItem = useCreateShoppingItem();
  const { showToast } = useToast();
  const [added, setAdded] = useState(false);

  // Still loading or user has a matching fertilizer in stock
  if (!fertilizers) return null;
  const hasMatch = fertilizers.some(
    (f) => f.type === fertilizerType && f.status !== "out",
  );
  if (hasMatch || added) return null;

  const displayType = fertilizerType.replace(/_/g, " ");

  function handleAdd() {
    createItem.mutate(
      {
        name: `${plantName} — ${displayType} fertilizer`,
        category: "fertilizer",
        notes: fertilizerNotes ?? undefined,
      },
      {
        onSuccess: () => {
          setAdded(true);
          showToast("Added to shopping list", "success");
        },
        onError: (err) =>
          showToast(`Failed: ${(err as Error).message}`, "error"),
      },
    );
  }

  return (
    <div className="flex items-center gap-3 mt-2 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2">
      <ShoppingCart size={14} className="text-amber-400 shrink-0" />
      <p className="text-xs text-amber-300 flex-1">
        You don't have any {displayType} fertilizer. Add to shopping list?
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleAdd}
        disabled={createItem.isPending}
      >
        {createItem.isPending ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
