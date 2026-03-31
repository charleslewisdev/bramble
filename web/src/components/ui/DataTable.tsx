import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  GripVertical,
  Check,
  X,
  Filter,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  /** Options for dropdown filter; omit for free-text filter */
  filterOptions?: { label: string; value: string }[];
  /** Custom render; defaults to String(row[key]) */
  render?: (row: T) => ReactNode;
  /** Accessor for sorting/filtering raw value */
  accessor?: (row: T) => string | number | boolean | null | undefined;
  /** Min width in px */
  minWidth?: number;
  /** Default visibility */
  defaultVisible?: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Unique key for each row */
  rowKey: (row: T) => string | number;
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Sort state (controlled) */
  sort?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (col: string) => void;
  /** Column filters (controlled) */
  filters?: Record<string, string>;
  onFilterChange?: (col: string, value: string) => void;
  onClearFilters?: () => void;
  /** Visible columns (controlled, null = all) */
  visibleCols?: string[] | null;
  onVisibleColsChange?: (cols: string[]) => void;
  /** Column order (controlled, null = default) */
  colOrder?: string[] | null;
  onColOrderChange?: (cols: string[]) => void;
  /** Multi-select */
  selectedIds?: Set<string | number>;
  onSelectionChange?: (ids: Set<string | number>) => void;
  /** Action bar rendered above table when items are selected */
  selectionActions?: ReactNode;
  /** Empty state */
  emptyMessage?: string;
}

