# Fertilizer System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add fertilizer inventory (Shed page), plant-level fertilizer guidance, care task nudges, and a Composting Guide (Almanac page).

**Architecture:** New `fertilizers` table scoped to location, 4 new columns on `plant_references`, new Shed + Almanac nav sections, passive shopping list nudge on care task detail. No NPK matching algorithm — simple type-based check.

**Tech Stack:** Drizzle ORM (SQLite), Fastify 5, React 19, TanStack Query v5, Tailwind CSS v4

---

### Task 1: Database schema — fertilizers table + plant_references columns

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/types.ts`

**Step 1: Add the fertilizers table to schema.ts**

After the `shoppingListItems` table (line ~477), add:

```typescript
// ─── Fertilizer Inventory ───────────────────────────────────────────────────

export const fertilizers = sqliteTable("fertilizers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["liquid", "granular", "slow_release", "compost", "compost_tea", "fish_emulsion", "other"],
  }).notNull(),
  npkN: real("npk_n"),
  npkP: real("npk_p"),
  npkK: real("npk_k"),
  organic: integer("organic", { mode: "boolean" }).notNull().default(false),
  status: text("status", {
    enum: ["have_it", "running_low", "out"],
  }).notNull().default("have_it"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("fertilizers_location_id_idx").on(table.locationId),
]);

export const fertilizersRelations = relations(fertilizers, ({ one }) => ({
  location: one(locations, {
    fields: [fertilizers.locationId],
    references: [locations.id],
  }),
}));
```

**Step 2: Add fertilizer columns to plant_references**

After `careNotes` (line ~229), add 4 columns:

```typescript
  fertilizerType: text("fertilizer_type", {
    enum: ["liquid", "granular", "slow_release", "compost", "compost_tea", "fish_emulsion", "other"],
  }),
  fertilizerNpk: text("fertilizer_npk"), // "10-10-10" format
  fertilizerFrequency: text("fertilizer_frequency"), // "Monthly during growing season"
  fertilizerNotes: text("fertilizer_notes"), // "Acid-loving, avoid alkaline"
```

**Step 3: Update types.ts**

Add to the re-export block:

```typescript
export type {
  // ... existing exports
  Fertilizer,
  NewFertilizer,
} from "./schema.js";
```

Add new type:

```typescript
export type FertilizerType = "liquid" | "granular" | "slow_release" | "compost" | "compost_tea" | "fish_emulsion" | "other";

export type FertilizerStatus = "have_it" | "running_low" | "out";
```

**Step 4: Generate and run migration**

```bash
cd server && pnpm db:generate && pnpm db:migrate
```

**Step 5: Commit**

```bash
git add server/src/db/schema.ts server/src/db/types.ts server/drizzle/
git commit -m "feat: fertilizers table and plant_references fertilizer columns"
```

---

### Task 2: Fertilizer API routes

**Files:**
- Create: `server/src/routes/fertilizers.ts`
- Modify: `server/src/index.ts`

**Step 1: Create the route file**

Follow the `shopping-list.ts` pattern exactly. Location-scoped CRUD:

```typescript
import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { fertilizers } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { idParamSchema, locationIdParamSchema } from "../lib/validation.js";

const fertilizerTypeEnum = z.enum([
  "liquid", "granular", "slow_release", "compost", "compost_tea", "fish_emulsion", "other",
]);

const fertilizerStatusEnum = z.enum(["have_it", "running_low", "out"]);

