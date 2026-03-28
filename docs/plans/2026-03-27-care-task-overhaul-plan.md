# Care Task Overhaul & Plant Detail UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make care tasks status-aware with smart lifecycle management, improve plant detail page with inline editing and care data, add container metadata fields, add collapsible care task UI, and implement indoor/outdoor plant movement logic based on weather.

**Architecture:** Seven tasks spanning schema changes, server-side logic, and frontend UI. Tasks are ordered by dependency: schema first, then server logic, then frontend. Each task is independently testable.

**Tech Stack:** Drizzle ORM (SQLite), Fastify, React 19, TanStack Query, Tailwind CSS v4

---

### Task 1: Schema — Container Metadata Fields

Add structured container fields to `plantInstances` table replacing the freeform `containerDescription`.

**Files:**
- Modify: `server/src/db/schema.ts` (plantInstances table, lines 257-315)
- Create: `server/drizzle/0012_container_and_outdoor_pref.sql`
- Modify: `server/src/db/types.ts` (add ContainerMaterial type)
- Modify: `server/src/routes/plants.ts` (update create/update schemas, lines 89-113)

**Steps:**

1. Add new columns to `plantInstances` in `schema.ts`:
```typescript
// After containerDescription (line 282)
containerSize: text("container_size"),  // "6 inch", "5 gallon", etc.
containerShape: text("container_shape", {
  enum: ["round", "square", "rectangular", "oval", "hanging", "window_box", "other"],
}),
containerMaterial: text("container_material", {
  enum: ["terracotta", "ceramic", "plastic", "fabric", "metal", "wood", "concrete", "fiberglass", "stone"],
}),
outdoorCandidate: integer("outdoor_candidate", { mode: "boolean" }).notNull().default(false),
```

2. Add type exports to `server/src/db/types.ts`:
```typescript
export type ContainerShape = "round" | "square" | "rectangular" | "oval" | "hanging" | "window_box" | "other";
export type ContainerMaterial = "terracotta" | "ceramic" | "plastic" | "fabric" | "metal" | "wood" | "concrete" | "fiberglass" | "stone";
```

3. Create migration SQL `server/drizzle/0012_container_and_outdoor_pref.sql`:
```sql
ALTER TABLE plant_instances ADD COLUMN container_size TEXT;
ALTER TABLE plant_instances ADD COLUMN container_shape TEXT;
ALTER TABLE plant_instances ADD COLUMN container_material TEXT;
ALTER TABLE plant_instances ADD COLUMN outdoor_candidate INTEGER NOT NULL DEFAULT 0;
```

4. Update `_journal.json` in `server/drizzle/meta/` — run `npx drizzle-kit generate` to create.

5. Update Zod schemas in `server/src/routes/plants.ts`:
   - Add to `createInstanceSchema`: `containerSize`, `containerShape`, `containerMaterial`, `outdoorCandidate`
   - Add to `updateInstanceSchema`: same fields

6. Verify: `cd server && npx tsc --noEmit`

7. Commit: `feat: add container metadata and outdoor candidate fields`

---

### Task 2: Server — Status-Aware Care Tasks

When a plant's status changes, care tasks should be created/removed accordingly. Key rules:
- `planned` → `planted`: Remove planting task, generate active care tasks (water, fertilize, etc.)
- Any → `dead`/`removed`: Soft-disable future tasks (set dueDate far future or delete)
- Any → `dormant`: Pause recurring tasks
- `dormant` → active status: Resume tasks

**Files:**
- Modify: `server/src/routes/plants.ts` (PUT /instances/:id handler, lines 499-530)
- Modify: `server/src/services/care-tasks.ts` (add status transition logic)
- Test: `server/src/services/care-tasks.test.ts`

**Steps:**

1. Add a new function `handleStatusTransition` to `server/src/services/care-tasks.ts`:
```typescript
export function handleStatusTransition(
  plantInstanceId: number,
  oldStatus: string,
  newStatus: string,
  db: any,
): { created: number; removed: number; message: string } {
  // dead/removed: delete all future care tasks for this plant
  if (newStatus === "dead" || newStatus === "removed") {
    const result = db.delete(careTasks)
      .where(eq(careTasks.plantInstanceId, plantInstanceId))
      .run();
    return { created: 0, removed: result.changes, message: `Removed ${result.changes} care tasks` };
  }

  // planned → planted/established: remove planting custom task, generate care tasks
  if (oldStatus === "planned" && (newStatus === "planted" || newStatus === "established")) {
    // Delete "Plant ..." custom tasks
    db.delete(careTasks)
      .where(and(
        eq(careTasks.plantInstanceId, plantInstanceId),
        eq(careTasks.taskType, "custom"),
        sql`${careTasks.title} LIKE 'Plant %'`,
      ))
      .run();

    // Fetch instance + ref + zone, generate new tasks
    const instance = db.query.plantInstances.findFirst({...});
    // ... generate and insert tasks
  }

  // dormant: no action needed (existing filter excludes dormant from display if desired)
}
```