// ─── Component ────────────────────────────────────────────────────

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sort,
  sortDir = "asc",
  onSort,
  filters = {},
  onFilterChange,
  onClearFilters,
  visibleCols,
  onVisibleColsChange,
  colOrder,
  onColOrderChange,
  selectedIds,
  onSelectionChange,
  selectionActions,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  const [showColConfig, setShowColConfig] = useState(false);
  const [showFilterRow, setShowFilterRow] = useState(() =>
    Object.values(filters).some((v) => v !== ""),
  );
  const [dragCol, setDragCol] = useState<string | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const configBtnRef = useRef<HTMLButtonElement>(null);

  // Close column config on outside click
  useEffect(() => {
    if (!showColConfig) return;
    function handleClick(e: MouseEvent) {
      if (
        configRef.current &&
        !configRef.current.contains(e.target as Node) &&
        configBtnRef.current &&
        !configBtnRef.current.contains(e.target as Node)
      ) {
        setShowColConfig(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColConfig]);

  // ─── Derive ordered & visible columns ──────────────────────────
  const orderedCols = useMemo(() => {
    const order = colOrder ?? columns.map((c) => c.key);
    const colMap = new Map(columns.map((c) => [c.key, c]));
    const visible = new Set(
      visibleCols ?? columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
    );
    return order
      .filter((k) => visible.has(k) && colMap.has(k))
      .map((k) => colMap.get(k)!);
  }, [columns, colOrder, visibleCols]);

  // All column keys for the config panel, in current order
  const allColsOrdered = useMemo(() => {
    const order = colOrder ?? columns.map((c) => c.key);
    const colMap = new Map(columns.map((c) => [c.key, c]));
    return order.filter((k) => colMap.has(k)).map((k) => colMap.get(k)!);
  }, [columns, colOrder]);

  const visibleSet = useMemo(
    () =>
      new Set(
        visibleCols ?? columns.filter((c) => c.defaultVisible !== false).map((c) => c.key),
      ),
    [visibleCols, columns],
  );

  // ─── Filter data ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (Object.keys(filters).length === 0) return data;
    return data.filter((row) => {
      for (const [colKey, filterVal] of Object.entries(filters)) {
        if (!filterVal) continue;
        const col = columns.find((c) => c.key === colKey);
        if (!col) continue;
        const raw = col.accessor
          ? col.accessor(row)
          : (row as Record<string, unknown>)[colKey];
        const str = raw == null ? "" : String(raw).toLowerCase();
        if (!str.includes(filterVal.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, filters, columns]);

  // ─── Sort data ────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = col.accessor
        ? col.accessor(a)
        : (a as Record<string, unknown>)[sort];
      const bVal = col.accessor
        ? col.accessor(b)
        : (b as Record<string, unknown>)[sort];
      const aStr = aVal == null ? "" : String(aVal);
      const bStr = bVal == null ? "" : String(bVal);
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filtered, sort, sortDir, columns]);

  // ─── Selection helpers ────────────────────────────────────────
  const allSelected =
    sorted.length > 0 &&
    selectedIds != null &&
    sorted.every((r) => selectedIds.has(rowKey(r)));
  const someSelected =
    selectedIds != null && selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(sorted.map((r) => rowKey(r))));
    }
  }

  function toggleRow(id: string | number) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  // ─── Drag reorder helpers ─────────────────────────────────────
  function handleDragStart(key: string) {
    setDragCol(key);
  }

  function handleDragOver(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    if (!dragCol || dragCol === targetKey) return;
  }

  function handleDrop(targetKey: string) {
    if (!dragCol || dragCol === targetKey || !onColOrderChange) return;
    const order = colOrder ?? columns.map((c) => c.key);
    const fromIdx = order.indexOf(dragCol);
    const toIdx = order.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...order];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragCol);
    onColOrderChange(next);
    setDragCol(null);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {selectedIds && selectedIds.size > 0 && (
            <span className="text-sm text-emerald-400 font-mono">
              {selectedIds.size} selected
            </span>
          )}
          {selectedIds && selectedIds.size > 0 && selectionActions}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterRow(!showFilterRow)}
            className={clsx(
              "p-1.5 rounded-lg text-sm transition-colors",
              showFilterRow || hasActiveFilters
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800",
            )}
            title="Toggle column filters"
          >
            <Filter size={16} />
          </button>
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="p-1.5 rounded-lg text-sm text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
              title="Clear all filters"
            >
              <X size={16} />
            </button>
          )}
          <div className="relative">
            <button
              ref={configBtnRef}
              onClick={() => setShowColConfig(!showColConfig)}
              className={clsx(
                "p-1.5 rounded-lg text-sm transition-colors",
                showColConfig
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-stone-400 hover:text-stone-200 hover:bg-stone-800",
              )}
              title="Configure columns"
            >
              <Columns3 size={16} />
            </button>

            {/* Column config dropdown */}
            {showColConfig && (
              <div
                ref={configRef}
                className="absolute right-0 top-full mt-1 z-30 bg-stone-900 border border-stone-700 rounded-lg shadow-xl w-64 max-h-80 overflow-y-auto"
              >
                <div className="p-2 border-b border-stone-800 flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-display">
                    Columns
                  </span>
                  <button
                    onClick={() => setShowColConfig(false)}
                    className="text-stone-500 hover:text-stone-300"
                  >
                    <X size={14} />
                  </button>
                </div>
                {allColsOrdered.map((col) => (
                  <div
                    key={col.key}
                    draggable
                    onDragStart={() => handleDragStart(col.key)}
                    onDragOver={(e) => handleDragOver(e, col.key)}
                    onDrop={() => handleDrop(col.key)}
                    className={clsx(
                      "flex items-center gap-2 px-2 py-1.5 cursor-grab text-sm hover:bg-stone-800/50",
                      dragCol === col.key && "opacity-50",
                    )}
                  >
                    <GripVertical
                      size={14}
                      className="text-stone-600 shrink-0"
                    />
                    <button
                      onClick={() => {
                        if (!onVisibleColsChange) return;
                        const next = new Set(visibleSet);
                        if (next.has(col.key)) {
                          // Don't allow hiding all columns
                          if (next.size > 1) next.delete(col.key);
                        } else {
                          next.add(col.key);
                        }
                        onVisibleColsChange([...next]);
                      }}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <span
                        className={clsx(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          visibleSet.has(col.key)
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-stone-600",
                        )}
                      >
                        {visibleSet.has(col.key) && (
                          <Check size={12} className="text-white" />
                        )}
                      </span>
                      <span
                        className={clsx(
                          "truncate",
                          visibleSet.has(col.key) ? "text-stone-200" : "text-stone-500",
                        )}
                      >
                        {col.label}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table container with scroll */}
      <div className="border border-stone-800 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-900 border-b border-stone-800">
                {onSelectionChange && (
                  <th className="sticky left-0 z-20 bg-stone-900 w-10 px-3 py-2.5 border-b border-stone-800">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="rounded border-stone-600 text-emerald-500 focus:ring-emerald-500/40 bg-stone-800"
                    />
                  </th>
                )}
                {orderedCols.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-left text-xs font-display font-semibold text-stone-400 uppercase tracking-wider whitespace-nowrap border-b border-stone-800 select-none"
                    style={{ minWidth: col.minWidth ?? 100 }}
                  >
                    {col.sortable && onSort ? (
                      <button
                        onClick={() => onSort(col.key)}
                        className="flex items-center gap-1 hover:text-stone-200 transition-colors group"
                      >
                        {col.label}
                        {sort === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp size={14} className="text-emerald-400" />
                          ) : (
                            <ArrowDown size={14} className="text-emerald-400" />
                          )
                        ) : (
                          <ArrowUpDown
                            size={14}
                            className="text-stone-600 group-hover:text-stone-400"
                          />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>

              {/* Filter row */}
              {showFilterRow && (
                <tr className="bg-stone-900/80 border-b border-stone-800">
                  {onSelectionChange && (
                    <th className="sticky left-0 z-20 bg-stone-900/80 px-3 py-1.5" />
                  )}
                  {orderedCols.map((col) => (
                    <th key={col.key} className="px-3 py-1.5">
                      {col.filterable && onFilterChange ? (
                        col.filterOptions ? (
                          <select
                            value={filters[col.key] ?? ""}
                            onChange={(e) =>
                              onFilterChange(col.key, e.target.value)
                            }
                            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                          >
                            <option value="">All</option>
                            {col.filterOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={filters[col.key] ?? ""}
                            onChange={(e) =>
                              onFilterChange(col.key, e.target.value)
                            }
                            placeholder="Filter..."
                            className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                          />
                        )
                      ) : null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            {/* Body */}
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={orderedCols.length + (onSelectionChange ? 1 : 0)}
                    className="text-center py-12 text-stone-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const id = rowKey(row);
                  const isSelected = selectedIds?.has(id) ?? false;
                  return (
                    <tr
                      key={id}
                      onClick={() => onRowClick?.(row)}
                      className={clsx(
                        "border-b border-stone-800/50 transition-colors",
                        onRowClick && "cursor-pointer hover:bg-stone-800/50",
                        isSelected && "bg-emerald-500/5",
                      )}
                    >
                      {onSelectionChange && (
                        <td
                          className="sticky left-0 z-10 bg-stone-950 w-10 px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                            className="rounded border-stone-600 text-emerald-500 focus:ring-emerald-500/40 bg-stone-800"
                          />
                        </td>
                      )}
                      {orderedCols.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 text-stone-300 whitespace-nowrap font-mono text-xs"
                          style={{ minWidth: col.minWidth ?? 100 }}
                        >
                          {col.render
                            ? col.render(row)
                            : String(
                                (row as Record<string, unknown>)[col.key] ?? "—",
                              )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: row count */}
      <div className="flex items-center justify-between text-xs text-stone-500 font-mono px-1">
        <span>
          {sorted.length} row{sorted.length !== 1 ? "s" : ""}
          {hasActiveFilters ? ` (filtered from ${data.length})` : ""}
        </span>
      </div>
    </div>
  );
}
