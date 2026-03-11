import type { ReactNode } from "react";
import clsx from "clsx";

interface ChipProps {
  children: ReactNode;
  color?: "stone" | "amber" | "green" | "yellow" | "sky" | "pink" | "blue" | "red" | "emerald" | "violet";
  className?: string;
}

const colorStyles: Record<NonNullable<ChipProps["color"]>, string> = {
  stone: "bg-stone-800 text-stone-400",
  amber: "bg-amber-900/30 text-amber-400",
  green: "bg-green-900/30 text-green-400",
  yellow: "bg-yellow-900/30 text-yellow-400",
  sky: "bg-sky-900/30 text-sky-400",
  pink: "bg-pink-900/30 text-pink-400",
  blue: "bg-blue-900/30 text-blue-400",
  red: "bg-red-900/30 text-red-400",
  emerald: "bg-emerald-500/20 text-emerald-400",
  violet: "bg-violet-500/20 text-violet-400",
};

export default function Chip({ children, color = "stone", className }: ChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium font-[family-name:var(--font-display)]",
        colorStyles[color],
        className
      )}
    >
      {children}
    </span>
  );
}