const createSchema = z.object({
  name: z.string().min(1),
  type: fertilizerTypeEnum,
  npkN: z.number().min(0).nullable().optional(),
  npkP: z.number().min(0).nullable().optional(),
  npkK: z.number().min(0).nullable().optional(),
  organic: z.boolean().optional(),
  status: fertilizerStatusEnum.optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial();

export async function fertilizerRoutes(app: FastifyInstance) {
  // GET /api/locations/:locationId/fertilizers
  app.get<{ Params: { locationId: string } }>("/", async (request, reply) => {
    const parsed = locationIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid location ID" });

    return db
      .select()
      .from(fertilizers)
      .where(eq(fertilizers.locationId, parsed.data.locationId))
      .orderBy(asc(fertilizers.name))
      .all();
  });

  // GET /api/locations/:locationId/fertilizers/:id
  app.get<{ Params: { locationId: string; id: string } }>("/:id", async (request, reply) => {
    const locParsed = locationIdParamSchema.safeParse(request.params);
    const idParsed = idParamSchema.safeParse(request.params);
    if (!locParsed.success || !idParsed.success) return reply.status(400).send({ error: "Invalid params" });

    const result = await db.query.fertilizers.findFirst({
      where: and(
        eq(fertilizers.id, idParsed.data.id),
        eq(fertilizers.locationId, locParsed.data.locationId),
      ),
    });
    if (!result) return reply.status(404).send({ error: "Fertilizer not found" });
    return result;
  });

  // POST /api/locations/:locationId/fertilizers
  app.post<{ Params: { locationId: string } }>("/", async (request, reply) => {
    const locParsed = locationIdParamSchema.safeParse(request.params);
    if (!locParsed.success) return reply.status(400).send({ error: "Invalid location ID" });

    const bodyParsed = createSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid body" });
    }

    const result = db
      .insert(fertilizers)
      .values({ ...bodyParsed.data, locationId: locParsed.data.locationId })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /api/locations/:locationId/fertilizers/:id
  app.put<{ Params: { locationId: string; id: string } }>("/:id", async (request, reply) => {
    const locParsed = locationIdParamSchema.safeParse(request.params);
    const idParsed = idParamSchema.safeParse(request.params);
    if (!locParsed.success || !idParsed.success) return reply.status(400).send({ error: "Invalid params" });

    const bodyParsed = updateSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid body" });
    }

    const existing = await db.query.fertilizers.findFirst({
      where: and(
        eq(fertilizers.id, idParsed.data.id),
        eq(fertilizers.locationId, locParsed.data.locationId),
      ),
    });
    if (!existing) return reply.status(404).send({ error: "Fertilizer not found" });

    const result = db
      .update(fertilizers)
      .set({ ...bodyParsed.data, updatedAt: new Date().toISOString() })
      .where(eq(fertilizers.id, idParsed.data.id))
      .returning()
      .get();

    return result;
  });

  // DELETE /api/locations/:locationId/fertilizers/:id
  app.delete<{ Params: { locationId: string; id: string } }>("/:id", async (request, reply) => {
    const locParsed = locationIdParamSchema.safeParse(request.params);
    const idParsed = idParamSchema.safeParse(request.params);
    if (!locParsed.success || !idParsed.success) return reply.status(400).send({ error: "Invalid params" });

    const existing = await db.query.fertilizers.findFirst({
      where: and(
        eq(fertilizers.id, idParsed.data.id),
        eq(fertilizers.locationId, locParsed.data.locationId),
      ),
    });
    if (!existing) return reply.status(404).send({ error: "Fertilizer not found" });

    db.delete(fertilizers).where(eq(fertilizers.id, idParsed.data.id)).run();
    return reply.status(204).send();
  });
}
```

**Step 2: Register in index.ts**

Add import:
```typescript
import { fertilizerRoutes } from "./routes/fertilizers.js";
```

Add registration (after shopping list, line ~56):
```typescript
await app.register(fertilizerRoutes, { prefix: "/api/locations/:locationId/fertilizers" });
```

**Step 3: Run tests, verify TypeScript compiles**

```bash
pnpm test && cd server && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add server/src/routes/fertilizers.ts server/src/index.ts
git commit -m "feat: fertilizer CRUD API routes"
```

---

### Task 3: Fertilizer API route tests

**Files:**
- Create: `server/src/routes/fertilizers.test.ts`

**Step 1: Write integration tests following care-tasks.test.ts pattern**

Use Fastify `inject()` to test all 5 endpoints:
- GET list returns empty array initially
- POST creates a fertilizer, returns 201
- GET by id returns the created fertilizer
- PUT updates name and status
- DELETE removes it, subsequent GET returns 404
- POST with invalid body returns 400
- GET/PUT/DELETE with nonexistent id returns 404

**Step 2: Run tests**

```bash
cd server && pnpm test
```

**Step 3: Commit**

```bash
git add server/src/routes/fertilizers.test.ts
git commit -m "test: fertilizer API route integration tests"
```

---

### Task 4: Frontend API client + hooks for fertilizers

**Files:**
- Modify: `web/src/api/index.ts`
- Modify: `server/src/db/types.ts` (add Fertilizer to exports if not done)

**Step 1: Add type exports to web/src/api/index.ts**

In the type re-export block (line ~49):
```typescript
export type {
  // ... existing
  Fertilizer,
} from "server/types";
```

And in the import block (line ~75):
```typescript
import type {
  // ... existing
  Fertilizer,
} from "server/types";
```

**Step 2: Add API functions**

After the shopping list functions, add:

```typescript
// ---------- Fertilizers (Shed) ----------

export function getFertilizers(locationId: number) {
  return request<Fertilizer[]>(`/locations/${locationId}/fertilizers`);
}

export function getFertilizer(locationId: number, id: number) {
  return request<Fertilizer>(`/locations/${locationId}/fertilizers/${id}`);
}

export function createFertilizer(locationId: number, data: Partial<Fertilizer>) {
  return post<Fertilizer>(`/locations/${locationId}/fertilizers`, data);
}

export function updateFertilizer(locationId: number, id: number, data: Partial<Fertilizer>) {
  return put<Fertilizer>(`/locations/${locationId}/fertilizers/${id}`, data);
}

export function deleteFertilizer(locationId: number, id: number) {
  return del(`/locations/${locationId}/fertilizers/${id}`);
}
```

**Step 3: Add TanStack Query hooks**

In the hooks file (find by pattern — likely `web/src/api/hooks.ts` or inline), add:

```typescript
export function useFertilizers(locationId: number | undefined) {
  return useQuery({
    queryKey: ["fertilizers", locationId],
    queryFn: () => api.getFertilizers(locationId!),
    enabled: locationId !== undefined,
  });
}

export function useCreateFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Fertilizer>) => api.createFertilizer(locationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}

export function useUpdateFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Fertilizer> }) =>
      api.updateFertilizer(locationId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}

