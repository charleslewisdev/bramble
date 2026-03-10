import { type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30",
  secondary:
    "bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700",
  danger: "bg-red-600 hover:bg-red-500 text-white shadow-sm shadow-red-900/30",
  ghost: "bg-transparent hover:bg-stone-800 text-stone-400 hover:text-stone-200",
};

const sizeStyles: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-lg font-[family-name:var(--font-display)] font-semibold",
        "transition-colors duration-150",
        "inline-flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
