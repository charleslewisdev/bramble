# Plant Journal & Photo System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-plant care journal with photo thumbnails, status check tasks, and fix Docker photo persistence.

**Architecture:** New `journalEntries` + `journalPhotos` tables linked to existing `plantPhotos` and `careTaskLogs`. Sharp for server-side thumbnails. New Fastify route module for journal CRUD. React timeline component on plant detail page.

**Tech Stack:** Drizzle ORM migrations, sharp (image processing), Fastify routes, React + TanStack Query, Tailwind CSS

---

### Task 1: Fix Docker photo persistence

**Files:**
- Modify: `Dockerfile:33-38`
- Modify: `docker-compose.yml:10-12`

**Step 1: Add PHOTOS_DIR env to Dockerfile**

In `Dockerfile`, after the `ENV DATABASE_URL=/data/bramble.db` line, add:

```dockerfile
ENV PHOTOS_DIR=/data/photos
```

**Step 2: Add PHOTOS_DIR to docker-compose.yml**

In `docker-compose.yml`, in the environment section, add:

```yaml
- PHOTOS_DIR=/data/photos
```

**Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "fix: persist photos to /data volume in Docker"
```

---

### Task 2: Add missing GET /api/photos list endpoint

**Files:**
- Modify: `server/src/routes/photos.ts:60-107`
- Create: `server/src/routes/photos.test.ts`

**Step 1: Write the failing test**

Create `server/src/routes/photos.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { photoRoutes } from "./photos.js";

