import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  forwardRef,
} from "react";
import clsx from "clsx";

const baseStyles =
  "w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors font-display";

// ---------- Input ----------

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-stone-300 font-display"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(baseStyles, error && "border-red-500", className)}
          {...rest}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ---------- Textarea ----------

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-stone-300 font-display"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={clsx(baseStyles, "min-h-[80px] resize-y", error && "border-red-500", className)}
          {...rest}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ---------- Select ----------

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-stone-300 font-display"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={clsx(baseStyles, "cursor-pointer", error && "border-red-500", className)}
          {...rest}
        >
          {children}
        </select>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
