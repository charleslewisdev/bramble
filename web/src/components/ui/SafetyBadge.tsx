import { Check, AlertTriangle, ShieldAlert, Skull } from "lucide-react";
import clsx from "clsx";
import type { SafetyLevel } from "../../api";

interface SafetyBadgeProps {
  level: SafetyLevel;
  for: "dogs" | "cats" | "children";
}

const config: Record<
  SafetyLevel,
  { bg: string; text: string; label: string; Icon: typeof Check }
> = {
  safe: { bg: "bg-green-500/20", text: "text-green-400", label: "Safe", Icon: Check },
  caution: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    label: "Caution",
    Icon: AlertTriangle,
  },
  toxic: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    label: "Toxic",
    Icon: ShieldAlert,
  },
  highly_toxic: {
    bg: "bg-red-800/30",
    text: "text-red-300",
    label: "Highly Toxic",
    Icon: Skull,
  },
};

const forLabels: Record<string, string> = {
  dogs: "Dogs",
  cats: "Cats",
  children: "Kids",
};

export default function SafetyBadge({ level, for: forTarget }: SafetyBadgeProps) {
  const c = config[level];
  if (!c) return null;
  const { bg, text, label, Icon } = c;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium font-[family-name:var(--font-display)]",
        bg,
        text
      )}
    >
      <Icon size={12} />
      {forLabels[forTarget]} — {label}
    </span>
  );
}
