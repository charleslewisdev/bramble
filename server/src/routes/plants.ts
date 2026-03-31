import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  plantReferences,
  plantInstances,
  careTasks,
  careTaskLogs,
  zones,
  weatherCache,
} from "../db/schema.js";
import { eq, like, or, and, desc, inArray, sql, count } from "drizzle-orm";
import {
  searchPerenualPlants,
  getPerenualPlantDetail,
  mapPerenualToSearchResult,
  type PlantSearchResult,
} from "../services/perenual.js";
import { z } from "zod";
import { generateDefaultCareTasks, handleStatusTransition } from "../services/care-tasks.js";
import { calculatePlantMood } from "../services/mood.js";
import { idParamSchema, parsePagination, paginatedResult } from "../lib/validation.js";

const plantTypeEnum = z.enum([
  "flower", "shrub", "tree", "herb", "grass", "fern", "succulent",
  "cactus", "vine", "aquatic", "vegetable", "fruit", "houseplant",
  "groundcover", "bulb",
]);

const sunRequirementEnum = z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]);
const waterNeedsEnum = z.enum(["low", "moderate", "high", "aquatic"]);
const growthRateEnum = z.enum(["slow", "moderate", "fast"]);
const foliageTypeEnum = z.enum(["evergreen", "deciduous", "semi-evergreen"]);
const toxicityEnum = z.enum(["safe", "caution", "toxic", "highly_toxic"]);
const spriteTypeEnum = z.enum([
  "flower", "shrub", "tree", "herb", "fern", "succulent",
  "cactus", "vine", "grass", "bulb", "vegetable", "fruit",
]);
const lifecycleEnum = z.enum(["annual", "biennial", "perennial", "tender_perennial"]);

const statusEnum = z.enum([
  "planned", "planted", "established", "struggling", "dormant", "dead", "removed",
]);
const moodEnum = z.enum(["happy", "thirsty", "cold", "hot", "wilting", "sleeping", "new"]);

const createReferenceSchema = z.object({
  commonName: z.string().min(1),
  latinName: z.string().nullable().optional(),
  cultivar: z.string().nullable().optional(),
  family: z.string().nullable().optional(),
  plantType: plantTypeEnum.nullable().optional(),
  sunRequirement: sunRequirementEnum.nullable().optional(),
  waterNeeds: waterNeedsEnum.nullable().optional(),
  soilPreference: z.string().nullable().optional(),
  hardinessZoneMin: z.number().int().nullable().optional(),
  hardinessZoneMax: z.number().int().nullable().optional(),
  matureHeight: z.string().nullable().optional(),
  matureSpread: z.string().nullable().optional(),
  growthRate: growthRateEnum.nullable().optional(),
  bloomTime: z.string().nullable().optional(),
  bloomColor: z.string().nullable().optional(),
  foliageType: foliageTypeEnum.nullable().optional(),
  toxicityDogs: toxicityEnum.nullable().optional(),
  toxicityCats: toxicityEnum.nullable().optional(),
  toxicityChildren: toxicityEnum.nullable().optional(),
  toxicityNotes: z.string().nullable().optional(),
  spriteType: spriteTypeEnum.nullable().optional(),
  source: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  careNotes: z.string().nullable().optional(),
  lifecycle: lifecycleEnum.nullable().optional(),
  plantingNotes: z.string().nullable().optional(),
  pruningNotes: z.string().nullable().optional(),
  overwinteringNotes: z.string().nullable().optional(),
  nativeRegion: z.string().nullable().optional(),
  deerResistant: z.boolean().nullable().optional(),
  droughtTolerant: z.boolean().nullable().optional(),
  containerSuitable: z.boolean().nullable().optional(),
  attractsPollinators: z.boolean().nullable().optional(),
  attractsBirds: z.boolean().nullable().optional(),
  attractsButterflies: z.boolean().nullable().optional(),
  companionPlants: z.string().nullable().optional(),
  minTempF: z.number().int().nullable().optional(),
  maxTempF: z.number().int().nullable().optional(),
});

const updateReferenceSchema = createReferenceSchema.partial();