export function useDeleteFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteFertilizer(locationId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add web/src/api/index.ts web/src/api/hooks.ts
git commit -m "feat: fertilizer API client and TanStack Query hooks"
```

---

### Task 5: Shed page + navigation

**Files:**
- Create: `web/src/pages/Shed.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`

**Step 1: Create the Shed page**

The Shed page shows a "Fertilizers" tab (only tab for now, extensible later). It lists fertilizer cards with name, type badge, NPK if set, organic badge, status pill. Add/edit via modal or inline form. Empty state message.

Key patterns from existing pages:
- Use `useParams()` to get locationId (route: `/locations/:id/shed`)
- Use `useFertilizers(locationId)` hook
- Use `useCreateFertilizer`, `useUpdateFertilizer`, `useDeleteFertilizer` mutations
- Card layout matching existing pages
- Status pills: `have_it` = green, `running_low` = amber, `out` = red
- Type displayed as badge (capitalize, replace underscores)
- NPK displayed as "N-P-K" if any values set
- Organic badge if true
- Lucide icons: `Warehouse` for page header, `Plus`, `Pencil`, `Trash2` for actions

Form fields for add/edit:
- name (text, required)
- type (select dropdown)
- npkN, npkP, npkK (number inputs, optional)
- organic (checkbox)
- status (select: have_it, running_low, out)
- notes (textarea, optional)

**Step 2: Add route to App.tsx**

```typescript
import Shed from "./pages/Shed";
// In Routes:
<Route path="/locations/:id/shed" element={<Shed />} />
```

**Step 3: Add nav item to Sidebar.tsx**

Import `Warehouse` from lucide-react. Add to navItems array after Shopping:

```typescript
{ to: "/locations/2/shed", icon: Warehouse, label: "Shed" },
```

Note: hardcoded to location 2 for now (matches user's property). The proper fix would be a location context, but that's out of scope.

**Step 4: Verify it renders, TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add web/src/pages/Shed.tsx web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat: Shed page with fertilizer inventory UI"
```

---

### Task 6: Care task fertilizer nudge

**Files:**
- Modify: `web/src/pages/CareTasks.tsx` (or wherever care task detail is rendered)

**Step 1: Add nudge component**

When a care task has `taskType === "fertilize"` and the plant instance has a `plantReference` with `fertilizerType` set:
1. Query the user's fertilizer inventory for that type where `status !== "out"`
2. If no match, show an inline banner:
   - "You don't have any [type] fertilizer. Add to shopping list?"
   - Button that creates a shopping list item with category "fertilizer" and the plant's fertilizerNotes as name

Use existing hooks: `useFertilizers(locationId)` to check inventory, shopping list mutation to add item.

**Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add web/src/pages/CareTasks.tsx
git commit -m "feat: fertilizer shopping list nudge on care tasks"
```

---

### Task 7: Almanac page + Composting Guide

**Files:**
- Create: `web/src/pages/Almanac.tsx`
- Create: `web/src/pages/almanac/CompostingGuide.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`

**Step 1: Create the Almanac index page**

Simple grid of guide cards. Each card links to a guide detail page. First card: "Composting Guide" with a brief description. Route: `/almanac`.

**Step 2: Create the Composting Guide page**

Route: `/almanac/composting`. A well-structured reference page with these sections:

1. **Compost vs. Fertilizer** — Compost feeds the soil, fertilizer feeds the plant. Use compost for general soil health, fertilizer for targeted nutrient needs, both for heavy feeders.

2. **Compost Types & NPK**

   | Type | N | P | K | Notes |
   |------|---|---|---|-------|
   | Finished compost | 1-3 | 0.5-2 | 1-2 | Varies by inputs |
   | Worm castings | ~1 | ~0 | ~0 | Great for microbes |
   | Rabbit manure | 2.4 | 1.4 | 0.6 | Cold — safe for direct use |
   | Chicken manure | 1.1 | 0.8 | 0.5 | Hot — must compost first |
   | Horse manure | 0.5 | 0.3 | 0.4 | Hot — often has weed seeds |
   | Mushroom compost | 0.7 | 0.3 | 0.3 | Tends alkaline |

3. **Rabbit Poop Compost** — NPK 2.4-1.4-0.6, cold manure (direct application safe), year-round use, 30-45 days to fully compost if preferred, don't let pellets touch stems, excess nitrogen can fork root crops.

4. **Compost Tea** — Aerated (24-48hrs with pump, use within 4hrs) vs non-aerated (3-5 days in bucket). Negligible NPK (~0.07-0.02-0.05). Primary value is beneficial microbes. Apply as soil drench or filtered foliar spray every 2-4 weeks. Note: scientific evidence for disease suppression is mixed.

5. **Compost Tea vs Extract vs Liquid Fertilizer** — Tea breeds microbes (needs pump, 24-48hrs). Extract soaks nutrients (bucket, 1-4hrs). Liquid fertilizer delivers targeted NPK. Not interchangeable.

6. **Application Methods** — Topdressing (preferred, preserves soil structure) vs tilling (for new/compacted beds). 1-2 inches annually for beds. Apply in fall or early spring.

7. **Which Plants Love Compost** — Heavy feeders: tomatoes, peppers, corn, roses, hydrangeas. Be careful with: succulents/cacti, Mediterranean herbs, blueberries (prefer acid), legumes (fix own N), root crops (excess N forks roots).

Style: dark theme consistent with app, Space Grotesk headings, prose content in `text-stone-300`, tables in card containers.

**Step 3: Add routes to App.tsx**

```typescript
import Almanac from "./pages/Almanac";
import CompostingGuide from "./pages/almanac/CompostingGuide";
// In Routes:
<Route path="/almanac" element={<Almanac />} />
<Route path="/almanac/composting" element={<CompostingGuide />} />
```

**Step 4: Add nav item to Sidebar.tsx**

Import `BookOpen` from lucide-react. Add to navItems after Shed:

```typescript
{ to: "/almanac", icon: BookOpen, label: "Almanac" },
```

**Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add web/src/pages/Almanac.tsx web/src/pages/almanac/ web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat: Almanac page with Composting Guide"
```

---

### Task 8: Seed data — fertilizer fields on plant references

**Files:**
- Modify: `server/src/db/seed.ts`

**Step 1: Add fertilizerType, fertilizerNpk, fertilizerFrequency, fertilizerNotes to existing plant reference seeds**

Key plants to update (based on user's 60+ plant collection):
- **Roses**: liquid, "10-10-10", "Every 2-3 weeks spring through fall", "Feed after first bloom cycle"
- **Hydrangeas**: granular, "10-10-10", "Once in spring, once in early summer", "For blue blooms use acidic fertilizer"
- **Blueberries**: granular, "4-3-6", "Early spring and after harvest", "Acid-loving — use azalea/rhododendron fertilizer"
- **Herbs (rosemary, thyme)**: null type, null npk, null freq, "Minimal fertilizer needed — lean soil preferred"
- **Fothergilla**: slow_release, "10-10-10", "Once in early spring", null
- **Hostas**: granular, "10-10-10", "Once in spring as shoots emerge", null
- **Succulents**: liquid, "2-7-7", "Monthly spring and summer only", "Dilute to half strength, no winter feeding"
- **Sweet Woodruff**: null, null, null, "No fertilizer needed — thrives in poor soil"
- **Agapanthus**: liquid, "10-10-10", "Every 2 weeks spring through summer", "Heavy feeder in containers"
- **Clematis**: granular, "5-10-10", "Early spring and after first flush", "Bloom-boosting phosphorus"
- **Honeysuckle**: compost, null, "Topdress with compost in spring", "Avoid high-nitrogen — promotes leaf over bloom"

**Step 2: Run seed (if applicable) and verify**

```bash
cd server && pnpm db:migrate
```

**Step 3: Commit**

```bash
git add server/src/db/seed.ts
git commit -m "feat: fertilizer guidance data on plant reference seeds"
```

---

### Task 9: Enhanced care task generation

**Files:**
- Modify: `server/src/services/care-tasks.ts`

**Step 1: Update fertilize task generation**

Currently (line ~238-264): only generates fertilize task if `bloomTime` is set.

Add a second branch: if `fertilizerType` or `fertilizerFrequency` is set on the plant reference, generate a fertilize task with specific guidance even without bloomTime:

```typescript
// ── Fertilize — enhanced guidance from plant reference ─────────────────────
if (!existingTypes.has("fertilize")) {
  if (plantRef.bloomTime) {
    // existing bloom-based logic unchanged
  } else if (plantRef.fertilizerType || plantRef.fertilizerFrequency) {
    // New: generate from structured fertilizer data
    const desc = [
      plantRef.fertilizerFrequency ?? "Feed during growing season",
      plantRef.fertilizerNpk ? `Use ${plantRef.fertilizerNpk} ratio` : null,
      plantRef.fertilizerType ? `Preferred type: ${plantRef.fertilizerType.replace(/_/g, " ")}` : null,
      plantRef.fertilizerNotes,
    ].filter(Boolean).join(". ") + ".";

    tasks.push({
      plantInstanceId: plantInstance.id,
      taskType: "fertilize",
      title: `Fertilize ${plantName}`,
      description: desc,
      dueDate: nextDateForMonth(4), // April — start of growing season
      isRecurring: true,
      intervalDays: 30,
      activeMonths: GROWING_SEASON,
      sendNotification: true,
      plantMessage: randomMessage(FERTILIZE_MESSAGES),
    });
  }
}
```

**Step 2: Run tests**

```bash
pnpm test
```

**Step 3: Commit**

```bash
git add server/src/services/care-tasks.ts
git commit -m "feat: enhanced fertilize task generation from plant reference data"
```
