import clsx from "clsx";
import type { PlantStatus } from "../../api";

interface StatusBadgeProps {
  status: PlantStatus;
}

const statusConfig: Record<PlantStatus, { bg: string; text: string; label: string }> = {
  planned: { bg: "bg-sky-500/20", text: "text-sky-400", label: "Planned" },
  planted: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Planted" },
  established: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    label: "Established",
  },
  struggling: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    label: "Struggling",
  },
  dormant: { bg: "bg-violet-500/20", text: "text-violet-400", label: "Dormant" },
  dead: { bg: "bg-stone-600/20", text: "text-stone-400", label: "Dead" },
  removed: { bg: "bg-stone-700/20", text: "text-stone-500", label: "Removed" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = statusConfig[status];
  if (!c) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium font-[family-name:var(--font-display)]",
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  );
}