const containerShapeEnum = z.enum(["round", "square", "rectangular", "oval", "hanging", "window_box", "other"]);
const containerMaterialEnum = z.enum(["terracotta", "ceramic", "plastic", "fabric", "metal", "wood", "concrete", "fiberglass", "stone"]);

const createInstanceSchema = z.object({
  plantReferenceId: z.number().int().positive(),
  zoneId: z.number().int().positive().nullable().optional(),
  nickname: z.string().nullable().optional(),
  status: statusEnum.optional(),
  isContainer: z.boolean().optional(),
  containerDescription: z.string().nullable().optional(),
  containerSize: z.string().nullable().optional(),
  containerShape: containerShapeEnum.nullable().optional(),
  containerMaterial: containerMaterialEnum.nullable().optional(),
  outdoorCandidate: z.boolean().optional(),
  datePlanted: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  mood: moodEnum.optional(),
});

const updateInstanceSchema = z.object({
  plantReferenceId: z.number().int().positive().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  nickname: z.string().nullable().optional(),
  status: statusEnum.optional(),
  isContainer: z.boolean().optional(),
  containerDescription: z.string().nullable().optional(),
  containerSize: z.string().nullable().optional(),
  containerShape: containerShapeEnum.nullable().optional(),
  containerMaterial: containerMaterialEnum.nullable().optional(),
  outdoorCandidate: z.boolean().optional(),
  datePlanted: z.string().nullable().optional(),
  dateRemoved: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  mood: moodEnum.optional(),
  spriteOverride: spriteTypeEnum.nullable().optional(),
});

const bulkUpdateInstanceSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  data: updateInstanceSchema,
});

// ─── Perenual API rate counter (100/day free tier) ────────────────────────
const perenualCounter = {
  date: "",
  count: 0,
  check(): boolean {
    const today = new Date().toISOString().split("T")[0]!;
    if (this.date !== today) {
      this.date = today;
      this.count = 0;
    }
    return this.count < 100;
  },
  increment(): void {
    this.check(); // ensure date is current
    this.count++;
  },
};