2. Call `handleStatusTransition` from the PUT /instances/:id route when status changes.

3. Write tests covering each transition.

4. Commit: `feat: status-aware care task lifecycle management`

---

### Task 3: Server — Indoor/Outdoor Plant Movement Logic

Create a service that checks weather forecasts and generates "move" tasks for container plants marked as `outdoorCandidate`.

**Files:**
- Create: `server/src/services/outdoor-movement.ts`
- Modify: `server/src/routes/weather.ts` (trigger movement check on weather refresh)
- Test: `server/src/services/outdoor-movement.test.ts`

**Steps:**

1. Create `server/src/services/outdoor-movement.ts`:

Logic:
- Query all `outdoorCandidate === true` plants with their zone and reference data
- For each plant, check `ref.minTempF` against forecast lows
- **Move outdoors**: If plant is indoors, all forecast lows for next 3 days > `minTempF + 5°F` buffer, and daytime highs > 50°F → generate "move outdoors" task
- **Bring indoors**: If plant is outdoors AND tomorrow's forecast low < `minTempF + 5°F` → generate urgent "bring indoors" task with dueDate = today (afternoon), title includes urgency
- Check for existing pending move tasks to avoid duplicates
- Use `taskType: "move"` which already exists in the schema

2. Wire into weather refresh route (`server/src/routes/weather.ts` after line 238): when weather is refreshed, call `checkOutdoorMovement(locationId)`.

3. Write tests with mocked weather data covering:
   - Plant indoors, warm forecast → generates "move outdoors" task
   - Plant outdoors, cold forecast tomorrow → generates urgent "bring indoors" task
   - Existing move task → no duplicate
   - Plant without `minTempF` → skipped

4. Commit: `feat: weather-driven indoor/outdoor movement tasks`

---

### Task 4: Frontend — Care Tasks Page Overhaul (Collapsible, Smart Counts)

Redesign the care tasks page to show overdue/current tasks prominently and collapse future tasks.

**Files:**
- Modify: `web/src/pages/CareTasks.tsx`

**Steps:**

1. Split tasks into three groups:
```typescript
const today = new Date().toISOString().split("T")[0]!;
const overdue = upcoming.filter(t => t.dueDate && t.dueDate < today);
const current = upcoming.filter(t => t.dueDate === today);
const future = upcoming.filter(t => !t.dueDate || t.dueDate > today);
const nearFuture = future.slice(0, 5);
const farFuture = future.slice(5);
```

2. Update header count to show only actionable tasks:
```tsx
<p className="text-stone-400 text-sm mt-1">
  {overdue.length + current.length} task{(overdue.length + current.length) !== 1 ? "s" : ""} need attention
  {future.length > 0 && <span className="text-stone-500"> · {future.length} upcoming</span>}
</p>
```

3. Render sections:
   - **Overdue** (red accent, always visible)
   - **Today** (emerald accent, always visible)
   - **Coming Up** (first 5 future tasks, always visible)
   - **Later** (remaining tasks, collapsed by default with "Show X more" toggle)

4. Add `showAllFuture` state and toggle button.

5. Commit: `feat: collapsible care tasks with smart counts`

---

### Task 5: Frontend — Plant Detail Page Header Overhaul

Restructure the hero card: remove Update Status card, make status clickable, add labels, reorder fields, surface key care data.

**Files:**
- Modify: `web/src/pages/MyPlantDetail.tsx`

**Steps:**

1. **Reorder header fields** in the hero card (lines 279-352):
   - Nickname (h1) with edit button
   - Common name (if nickname exists)
   - Scientific name (italic)
   - `Cultivar: 'Value'` labeled (after scientific name)
   - Spacer/divider
   - Status badge → make clickable (opens dropdown popover inline)
   - Location with MapPin label
   - Move button
   - Container/In-ground label
   - Date planted label

2. **Remove the standalone "Update Status" card** (lines 355-375). Replace with a clickable status badge that opens a dropdown:
```tsx
const [showStatusMenu, setShowStatusMenu] = useState(false);
// In hero card:
<div className="relative">
  <button onClick={() => setShowStatusMenu(!showStatusMenu)}>
    <StatusBadge status={plant.status} />
    <ChevronDown size={12} />
  </button>
  {showStatusMenu && (
    <div className="absolute top-full mt-1 z-20 bg-stone-800 border border-stone-700 rounded-lg p-2 shadow-xl">
      {statusOptions.map(s => (
        <button key={s} onClick={() => { handleStatusChange(s); setShowStatusMenu(false); }} ...>
          {s}
        </button>
      ))}
    </div>
  )}
</div>
```

