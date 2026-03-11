import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const bgColor =
    toast.type === "success"
      ? "bg-emerald-900/90 border-emerald-700"
      : toast.type === "error"
        ? "bg-red-900/90 border-red-700"
        : "bg-sky-900/90 border-sky-700";

  const textColor =
    toast.type === "success"
      ? "text-emerald-200"
      : toast.type === "error"
        ? "text-red-200"
        : "text-sky-200";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${bgColor}`}
    >
      <p className={`text-sm font-display flex-1 ${textColor}`}>
        {toast.message}
      </p>
      <button
        onClick={onRemove}
        className={`shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors ${textColor}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
