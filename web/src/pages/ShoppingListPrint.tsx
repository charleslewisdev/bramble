import { useEffect, useMemo } from "react";
import { useShoppingList } from "../api/hooks";
import type { ShoppingItem } from "../api";

function groupByVendor(items: ShoppingItem[]) {
  const groups: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    const key = item.vendorName || "Any Vendor / TBD";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  // Sort vendor groups: named vendors first (alphabetical), then TBD last
  return Object.entries(groups).sort(([a], [b]) => {
    if (a === "Any Vendor / TBD") return 1;
    if (b === "Any Vendor / TBD") return -1;
    return a.localeCompare(b);
  });
}

function costByCategory(items: ShoppingItem[]) {
  const cats: Record<string, number> = {};
  for (const item of items) {
    const key = item.category || "other";
    cats[key] = (cats[key] ?? 0) + (item.estimatedCost ?? 0);
  }
  return Object.entries(cats)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
}

export default function ShoppingListPrint() {
  const { data: items, isLoading } = useShoppingList();

  const unchecked = useMemo(
    () => items?.filter((i) => !i.isChecked) ?? [],
    [items]
  );
  const vendorGroups = useMemo(() => groupByVendor(unchecked), [unchecked]);
  const categories = useMemo(() => costByCategory(unchecked), [unchecked]);
  const totalCost = unchecked.reduce(
    (sum, i) => sum + (i.estimatedCost ?? 0),
    0
  );

  useEffect(() => {
    if (!isLoading && items) {
      // Use requestAnimationFrame + setTimeout to ensure the DOM is fully
      // painted before triggering print. Plain setTimeout can hang Firefox
      // on Windows when called during React's commit phase.
      requestAnimationFrame(() => {
        setTimeout(() => window.print(), 300);
      });
    }
  }, [isLoading, items]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        Loading shopping list...
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { margin: 0; background: white; }
        * { box-sizing: border-box; }
      `}</style>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 32px",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          color: "#1c1917",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "2px solid #1c1917",
            paddingBottom: 8,
            marginBottom: 16,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Bramble Shopping List
          </h1>
          <span style={{ fontSize: 11, color: "#78716c" }}>{today}</span>
        </div>

        {/* Summary */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 20,
            padding: "10px 14px",
            background: "#fafaf9",
            border: "1px solid #e7e5e4",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <div>
            <strong>{unchecked.length}</strong> items
          </div>
          <div>
            Est. total: <strong>${totalCost.toFixed(0)}</strong>
          </div>
          <div style={{ flex: 1 }} />
          {categories.map(([cat, cost]) => (
            <div key={cat} style={{ color: "#78716c" }}>
              {cat}: ${cost.toFixed(0)}
            </div>
          ))}
        </div>

        {/* Print button (hidden in print) */}
        <div className="no-print" style={{ marginBottom: 16 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "6px 14px",
              background: "#1c1917",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Print
          </button>
          <button
            onClick={() => window.close()}
            style={{
              padding: "6px 14px",
              background: "white",
              color: "#1c1917",
              border: "1px solid #d6d3d1",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              marginLeft: 8,
            }}
          >
            Close
          </button>
        </div>

        {/* Vendor groups */}
        {vendorGroups.map(([vendor, groupItems]) => {
          const groupTotal = groupItems.reduce(
            (sum, i) => sum + (i.estimatedCost ?? 0),
            0
          );
          return (
            <div key={vendor} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  borderBottom: "1px solid #d6d3d1",
                  paddingBottom: 4,
                  marginBottom: 8,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {vendor}
                </h2>
                {groupTotal > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'Space Mono', monospace",
                      color: "#78716c",
                    }}
                  >
                    ~${groupTotal.toFixed(0)}
                  </span>
                )}
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <tbody>
                  {groupItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid #f5f5f4",
                        verticalAlign: "top",
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ width: 22, padding: "6px 6px 6px 0" }}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            border: "1.5px solid #a8a29e",
                            borderRadius: 3,
                          }}
                        />
                      </td>
                      {/* Name + qty */}
                      <td style={{ padding: "6px 8px 6px 0", fontWeight: 500 }}>
                        {item.name}
                        {item.quantity > 1 && (
                          <span
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontWeight: 400,
                              color: "#78716c",
                              marginLeft: 6,
                            }}
                          >
                            x{item.quantity}
                          </span>
                        )}
                      </td>
                      {/* Category */}
                      <td
                        style={{
                          width: 70,
                          padding: "6px 8px",
                          color: "#a8a29e",
                          fontSize: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        {item.category}
                      </td>
                      {/* Price */}
                      <td
                        style={{
                          width: 55,
                          padding: "6px 0",
                          textAlign: "right",
                          fontFamily: "'Space Mono', monospace",
                          color: "#78716c",
                        }}
                      >
                        {item.estimatedCost != null
                          ? `$${item.estimatedCost.toFixed(0)}`
                          : ""}
                      </td>
                    </tr>
                  ))}
                  {groupItems.some((i) => i.notes) && (
                    <>
                      {groupItems
                        .filter((i) => i.notes)
                        .map((item) => (
                          <tr key={`${item.id}-notes`}>
                            <td colSpan={4}>
                              <div
                                style={{
                                  padding: "4px 0 8px 22px",
                                  fontSize: 10,
                                  color: "#78716c",
                                  lineHeight: 1.4,
                                }}
                              >
                                <strong>{item.name}:</strong> {item.notes}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 8,
            borderTop: "2px solid #1c1917",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>Total</span>
          <span style={{ fontFamily: "'Space Mono', monospace" }}>
            ~${totalCost.toFixed(0)}
          </span>
        </div>
      </div>
    </>
  );
}
