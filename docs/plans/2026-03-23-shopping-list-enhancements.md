# Shopping List Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add price display, accordion item details, and a vendor-grouped printable view to the Shopping List page.

**Architecture:** All changes are frontend-only — the API already returns `estimatedCost`, `vendorName`, `category`, and `notes` on every item. We add expand/collapse state per item, show price inline, and build a print page that groups items by vendor with cost summaries.

**Tech Stack:** React 19, Tailwind CSS v4, Lucide icons, TanStack Query (existing hooks)

---

### Task 1: Show price inline on each item

**Files:**
- Modify: `web/src/pages/ShoppingList.tsx:168-182` (unchecked item row)
- Modify: `web/src/pages/ShoppingList.tsx:223-228` (checked item row)

**Step 1: Add price display to unchecked items**

In the unchecked item `<div className="flex-1 min-w-0">` block (~line 168), add the estimated cost after the quantity span. Also add a cost summary in the header next to the item count.

Replace lines 168-182:
```tsx
<div className="flex-1 min-w-0">
  <p className="text-sm text-stone-200 font-display">
    {item.name}
    {item.quantity > 1 && (
      <span className="text-stone-500 font-mono ml-2">
        x{item.quantity}
      </span>
    )}
  </p>
  {item.notes && (
    <p className="text-xs text-stone-500 truncate">
      {item.notes}
    </p>
  )}
</div>
```

With:
```tsx
<div className="flex-1 min-w-0">
  <p className="text-sm text-stone-200 font-display">
    {item.name}
    {item.quantity > 1 && (
      <span className="text-stone-500 font-mono ml-2">
        x{item.quantity}
      </span>
    )}
  </p>
  {item.vendorName && (
    <p className="text-xs text-stone-500 truncate">
      {item.vendorName}
    </p>
  )}
</div>
{item.estimatedCost && (
  <span className="text-xs font-mono text-emerald-400 shrink-0">
    ${item.estimatedCost.toFixed(0)}
  </span>
)}
```

**Step 2: Add total cost in header**

Compute total from items and display next to item count. Add after the `<p>` with item count (~line 63):
```tsx
const totalCost = unchecked.reduce(
  (sum, i) => sum + (i.estimatedCost ?? 0), 0
);
```

Display: `{unchecked.length} items to get · ~${totalCost.toFixed(0)}`

**Step 3: Run dev server and verify**

Run: `cd web && pnpm dev`
Expected: prices show on right side of each item, total in header

**Step 4: Commit**

```bash
git add web/src/pages/ShoppingList.tsx
git commit -m "feat: show estimated cost inline on shopping list items"
```

---

### Task 2: Accordion expand/collapse for item details

**Files:**
- Modify: `web/src/pages/ShoppingList.tsx`
- Import: `ChevronDown` from lucide-react

**Step 1: Add expand state and toggle**

Add state for tracking which item is expanded:
```tsx
const [expandedId, setExpandedId] = useState<number | null>(null);
```

**Step 2: Make item rows clickable to expand**

Wrap the main content area (not the checkbox or delete button) in a clickable region. When clicked, toggle `expandedId`. The checkbox and delete button keep their existing click handlers — only the name/info area toggles expansion.

Add a click handler to the `<div className="flex-1 min-w-0">` that calls:
```tsx
onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
```

Add a chevron icon that rotates when expanded:
```tsx
<ChevronDown
  size={14}
  className={clsx(
    "text-stone-600 transition-transform shrink-0",
    expandedId === item.id && "rotate-180"
  )}
/>
```

**Step 3: Add expandable detail panel**

Below the item row, conditionally render the detail panel when `expandedId === item.id`:

