import { LayoutGrid, Table2 } from "lucide-react";
import clsx from "clsx";

export type ViewMode = "grid" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-stone-800 rounded-lg p-0.5 border border-stone-700">
      <button
        onClick={() => onChange("grid")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-display transition-colors",
          value === "grid"
            ? "bg-stone-700 text-stone-100"
            : "text-stone-500 hover:text-stone-300",
        )}
        title="Grid view"
      >
        <LayoutGrid size={14} />
        Grid
      </button>
      <button
        onClick={() => onChange("table")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-display transition-colors",
          value === "table"
            ? "bg-stone-700 text-stone-100"
            : "text-stone-500 hover:text-stone-300",
        )}
        title="Table view"
      >
        <Table2 size={14} />
        Table
      </button>
    </div>
  );
}