// We test the GET endpoint returns photos filtered by plantInstanceId
// The full integration test requires DB setup, so we test route registration
describe("photo routes", () => {
  it("GET / with plantInstanceId query param returns 200", async () => {
    const app = Fastify();
    await app.register(photoRoutes, { prefix: "/api/photos" });

    const res = await app.inject({
      method: "GET",
      url: "/api/photos?plantInstanceId=1",
    });

    // Will return empty array or error depending on DB state
    // Key thing: the route EXISTS and doesn't 404
    expect(res.statusCode).not.toBe(404);
    await app.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/photos.test.ts`
Expected: FAIL — route not found, returns 404

**Step 3: Implement GET / endpoint**

In `server/src/routes/photos.ts`, inside the `photoRoutes` function, add before the POST handler:

```typescript
// GET / - list photos for a plant instance
app.get<{ Querystring: { plantInstanceId?: string } }>("/", async (request, reply) => {
  const { plantInstanceId } = request.query;
  if (!plantInstanceId) {
    return reply.status(400).send({ error: "plantInstanceId query parameter is required" });
  }
  const id = Number(plantInstanceId);
  if (isNaN(id) || id <= 0) {
    return reply.status(400).send({ error: "Invalid plantInstanceId" });
  }
  const photos = db
    .select()
    .from(plantPhotos)
    .where(eq(plantPhotos.plantInstanceId, id))
    .all();
  return photos;
});
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/photos.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/photos.ts server/src/routes/photos.test.ts
git commit -m "fix: add missing GET /api/photos list endpoint"
```

---

### Task 3: Install sharp and add thumbnail generation

**Files:**
- Modify: `server/package.json` (via pnpm add)
- Modify: `server/src/routes/photos.ts`
- Create: `server/src/services/thumbnails.ts`
- Create: `server/src/services/thumbnails.test.ts`

**Step 1: Install sharp**

```bash
cd /home/carrot/code/bramble && pnpm --filter server add sharp && pnpm --filter server add -D @types/sharp
```

**Step 2: Write the thumbnail service test**

Create `server/src/services/thumbnails.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateThumbnail } from "./thumbnails.js";
import { mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const TEST_DIR = resolve(import.meta.dirname, "../../test-photos");

describe("generateThumbnail", () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("creates a thumbnail file with _thumb suffix", async () => {
    // Create a test image with sharp
    const testImage = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer();

    const filename = "test-image.jpg";
    writeFileSync(resolve(TEST_DIR, filename), testImage);

    const thumbFilename = await generateThumbnail(TEST_DIR, filename, 400);

    expect(thumbFilename).toBe("test-image_thumb.jpg");
    expect(existsSync(resolve(TEST_DIR, thumbFilename))).toBe(true);

    // Verify thumbnail dimensions
    const meta = await sharp(resolve(TEST_DIR, thumbFilename)).metadata();
    expect(meta.width).toBeLessThanOrEqual(400);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/thumbnails.test.ts`
Expected: FAIL — module not found

**Step 4: Implement thumbnail service**

Create `server/src/services/thumbnails.ts`:

```typescript
import sharp from "sharp";
import { resolve } from "path";

/**
 * Generate a thumbnail for an image file.
 * Returns the thumbnail filename (original name with _thumb suffix).
 */
export async function generateThumbnail(
  photosDir: string,
  filename: string,
  maxWidth: number = 400,
): Promise<string> {
  const ext = filename.substring(filename.lastIndexOf("."));
  const base = filename.substring(0, filename.lastIndexOf("."));
  const thumbFilename = `${base}_thumb${ext}`;

  await sharp(resolve(photosDir, filename))
    .resize(maxWidth, undefined, { fit: "inside", withoutEnlargement: true })
    .toFile(resolve(photosDir, thumbFilename));

  return thumbFilename;
}
```

**Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/thumbnails.test.ts`
Expected: PASS

**Step 6: Integrate thumbnail generation into photo upload**

In `server/src/routes/photos.ts`:

1. Add import: `import { generateThumbnail } from "../services/thumbnails.js";`
2. After `writeFileSync(resolve(PHOTOS_DIR, filename), buffer);` (line 94), add:

```typescript
// Generate thumbnail
let thumbnailFilename: string | null = null;
try {
  thumbnailFilename = await generateThumbnail(PHOTOS_DIR, filename);
} catch (err) {
  // Thumbnail generation is non-critical — log and continue
  request.log.warn({ err, filename }, "Thumbnail generation failed");
}
```

3. Update the insert to include thumbnailFilename (this requires the schema change in Task 4, so just prepare the code — the column will be added next).

**Step 7: Commit**

```bash
git add server/src/services/thumbnails.ts server/src/services/thumbnails.test.ts server/package.json pnpm-lock.yaml
git commit -m "feat: add sharp thumbnail generation service"
```

---

### Task 4: Database migration — thumbnails, journal tables, status_check task type

**Files:**
- Modify: `server/src/db/schema.ts`
- New migration will be auto-generated by Drizzle

**Step 1: Add thumbnailFilename to plantPhotos in schema**

In `server/src/db/schema.ts`, in the `plantPhotos` table definition, after the `caption` column:

```typescript
thumbnailFilename: text("thumbnail_filename"),
```

**Step 2: Add `status_check` to careTasks taskType enum**

In `server/src/db/schema.ts`, in the `careTasks` table `taskType` enum array, add `"status_check"` after `"inspect"`:

```typescript
taskType: text("task_type", {
  enum: [
    "water", "fertilize", "prune", "mulch", "harvest",
    "protect", "move", "repot", "inspect", "status_check", "custom",
  ],
}).notNull(),
```

**Step 3: Add journalEntries table to schema**

In `server/src/db/schema.ts`, after the `careTaskLogs` section:

```typescript
// ─── Journal Entries ──────────────────────────────────────────────────────────

export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantInstanceId: integer("plant_instance_id").references(() => plantInstances.id, {
    onDelete: "cascade",
  }),
  zoneId: integer("zone_id").references(() => zones.id, { onDelete: "set null" }),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  entryType: text("entry_type", {
    enum: ["observation", "status_check", "care_log", "milestone", "identification"],
  }).notNull(),
  title: text("title"),
  body: text("body"),
  careTaskLogId: integer("care_task_log_id").references(() => careTaskLogs.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("journal_entries_plant_instance_id_idx").on(table.plantInstanceId),
  index("journal_entries_zone_id_idx").on(table.zoneId),
  index("journal_entries_location_id_idx").on(table.locationId),
  index("journal_entries_created_at_idx").on(table.createdAt),
]);

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  plantInstance: one(plantInstances, {
    fields: [journalEntries.plantInstanceId],
    references: [plantInstances.id],
  }),
  zone: one(zones, {
    fields: [journalEntries.zoneId],
    references: [zones.id],
  }),
  location: one(locations, {
    fields: [journalEntries.locationId],
    references: [locations.id],
  }),
  careTaskLog: one(careTaskLogs, {
    fields: [journalEntries.careTaskLogId],
    references: [careTaskLogs.id],
  }),
  photos: many(journalPhotos),
}));

// ─── Journal Photos (join table) ─────────────────────────────────────────────

export const journalPhotos = sqliteTable("journal_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journalEntryId: integer("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id, { onDelete: "cascade" }),
  plantPhotoId: integer("plant_photo_id")
    .notNull()
    .references(() => plantPhotos.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const journalPhotosRelations = relations(journalPhotos, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalPhotos.journalEntryId],
    references: [journalEntries.id],
  }),
  plantPhoto: one(plantPhotos, {
    fields: [journalPhotos.plantPhotoId],
    references: [plantPhotos.id],
  }),
}));
```

**Step 4: Add type exports**

In `server/src/db/schema.ts`, in the type exports section:

```typescript
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalPhoto = typeof journalPhotos.$inferSelect;
```

**Step 5: Update types.ts**

In `server/src/db/types.ts`:

1. Add to the re-export block: `JournalEntry, NewJournalEntry, JournalPhoto`
2. Add `"status_check"` to the `CareTaskType` union
3. Add `JournalEntryType` type:

```typescript
export type JournalEntryType = "observation" | "status_check" | "care_log" | "milestone" | "identification";
```

4. Add `JournalEntryWithRelations`:

```typescript
import type { JournalEntry, JournalPhoto, PlantPhoto } from "./schema.js";

export interface JournalEntryWithRelations extends JournalEntry {
  photos?: (JournalPhoto & { plantPhoto?: PlantPhoto })[];
  careTaskLog?: import("./schema.js").CareTaskLog;
}
```

**Step 6: Generate and apply migration**

```bash
cd /home/carrot/code/bramble/server && npx drizzle-kit generate
```

Review the generated SQL to make sure it creates the new tables and adds the new column.

**Step 7: Verify migration applies**

```bash
cd /home/carrot/code/bramble && pnpm --filter server build && node -e "import('./server/dist/db/index.js')"
```

**Step 8: Commit**

```bash
git add server/src/db/schema.ts server/src/db/types.ts server/drizzle/
git commit -m "feat: add journal tables, thumbnail column, status_check task type"
```

---

### Task 5: Wire thumbnail into photo upload route

**Files:**
- Modify: `server/src/routes/photos.ts`

**Step 1: Update photo upload to save thumbnail and include thumbnailFilename in response**

In `server/src/routes/photos.ts`, update the POST handler:

1. Add import at top: `import { generateThumbnail } from "../services/thumbnails.js";`
2. After `writeFileSync(resolve(PHOTOS_DIR, filename), buffer);`, add thumbnail generation
3. Update the `db.insert(plantPhotos).values()` call to include `thumbnailFilename`

The full updated POST handler body after the `writeFileSync` line:

```typescript
// Generate thumbnail
let thumbnailFilename: string | null = null;
try {
  thumbnailFilename = await generateThumbnail(PHOTOS_DIR, filename);
} catch (err) {
  request.log.warn({ err, filename }, "Thumbnail generation failed");
}

const result = db
  .insert(plantPhotos)
  .values({
    plantInstanceId,
    filename,
    thumbnailFilename,
    caption: caption ?? null,
  })
  .returning()
  .get();

return reply.status(201).send(result);
```

**Step 2: Update GET /file/:filename to also serve thumbnails**

No change needed — the existing file serving endpoint already serves any file by filename, so thumbnail files are served the same way.

**Step 3: Run existing tests**

```bash
cd /home/carrot/code/bramble && pnpm test
```

**Step 4: Commit**

```bash
git add server/src/routes/photos.ts
git commit -m "feat: generate thumbnails on photo upload"
```

---

### Task 6: Journal API routes

**Files:**
- Create: `server/src/routes/journal.ts`
- Create: `server/src/routes/journal.test.ts`
- Modify: `server/src/index.ts` (register route)

**Step 1: Write integration test for journal routes**

Create `server/src/routes/journal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { journalRoutes } from "./journal.js";

describe("journal routes", () => {
  it("GET / requires plantInstanceId", async () => {
    const app = Fastify();
    await app.register(journalRoutes, { prefix: "/api/journal" });

    const res = await app.inject({ method: "GET", url: "/api/journal" });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("POST / validates required fields", async () => {
    const app = Fastify();
    await app.register(journalRoutes, { prefix: "/api/journal" });

    const res = await app.inject({
      method: "POST",
      url: "/api/journal",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/journal.test.ts`
Expected: FAIL — module not found

**Step 3: Implement journal routes**

Create `server/src/routes/journal.ts`:

```typescript
import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { journalEntries, journalPhotos, plantPhotos, plantInstances } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { idParamSchema } from "../lib/validation.js";

const entryTypeEnum = z.enum(["observation", "status_check", "care_log", "milestone", "identification"]);

const createJournalSchema = z.object({
  plantInstanceId: z.number().int().positive().nullable().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  locationId: z.number().int().positive().nullable().optional(),
  entryType: entryTypeEnum,
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  careTaskLogId: z.number().int().positive().nullable().optional(),
  photoIds: z.array(z.number().int().positive()).optional(),
});

const updateJournalSchema = z.object({
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  photoIds: z.array(z.number().int().positive()).optional(),
});

export async function journalRoutes(app: FastifyInstance) {
  // GET / - list journal entries for a plant
  app.get<{ Querystring: { plantInstanceId?: string; limit?: string; offset?: string } }>(
    "/",
    async (request, reply) => {
      const { plantInstanceId, limit: limitStr, offset: offsetStr } = request.query;
      if (!plantInstanceId) {
        return reply.status(400).send({ error: "plantInstanceId query parameter is required" });
      }
      const id = Number(plantInstanceId);
      if (isNaN(id) || id <= 0) {
        return reply.status(400).send({ error: "Invalid plantInstanceId" });
      }

      const limit = Math.min(Number(limitStr) || 50, 100);
      const offset = Number(offsetStr) || 0;

      const entries = await db.query.journalEntries.findMany({
        where: eq(journalEntries.plantInstanceId, id),
        with: {
          photos: {
            with: { plantPhoto: true },
            orderBy: (jp, { asc }) => [asc(jp.sortOrder)],
          },
          careTaskLog: true,
        },
        orderBy: [desc(journalEntries.createdAt)],
        limit,
        offset,
      });

      return entries;
    },
  );

  // GET /:id - single journal entry
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const entry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        photos: {
          with: { plantPhoto: true },
          orderBy: (jp, { asc }) => [asc(jp.sortOrder)],
        },
        careTaskLog: true,
      },
    });

    if (!entry) {
      return reply.status(404).send({ error: "Journal entry not found" });
    }
    return entry;
  });

  // POST / - create journal entry
  app.post("/", async (request, reply) => {
    const parsed = createJournalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const { photoIds, ...entryData } = parsed.data;

    // Must have at least one scope
    if (!entryData.plantInstanceId && !entryData.zoneId && !entryData.locationId) {
      return reply.status(400).send({ error: "At least one of plantInstanceId, zoneId, or locationId is required" });
    }

    // Verify plant exists if provided
    if (entryData.plantInstanceId) {
      const plant = await db.query.plantInstances.findFirst({
        where: eq(plantInstances.id, entryData.plantInstanceId),
      });
      if (!plant) {
        return reply.status(404).send({ error: "Plant instance not found" });
      }
    }

    const entry = db
      .insert(journalEntries)
      .values(entryData)
      .returning()
      .get();

    // Link photos if provided
    if (photoIds && photoIds.length > 0) {
      for (let i = 0; i < photoIds.length; i++) {
        db.insert(journalPhotos)
          .values({
            journalEntryId: entry.id,
            plantPhotoId: photoIds[i]!,
            sortOrder: i,
          })
          .run();
      }
    }

    // Return with photos
    const result = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, entry.id),
      with: {
        photos: {
          with: { plantPhoto: true },
          orderBy: (jp, { asc }) => [asc(jp.sortOrder)],
        },
      },
    });

    return reply.status(201).send(result);
  });

  // PUT /:id - update journal entry
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateJournalSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
    });
    if (!existing) {
      return reply.status(404).send({ error: "Journal entry not found" });
    }

    const { photoIds, ...updateData } = bodyParsed.data;

    db.update(journalEntries)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(journalEntries.id, id))
      .run();

    // Replace photo links if photoIds provided
    if (photoIds !== undefined) {
      db.delete(journalPhotos).where(eq(journalPhotos.journalEntryId, id)).run();
      for (let i = 0; i < photoIds.length; i++) {
        db.insert(journalPhotos)
          .values({
            journalEntryId: id,
            plantPhotoId: photoIds[i]!,
            sortOrder: i,
          })
          .run();
      }
    }

    const result = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        photos: {
          with: { plantPhoto: true },
          orderBy: (jp, { asc }) => [asc(jp.sortOrder)],
        },
      },
    });

    return result;
  });

  // DELETE /:id
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const existing = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
    });
    if (!existing) {
      return reply.status(404).send({ error: "Journal entry not found" });
    }

    db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
    return reply.status(204).send();
  });
}
```

**Step 4: Register route in server/src/index.ts**

Add import: `import { journalRoutes } from "./routes/journal.js";`

Add registration after photoRoutes: `await app.register(journalRoutes, { prefix: "/api/journal" });`

**Step 5: Run tests**

Run: `cd server && npx vitest run src/routes/journal.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/src/routes/journal.ts server/src/routes/journal.test.ts server/src/index.ts
git commit -m "feat: add journal CRUD API routes"
```

---

### Task 7: Auto-create journal entries on care task completion

**Files:**
- Modify: `server/src/routes/care-tasks.ts:199-252`

**Step 1: Import journalEntries in care-tasks.ts**

Add to imports: `import { journalEntries } from "../db/schema.js";`

**Step 2: After inserting the care task log (line 229), add journal entry creation**

After the `const log = db.insert(careTaskLogs)...` block:

```typescript
// Auto-create journal entry for the care task completion
const taskTitle = existing.title || existing.taskType;
const plantName = existing.plantInstanceId ? "plant" : "zone";
db.insert(journalEntries)
  .values({
    plantInstanceId: existing.plantInstanceId,
    zoneId: existing.zoneId,
    locationId: existing.locationId,
    entryType: "care_log",
    title: taskTitle,
    body: bodyParsed.data.notes || null,
    careTaskLogId: log.id,
  })
  .run();
```

If the log has a photoId, also link it:

```typescript
if (bodyParsed.data.photoId) {
  const journalEntry = db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.careTaskLogId, log.id))
    .get();
  if (journalEntry) {
    db.insert(journalPhotos)
      .values({
        journalEntryId: journalEntry.id,
        plantPhotoId: bodyParsed.data.photoId,
        sortOrder: 0,
      })
      .run();
  }
}
```

**Step 3: Add `journalEntries` and `journalPhotos` to the import from schema**

Update the import line: `import { careTasks, careTaskLogs, plantInstances, zones, journalEntries, journalPhotos } from "../db/schema.js";`

**Step 4: Run all server tests**

```bash
cd /home/carrot/code/bramble && pnpm --filter server test
```

**Step 5: Commit**

```bash
git add server/src/routes/care-tasks.ts
git commit -m "feat: auto-create journal entries on care task completion"
```

---

### Task 8: Add status_check to care task generation and validation

**Files:**
- Modify: `server/src/routes/care-tasks.ts:9-12`
- Modify: `server/src/services/care-tasks.ts`
- Modify: `server/src/db/types.ts`

**Step 1: Update taskTypeEnum in care-tasks.ts route validation**

In `server/src/routes/care-tasks.ts`, update the `taskTypeEnum`:

```typescript
const taskTypeEnum = z.enum([
  "water", "fertilize", "prune", "mulch", "harvest",
  "protect", "move", "repot", "inspect", "status_check", "custom",
]);
```

**Step 2: Add status_check to care task generation service**

In `server/src/services/care-tasks.ts`, in the `generateDefaultCareTasks` function, add a status check task that recurs every 90 days:

```typescript
// Status check — recurring every 90 days
if (!existingTaskTypes.includes("status_check")) {
  tasks.push({
    plantInstanceId: instance.id,
    zoneId: instance.zoneId,
    taskType: "status_check",
    title: `Status check: ${ref?.commonName ?? instance.nickname ?? "plant"}`,
    description: "Time to check on this plant! Update its status and snap a photo.",
    dueDate: addDaysToDate(new Date(), 90),
    isRecurring: true,
    intervalDays: 90,
    sendNotification: true,
    plantMessage: "How am I doing? Take a look and let me know! 📸",
  });
}
```

**Step 3: Update notification preferences to include status_check**

In `server/src/db/schema.ts`, update `notificationPreferences.taskType` enum to include `"status_check"`.

**Step 4: Run all tests**

```bash
cd /home/carrot/code/bramble && pnpm --filter server test
```

**Step 5: Commit**

```bash
git add server/src/routes/care-tasks.ts server/src/services/care-tasks.ts server/src/db/schema.ts server/src/db/types.ts
git commit -m "feat: add status_check care task type with 90-day recurrence"
```

---

### Task 9: Frontend API client and hooks for journal

**Files:**
- Modify: `web/src/api/index.ts`
- Modify: `web/src/api/hooks.ts`

**Step 1: Add journal types and API functions to index.ts**

In `web/src/api/index.ts`, add after the Photos section:

```typescript
// ---------- Journal ----------

export interface JournalPhoto {
  id: number;
  journalEntryId: number;
  plantPhotoId: number;
  sortOrder: number;
  plantPhoto?: PlantPhoto;
}

export interface JournalEntry {
  id: number;
  plantInstanceId: number | null;
  zoneId: number | null;
  locationId: number | null;
  entryType: "observation" | "status_check" | "care_log" | "milestone" | "identification";
  title: string | null;
  body: string | null;
  careTaskLogId: number | null;
  photos?: JournalPhoto[];
  createdAt: string;
  updatedAt: string;
}

export function getJournalEntries(plantInstanceId: number, limit?: number, offset?: number) {
  const sp = new URLSearchParams({ plantInstanceId: String(plantInstanceId) });
  if (limit) sp.set("limit", String(limit));
  if (offset) sp.set("offset", String(offset));
  return request<JournalEntry[]>(`/journal?${sp}`);
}

export function getJournalEntry(id: number) {
  return request<JournalEntry>(`/journal/${id}`);
}

export function createJournalEntry(data: {
  plantInstanceId?: number | null;
  zoneId?: number | null;
  locationId?: number | null;
  entryType: string;
  title?: string | null;
  body?: string | null;
  photoIds?: number[];
}) {
  return post<JournalEntry>("/journal", data);
}

export function updateJournalEntry(id: number, data: {
  title?: string | null;
  body?: string | null;
  photoIds?: number[];
}) {
  return put<JournalEntry>(`/journal/${id}`, data);
}

export function deleteJournalEntry(id: number) {
  return del(`/journal/${id}`);
}
```

**Step 2: Add hooks to hooks.ts**

In `web/src/api/hooks.ts`, add after the Photos section:

```typescript
// ---------- Journal ----------

export function useJournalEntries(plantInstanceId: number | undefined, limit?: number) {
  return useQuery<api.JournalEntry[]>({
    queryKey: ["journal", plantInstanceId, limit],
    queryFn: () => api.getJournalEntries(plantInstanceId!, limit),
    enabled: plantInstanceId !== undefined,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createJournalEntry>[0]) =>
      api.createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
    },
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateJournalEntry>[1] }) =>
      api.updateJournalEntry(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteJournalEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}
```

**Step 3: Run web tests**

```bash
cd /home/carrot/code/bramble && pnpm --filter web test
```

**Step 4: Commit**

```bash
git add web/src/api/index.ts web/src/api/hooks.ts
git commit -m "feat: add journal API client and TanStack Query hooks"
```

---

### Task 10: Frontend — Journal timeline component

**Files:**
- Create: `web/src/components/journal/JournalTimeline.tsx`
- Create: `web/src/components/journal/JournalEntryCard.tsx`
- Create: `web/src/components/journal/AddObservationForm.tsx`

**Step 1: Create JournalEntryCard component**

This component renders a single journal entry in the timeline — icon by entry type, title, body text, inline thumbnail photos, and timestamp.

Key details:
- Entry type icon mapping: observation (Eye), care_log (CalendarCheck), status_check (ClipboardCheck), milestone (Star), identification (HelpCircle)
- Photos rendered as thumbnail grid using `/api/photos/file/{thumbnailFilename || filename}`
- Relative timestamps ("2 hours ago", "3 days ago")
- Delete button with confirmation

**Step 2: Create AddObservationForm component**

A compact form for adding freeform journal entries:
- Text area for notes/body
- Photo upload button (reuse existing base64 upload flow)
- Entry type selector (observation by default, milestone as option)
- Submit creates photo via `/api/photos`, then journal entry with photoIds

**Step 3: Create JournalTimeline component**

Wraps the entry list and add form:
- Uses `useJournalEntries(plantInstanceId)` hook
- Renders AddObservationForm at top
- Maps entries to JournalEntryCard components
- Loading/empty states

**Step 4: Run web tests + verify TypeScript**

```bash
cd /home/carrot/code/bramble && npx tsc --noEmit && pnpm --filter web test
```

**Step 5: Commit**

```bash
git add web/src/components/journal/
git commit -m "feat: add journal timeline components"
```

---

### Task 11: Integrate journal timeline into MyPlantDetail page

**Files:**
- Modify: `web/src/pages/MyPlantDetail.tsx`
- Modify: `web/src/utils/constants.ts` (add status_check to taskTypes)

**Step 1: Add status_check to taskTypes constant**

In `web/src/utils/constants.ts`, add to `taskTypes` array and `taskTypeIcons` map:
- `{ value: "status_check", label: "Status Check" }`
- Icon: `ClipboardCheck` from lucide-react

**Step 2: Add Journal tab to MyPlantDetail**

The plant detail page likely has a tab or section system. Add a "Journal" tab that renders the `JournalTimeline` component.

Import: `import JournalTimeline from "../components/journal/JournalTimeline";`

Add tab alongside existing Photos/Care Tasks sections.

**Step 3: Update photo gallery to use thumbnails**

In the photo gallery section of MyPlantDetail, update image src to prefer `thumbnailFilename`:

```typescript
src={`/api/photos/file/${photo.thumbnailFilename || photo.filename}`}
```

Keep full-size image for lightbox modal.

**Step 4: TypeScript check + visual test**

```bash
cd /home/carrot/code/bramble && npx tsc --noEmit
```

Start dev server and visually verify:
```bash
pnpm dev
```

**Step 5: Commit**

```bash
git add web/src/pages/MyPlantDetail.tsx web/src/utils/constants.ts
git commit -m "feat: integrate journal timeline into plant detail page"
```

---

### Task 12: Final verification and cleanup

**Step 1: Run all tests**

```bash
cd /home/carrot/code/bramble && pnpm test
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Verify Docker build**

```bash
docker build -t bramble-test .
```

**Step 4: Manual smoke test**

Start dev server, navigate to a plant detail page, verify:
- Photo upload creates thumbnail
- Journal timeline shows entries
- Adding observation with photo works
- Completing a care task creates journal entry
- Photos persist (thumbnail visible in gallery)

**Step 5: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "chore: cleanup and polish journal feature"
```