```tsx
{expandedId === item.id && (
  <div className="px-4 pb-3 pt-1 bg-stone-900 border-x border-b border-stone-800 rounded-b-lg -mt-1 space-y-2">
    {item.notes && (
      <div>
        <p className="text-[10px] uppercase tracking-wider text-stone-600 font-display">Notes</p>
        <p className="text-xs text-stone-400 whitespace-pre-wrap">{item.notes}</p>
      </div>
    )}
    <div className="flex gap-4 flex-wrap">
      {item.category && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-600 font-display">Category</p>
          <Chip color={categoryColor(item.category)}>{item.category}</Chip>
        </div>
      )}
      {item.vendorName && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-600 font-display">Vendor</p>
          <p className="text-xs text-stone-300">{item.vendorName}</p>
        </div>
      )}
      {item.estimatedCost && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-stone-600 font-display">Est. Cost</p>
          <p className="text-xs text-emerald-400 font-mono">${item.estimatedCost.toFixed(2)}</p>
        </div>
      )}
    </div>
  </div>
)}
```

Helper function for category colors:
```tsx
function categoryColor(cat: string): "green" | "amber" | "blue" | "stone" | "red" | "violet" {
  switch (cat) {
    case "plant": return "green";
    case "soil": return "amber";
    case "fertilizer": return "violet";
    case "tool": return "blue";
    case "container": return "sky";
    default: return "stone";
  }
}
```

**Step 4: Adjust row styling for expand state**

When expanded, the item row should have no bottom border-radius so it flows into the detail panel. Use `clsx` to conditionally apply `rounded-b-none` when expanded.

**Step 5: Run dev server and verify**

Expected: clicking an item name expands its details below, clicking again collapses. Only one item expanded at a time. Checkbox and delete still work independently.

**Step 6: Commit**

```bash
git add web/src/pages/ShoppingList.tsx
git commit -m "feat: accordion expand/collapse for shopping list item details"
```

---

### Task 3: Vendor-grouped printable view

**Files:**
- Create: `web/src/pages/ShoppingListPrint.tsx`
- Modify: `web/src/pages/ShoppingList.tsx` (add Print button)
- Modify: `web/src/App.tsx` (add route)
- Import: `Printer` from lucide-react

**Step 1: Add the print route**

In `web/src/App.tsx`, add route:
```tsx
<Route path="/shopping/print" element={<ShoppingListPrint />} />
```

**Step 2: Build the printable page**

`ShoppingListPrint.tsx` — a standalone page with light theme, designed for paper:

```tsx
export default function ShoppingListPrint() {
  const { data: items, isLoading } = useShoppingList();

  useEffect(() => {
    if (!isLoading && items) {
      // Auto-trigger print dialog after render
      setTimeout(() => window.print(), 500);
    }
  }, [isLoading, items]);
```

**Layout:**
- White background, black text, no nav/sidebar
- Title: "Bramble Shopping List" with date
- **Cost summary table** at top: total items, total estimated cost, cost by category
- **Grouped by vendor** — each vendor gets a section header with subtotal
- Items with no vendor grouped under "Any Vendor / TBD"
- Each item shows: checkbox (empty square), name, qty, price, notes (full, not truncated)
- Category chips rendered as simple text labels (no color on print)

**Print-specific CSS** via Tailwind's `print:` modifier and a `<style>` block:
```css
@media print {
  @page { margin: 0.5in; size: letter; }
  body { -webkit-print-color-adjust: exact; }
}
```

**Step 3: Add Print button to ShoppingList.tsx**

In the header button group, add between Clear Done and Add Item:
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => window.open("/shopping/print", "_blank")}
>
  <Printer size={14} /> Print
</Button>
```

**Step 4: Run dev server and verify**

Navigate to `/shopping/print` — should see a clean, light-themed, vendor-grouped list. Print dialog should auto-open. Verify the main shopping list page has the Print button.

**Step 5: Commit**

```bash
git add web/src/pages/ShoppingListPrint.tsx web/src/pages/ShoppingList.tsx web/src/App.tsx
git commit -m "feat: vendor-grouped printable shopping list with cost summary"
```

---

### Task 4: Verify and clean up

**Step 1: Run tests**

```bash
cd web && pnpm test
```

Fix any failures.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Final commit if any cleanup needed**