3. **Add "Care Profile" card** after hero, before safety:
```tsx
{ref && (
  <Card>
    <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
      Care Profile
    </h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {ref.sunRequirement && <Stat label="Sun" value={formatEnum(ref.sunRequirement)} />}
      {ref.waterNeeds && <Stat label="Water" value={formatEnum(ref.waterNeeds)} />}
      {ref.soilPreference && <Stat label="Soil" value={ref.soilPreference} />}
      {ref.hardinessZoneMin != null && <Stat label="Hardiness" value={`Zone ${ref.hardinessZoneMin}-${ref.hardinessZoneMax}`} />}
      {ref.matureHeight && <Stat label="Height" value={ref.matureHeight} />}
      {ref.matureSpread && <Stat label="Spread" value={ref.matureSpread} />}
      {ref.bloomTime && <Stat label="Bloom" value={ref.bloomTime} />}
      {ref.bloomColor && <Stat label="Bloom Color" value={ref.bloomColor} />}
      {ref.growthRate && <Stat label="Growth" value={formatEnum(ref.growthRate)} />}
      {ref.lifecycle && <Stat label="Lifecycle" value={formatEnum(ref.lifecycle)} />}
    </div>
  </Card>
)}
```
Where `Stat` is a small inline component:
```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 font-display">{label}</p>
      <p className="text-sm text-stone-200 font-mono">{value}</p>
    </div>
  );
}
```

4. Commit: `feat: plant detail page header overhaul with care profile`

---

### Task 6: Frontend — Inline Editing for Plant Fields & Reference Data

Make cultivar and key reference fields editable from the plant detail page.

**Files:**
- Modify: `web/src/pages/MyPlantDetail.tsx`
- Modify: `web/src/api/hooks.ts` (add `useUpdatePlantReference` hook)
- Modify: `web/src/api/index.ts` (add `updatePlantReference` function)

**Steps:**

1. Add API function in `web/src/api/index.ts`:
```typescript
export function updatePlantReference(id: number, data: Partial<PlantReference>) {
  return put<PlantReference>(`/plants/references/${id}`, data);
}
```

2. Add hook in `web/src/api/hooks.ts`:
```typescript
export function useUpdatePlantReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlantReference> }) =>
      api.updatePlantReference(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["plantReferences"] });
      qc.invalidateQueries({ queryKey: ["plantReferences", v.id] });
      qc.invalidateQueries({ queryKey: ["plantInstances"] }); // instances include ref data
    },
  });
}
```

3. Add edit modal for reference fields — a single "Edit Plant Info" modal that covers:
   - Common name, latin name, cultivar (text inputs)
   - Sun requirement, water needs (selects)
   - Mature height, mature spread (text)
   - Min/max temp (numbers)
   - Show warning if multiple instances share this reference

4. Add edit capability to the container card — replace freeform with structured fields:
   - Container size (text input)
   - Container shape (select)
   - Container material (select)
   - Container notes (textarea, uses existing `containerDescription`)
   - Outdoor candidate toggle

5. Commit: `feat: inline editing for plant reference and container data`

---

### Task 7: Frontend — Container Card Overhaul

Replace the freeform container card with structured fields.

**Files:**
- Modify: `web/src/pages/MyPlantDetail.tsx` (container card section, lines 377-389)

**Steps:**

1. Replace the existing container card (lines 377-389) with structured display:
```tsx
{plant.isContainer && (
  <Card>
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
        Container
      </h2>
      <button onClick={() => setShowEditContainer(true)} className="...">
        <Edit3 size={14} />
      </button>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {plant.containerSize && <Stat label="Size" value={plant.containerSize} />}
      {plant.containerShape && <Stat label="Shape" value={formatEnum(plant.containerShape)} />}
      {plant.containerMaterial && <Stat label="Material" value={formatEnum(plant.containerMaterial)} />}
      {plant.outdoorCandidate && (
        <div>
          <p className="text-xs text-stone-500 font-display">Preference</p>
          <p className="text-sm text-emerald-400 font-mono">Outdoors when safe</p>
        </div>
      )}
    </div>
    {plant.containerDescription && (
      <p className="text-sm text-stone-400 mt-3">{plant.containerDescription}</p>
    )}
  </Card>
)}
```

2. Add edit container modal with fields for size, shape, material, notes, outdoor candidate toggle.

3. Commit: `feat: structured container card with metadata fields`

---

## Execution Notes

- Run `pnpm test` after each server change
- Run `npx tsc --noEmit` in both `server/` and `web/` before committing
- Migration must run against existing prod DB (additive only, no destructive changes)
- The `outdoorCandidate` flag is the key new concept — it's an explicit user opt-in for "I want this plant outside when weather allows"