export async function plantRoutes(app: FastifyInstance) {
  // ─── Plant References (encyclopedia) ────────────────────────────────────────

  // GET /references - search/list plant references (supports ?page=&limit= pagination)
  app.get<{ Querystring: { search?: string; page?: string; limit?: string } }>(
    "/references",
    async (request) => {
      const { search } = request.query;
      const pagination = parsePagination(request.query);

      const condition = search
        ? or(
            like(plantReferences.commonName, `%${search}%`),
            like(plantReferences.latinName, `%${search}%`),
            like(plantReferences.cultivar, `%${search}%`),
          )
        : undefined;

      if (pagination) {
        const [{ total }] = db
          .select({ total: count() })
          .from(plantReferences)
          .where(condition)
          .all() as [{ total: number }];

        const data = db
          .select()
          .from(plantReferences)
          .where(condition)
          .limit(pagination.limit)
          .offset(pagination.offset)
          .all();

        return paginatedResult(data, total, pagination.page, pagination.limit);
      }

      return db.select().from(plantReferences).where(condition).all();
    },
  );

  // GET /references/:id - get single reference
  app.get<{ Params: { id: string } }>(
    "/references/:id",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const ref = await db.query.plantReferences.findFirst({
        where: eq(plantReferences.id, id),
      });

      if (!ref) {
        return reply.status(404).send({ error: "Plant reference not found" });
      }

      return ref;
    },
  );

  // POST /references - create new reference
  app.post("/references", async (request, reply) => {
    const parsed = createReferenceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(plantReferences)
      .values(parsed.data)
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /references/:id - update reference
  app.put<{ Params: { id: string } }>("/references/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateReferenceSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.plantReferences.findFirst({
      where: eq(plantReferences.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Plant reference not found" });
    }

    const result = db
      .update(plantReferences)
      .set({
        ...bodyParsed.data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(plantReferences.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /references/:id - delete reference (check for existing instances first)
  app.delete<{ Params: { id: string } }>("/references/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const existing = await db.query.plantReferences.findFirst({
      where: eq(plantReferences.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Plant reference not found" });
    }

    // Check for existing plant instances referencing this
    const instances = db
      .select({ id: plantInstances.id })
      .from(plantInstances)
      .where(eq(plantInstances.plantReferenceId, id))
      .all();

    if (instances.length > 0) {
      return reply.status(409).send({
        error: `Cannot delete plant reference: ${instances.length} plant instance(s) reference it. Remove them first.`,
      });
    }

    db.delete(plantReferences).where(eq(plantReferences.id, id)).run();
    return reply.status(204).send();
  });

  // GET /search - combined local + Perenual API search
  app.get<{ Querystring: { q: string; page?: string } }>(
    "/search",
    async (request) => {
      const { q, page } = request.query;
      if (!q || q.length < 2) {
        return { local: [], api: [], apiAvailable: false };
      }

      // Local DB search
      const pattern = `%${q}%`;
      const localResults = db
        .select()
        .from(plantReferences)
        .where(
          or(
            like(plantReferences.commonName, pattern),
            like(plantReferences.latinName, pattern),
            like(plantReferences.cultivar, pattern),
          ),
        )
        .all();

      const local: PlantSearchResult[] = localResults.map((r) => ({
        source: "local" as const,
        localId: r.id,
        commonName: r.commonName,
        latinName: r.latinName,
        plantType: r.plantType,
      }));

      // Perenual API search (if API key configured and under rate limit)
      let api: PlantSearchResult[] = [];
      let apiTotal = 0;
      let apiAvailable = false;

      if (!perenualCounter.check()) {
        return { local, api, apiAvailable: false, apiTotal: 0, rateLimited: true };
      }

      try {
        perenualCounter.increment();
        const apiResult = await searchPerenualPlants(
          q,
          Number(page) || 1,
        );
        if (apiResult) {
          apiAvailable = true;
          apiTotal = apiResult.total;
          // Filter out plants we already have locally (by external ID)
          const localExternalIds = new Set(
            localResults
              .filter((r) => r.externalId)
              .map((r) => r.externalId),
          );
          api = apiResult.results
            .filter(
              (r) => !localExternalIds.has(`perenual:${r.id}`),
            )
            .map(mapPerenualToSearchResult);
        }
      } catch (err) {
        console.warn("Perenual API search failed:", err);
      }

      return { local, api, apiAvailable, apiTotal };
    },
  );

  // POST /import/:perenualId - import a plant from Perenual into local DB
  app.post<{ Params: { perenualId: string } }>(
    "/import/:perenualId",
    async (request, reply) => {
      const perenualId = Number(request.params.perenualId);
      if (isNaN(perenualId) || perenualId <= 0 || !Number.isInteger(perenualId)) {
        return reply.status(400).send({ error: "Invalid Perenual ID" });
      }

      if (!perenualCounter.check()) {
        return reply.status(429).send({ error: "Perenual API daily limit reached (100/day)" });
      }

      try {
        perenualCounter.increment();
        const result = await getPerenualPlantDetail(perenualId);
        if (!result) {
          return reply.status(503).send({
            error:
              "Perenual API unavailable — check PERENUAL_API_KEY env var or daily limit",
          });
        }
        return reply.status(201).send(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        return reply.status(502).send({ error: message });
      }
    },
  );

  // ─── Plant Instances (user's actual plants) ──────────────────────────────────

  // GET /instances - list all instances (supports ?page=&limit= pagination)
  app.get<{ Querystring: { zoneId?: string; locationId?: string; page?: string; limit?: string } }>(
    "/instances",
    async (request) => {
      const { zoneId, locationId } = request.query;
      const pagination = parsePagination(request.query);

      if (zoneId) {
        const zoneIdNum = Number(zoneId);
        if (isNaN(zoneIdNum)) return pagination ? paginatedResult([], 0, 1, 50) : [];
        const results = await db.query.plantInstances.findMany({
          where: eq(plantInstances.zoneId, zoneIdNum),
          with: { plantReference: true },
          ...(pagination && { limit: pagination.limit, offset: pagination.offset }),
        });
        if (pagination) {
          const [{ total }] = db.select({ total: count() }).from(plantInstances)
            .where(eq(plantInstances.zoneId, zoneIdNum)).all() as [{ total: number }];
          return paginatedResult(results, total, pagination.page, pagination.limit);
        }
        return results;
      }

      if (locationId) {
        const locationIdNum = Number(locationId);
        if (isNaN(locationIdNum)) return pagination ? paginatedResult([], 0, 1, 50) : [];
        const locationZones = db
          .select({ id: zones.id })
          .from(zones)
          .where(eq(zones.locationId, locationIdNum))
          .all();

        const zoneIds = locationZones.map((z) => z.id);
        if (zoneIds.length === 0) return pagination ? paginatedResult([], 0, 1, 50) : [];

        const results = await db.query.plantInstances.findMany({
          where: inArray(plantInstances.zoneId, zoneIds),
          with: { plantReference: true, zone: true },
          ...(pagination && { limit: pagination.limit, offset: pagination.offset }),
        });
        if (pagination) {
          const [{ total }] = db.select({ total: count() }).from(plantInstances)
            .where(inArray(plantInstances.zoneId, zoneIds)).all() as [{ total: number }];
          return paginatedResult(results, total, pagination.page, pagination.limit);
        }
        return results;
      }

      const results = await db.query.plantInstances.findMany({
        with: { plantReference: true, zone: true },
        ...(pagination && { limit: pagination.limit, offset: pagination.offset }),
      });
      if (pagination) {
        const [{ total }] = db.select({ total: count() }).from(plantInstances).all() as [{ total: number }];
        return paginatedResult(results, total, pagination.page, pagination.limit);
      }
      return results;
    },
  );

  // GET /instances/:id - get instance with reference data, photos, and care tasks
  app.get<{ Params: { id: string } }>(
    "/instances/:id",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const instance = await db.query.plantInstances.findFirst({
        where: eq(plantInstances.id, id),
        with: {
          plantReference: true,
          zone: true,
          photos: true,
          careTasks: true,
        },
      });

      if (!instance) {
        return reply.status(404).send({ error: "Plant instance not found" });
      }

      return instance;
    },
  );

  // POST /instances - create instance
  app.post("/instances", async (request, reply) => {
    const parsed = createInstanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(plantInstances)
      .values(parsed.data)
      .returning()
      .get();

    // Auto-generate default care tasks based on plant reference
    try {
      const plantRef = await db.query.plantReferences.findFirst({
        where: eq(plantReferences.id, result.plantReferenceId),
      });
      if (plantRef) {
        const defaultTasks = generateDefaultCareTasks(result, plantRef);
        for (const task of defaultTasks) {
          db.insert(careTasks).values(task).run();
        }
      }
    } catch (err) {
      console.warn("Failed to auto-generate care tasks:", err);
      // Non-fatal — still return the created instance
    }

    return reply.status(201).send(result);
  });

  // PUT /instances/:id - update instance
  app.put<{ Params: { id: string } }>("/instances/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateInstanceSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.plantInstances.findFirst({
      where: eq(plantInstances.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Plant instance not found" });
    }

    const result = db
      .update(plantInstances)
      .set({
        ...bodyParsed.data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(plantInstances.id, id))
      .returning()
      .get();

    // Handle care task lifecycle when status changes
    if (bodyParsed.data.status && bodyParsed.data.status !== existing.status) {
      try {
        await handleStatusTransition(id, existing.status, bodyParsed.data.status);
      } catch (err) {
        console.warn("Failed to handle status transition care tasks:", err);
        // Non-fatal — still return the updated instance
      }
    }

    return result;
  });

  // DELETE /instances/:id - delete instance
  app.delete<{ Params: { id: string } }>(
    "/instances/:id",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const existing = await db.query.plantInstances.findFirst({
        where: eq(plantInstances.id, id),
      });

      if (!existing) {
        return reply.status(404).send({ error: "Plant instance not found" });
      }

      db.delete(plantInstances).where(eq(plantInstances.id, id)).run();
      return reply.status(204).send();
    },
  );

  // PUT /instances/bulk - bulk update instances
  app.put("/instances/bulk", async (request, reply) => {
    const parsed = bulkUpdateInstanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const { ids, data } = parsed.data;

    // Get existing instances for status transition handling
    const existing = await db.query.plantInstances.findMany({
      where: inArray(plantInstances.id, ids),
    });

    if (existing.length === 0) {
      return reply.status(404).send({ error: "No matching plant instances found" });
    }

    // Update all matching instances
    db.update(plantInstances)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(inArray(plantInstances.id, ids))
      .run();

    // Handle status transitions if status changed
    if (data.status) {
      for (const inst of existing) {
        if (inst.status !== data.status) {
          try {
            await handleStatusTransition(inst.id, inst.status, data.status);
          } catch (err) {
            console.warn(`Failed to handle status transition for instance ${inst.id}:`, err);
          }
        }
      }
    }

    return { count: existing.length };
  });

  // POST /instances/refresh-moods - recalculate moods for all plants
  app.post("/instances/refresh-moods", async () => {
    const allInstances = await db.query.plantInstances.findMany({
      with: {
        plantReference: true,
        zone: true,
      },
    });

    if (allInstances.length === 0) {
      return { updated: 0, total: 0 };
    }

    // Batch-fetch weather cache: get unique location IDs from zones, fetch once per location
    const locationIds = [...new Set(
      allInstances
        .filter((inst) => inst.zone?.locationId)
        .map((inst) => inst.zone!.locationId),
    )];

    const weatherByLocation = new Map<number, typeof weatherCache.$inferSelect | null>();
    for (const locId of locationIds) {
      const cached = db
        .select()
        .from(weatherCache)
        .where(eq(weatherCache.locationId, locId))
        .orderBy(desc(weatherCache.fetchedAt))
        .limit(1)
        .all();
      weatherByLocation.set(locId, cached[0] ?? null);
    }

    // Batch-fetch all water care tasks for these plant instances
    const instanceIds = allInstances.map((inst) => inst.id);
    const allWaterTasks = db
      .select()
      .from(careTasks)
      .where(and(
        inArray(careTasks.plantInstanceId, instanceIds),
        eq(careTasks.taskType, "water"),
      ))
      .all();

    const waterTaskByInstance = new Map<number, typeof careTasks.$inferSelect>();
    for (const task of allWaterTasks) {
      if (task.plantInstanceId) {
        waterTaskByInstance.set(task.plantInstanceId, task);
      }
    }

    // Batch-fetch latest water logs for all water tasks
    const waterTaskIds = allWaterTasks.map((t) => t.id);
    const latestWaterLogs = new Map<number, typeof careTaskLogs.$inferSelect>();
    if (waterTaskIds.length > 0) {
      const allWaterLogs = db
        .select()
        .from(careTaskLogs)
        .where(inArray(careTaskLogs.careTaskId, waterTaskIds))
        .orderBy(desc(careTaskLogs.completedAt))
        .all();

      // Keep only the latest log per care task
      for (const log of allWaterLogs) {
        if (!latestWaterLogs.has(log.careTaskId)) {
          latestWaterLogs.set(log.careTaskId, log);
        }
      }
    }

    let updatedCount = 0;

    for (const instance of allInstances) {
      if (!instance.plantReference) continue;

      const weather = instance.zone?.locationId
        ? weatherByLocation.get(instance.zone.locationId) ?? null
        : null;

      const waterTask = waterTaskByInstance.get(instance.id);
      const lastWaterLog = waterTask ? latestWaterLogs.get(waterTask.id) ?? null : null;
      const waterIntervalDays = waterTask?.intervalDays ?? null;

      const newMood = calculatePlantMood(instance, instance.plantReference, {
        weather,
        lastWaterLog,
        waterIntervalDays,
      });

      if (newMood !== instance.mood) {
        db.update(plantInstances)
          .set({ mood: newMood, updatedAt: new Date().toISOString() })
          .where(eq(plantInstances.id, instance.id))
          .run();
        updatedCount++;
      }
    }

    return { updated: updatedCount, total: allInstances.length };
  });
}
