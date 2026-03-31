import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export type ViewMode = "grid" | "table";
export type SortDir = "asc" | "desc";

export interface TableState {
  view: ViewMode;
  sort: string | null;
  sortDir: SortDir;
  visibleCols: string[] | null; // null = all visible (default)
  colOrder: string[] | null; // null = default order
  filters: Record<string, string>;
  // For MyPlants existing filters
  tab: string;
  statusFilter: string;
  locationFilter: string;
}

export interface TableStateActions {
  setView: (v: ViewMode) => void;
  setSort: (col: string, dir?: SortDir) => void;
  toggleSort: (col: string) => void;
  setVisibleCols: (cols: string[]) => void;
  setColOrder: (cols: string[]) => void;
  setFilter: (col: string, value: string) => void;
  clearFilter: (col: string) => void;
  clearAllFilters: () => void;
  setTab: (tab: string) => void;
  setStatusFilter: (status: string) => void;
  setLocationFilter: (loc: string) => void;
}

export function useTableState(defaults?: {
  defaultView?: ViewMode;
  defaultSort?: string;
  defaultSortDir?: SortDir;
}): [TableState, TableStateActions] {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo<TableState>(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith("f_") && value) {
        filters[key.slice(2)] = value;
      }
    });

    const colsParam = searchParams.get("cols");
    const colOrderParam = searchParams.get("colOrder");

    return {
      view: (searchParams.get("view") as ViewMode) ?? defaults?.defaultView ?? "grid",
      sort: searchParams.get("sort") ?? defaults?.defaultSort ?? null,
      sortDir: (searchParams.get("sortDir") as SortDir) ?? defaults?.defaultSortDir ?? "asc",
      visibleCols: colsParam ? colsParam.split(",") : null,
      colOrder: colOrderParam ? colOrderParam.split(",") : null,
      filters,
      tab: searchParams.get("tab") ?? "garden",
      statusFilter: searchParams.get("status") ?? "",
      locationFilter: searchParams.get("location") ?? "",
    };
  }, [searchParams, defaults?.defaultView, defaults?.defaultSort, defaults?.defaultSortDir]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const actions = useMemo<TableStateActions>(
    () => ({
      setView: (v) => updateParams({ view: v === "grid" ? null : v }),
      setSort: (col, dir) =>
        updateParams({ sort: col, sortDir: dir ?? "asc" }),
      toggleSort: (col) => {
        if (state.sort === col) {
          updateParams({ sortDir: state.sortDir === "asc" ? "desc" : "asc" });
        } else {
          updateParams({ sort: col, sortDir: "asc" });
        }
      },
      setVisibleCols: (cols) =>
        updateParams({ cols: cols.length > 0 ? cols.join(",") : null }),
      setColOrder: (cols) =>
        updateParams({ colOrder: cols.length > 0 ? cols.join(",") : null }),
      setFilter: (col, value) => updateParams({ [`f_${col}`]: value || null }),
      clearFilter: (col) => updateParams({ [`f_${col}`]: null }),
      clearAllFilters: () => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          const keysToDelete: string[] = [];
          next.forEach((_, key) => {
            if (key.startsWith("f_")) keysToDelete.push(key);
          });
          keysToDelete.forEach((k) => next.delete(k));
          return next;
        }, { replace: true });
      },
      setTab: (tab) => updateParams({ tab: tab === "garden" ? null : tab, status: null }),
      setStatusFilter: (status) => updateParams({ status: status || null }),
      setLocationFilter: (loc) => updateParams({ location: loc || null }),
    }),
    [updateParams, state.sort, state.sortDir, setSearchParams],
  );

  return [state, actions];
}
