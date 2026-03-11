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
import { eq, like, or, and, desc } from "drizzle-orm";
import {
  searchPerenualPlants,
  getPerenualPlantDetail,
  mapPerenualToSearchResult,
  type PlantSearchResult,
} from "../services/perenual.js";
import { z } from "zod";
import { generateDefaultCareTasks } from "../services/care-tasks.js";
import { calculatePlantMood } from "../services/mood.js";

const idParamSchema = z.object({
  id: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: "Invalid ID",
  }),
});

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
  latinName: z.string().optional(),
  cultivar: z.string().optional(),
  family: z.string().optional(),
  plantType: plantTypeEnum.optional(),
  sunRequirement: sunRequirementEnum.optional(),
  waterNeeds: waterNeedsEnum.optional(),
  soilPreference: z.string().optional(),
  hardinessZoneMin: z.number().int().optional(),
  hardinessZoneMax: z.number().int().optional(),
  matureHeight: z.string().optional(),
  matureSpread: z.string().optional(),
  growthRate: growthRateEnum.optional(),
  bloomTime: z.string().optional(),
  bloomColor: z.string().optional(),
  foliageType: foliageTypeEnum.optional(),
  toxicityDogs: toxicityEnum.optional(),
  toxicityCats: toxicityEnum.optional(),
  toxicityChildren: toxicityEnum.optional(),
  toxicityNotes: z.string().optional(),
  spriteType: spriteTypeEnum.optional(),
  source: z.string().optional(),
  externalId: z.string().optional(),
  description: z.string().optional(),
  careNotes: z.string().optional(),
  lifecycle: lifecycleEnum.optional(),
  plantingNotes: z.string().optional(),
  pruningNotes: z.string().optional(),
  overwinteringNotes: z.string().optional(),
  nativeRegion: z.string().optional(),
  deerResistant: z.number().int().optional(),
  droughtTolerant: z.number().int().optional(),
  containerSuitable: z.number().int().optional(),
  attractsPollinators: z.number().int().optional(),
  attractsBirds: z.number().int().optional(),
  attractsButterflies: z.number().int().optional(),
  companionPlants: z.string().optional(),
  minTempF: z.number().int().optional(),
  maxTempF: z.number().int().optional(),
});

const updateReferenceSchema = createReferenceSchema.partial();

const createInstanceSchema = z.object({
  plantReferenceId: z.number().int().positive(),
  zoneId: z.number().int().positive().optional(),
  nickname: z.string().optional(),
  status: statusEnum.optional(),
  isContainer: z.boolean().optional(),
  containerDescription: z.string().optional(),
  datePlanted: z.string().optional(),
  notes: z.string().optional(),
  mood: moodEnum.optional(),
});

const updateInstanceSchema = z.object({
  plantReferenceId: z.number().int().positive().optional(),
  zoneId: z.number().int().positive().nullable().optional(),
  nickname: z.string().nullable().optional(),
  status: statusEnum.optional(),
  isContainer: z.boolean().optional(),
  containerDescription: z.string().nullable().optional(),
  datePlanted: z.string().nullable().optional(),
  dateRemoved: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  mood: moodEnum.optional(),
  spriteOverride: spriteTypeEnum.nullable().optional(),
});

export async function plantRoutes(app: FastifyInstance) {
  // ─── Plant References (encyclopedia) ────────────────────────────────────────

  // GET /references - search/list plant references
  app.get<{ Querystring: { search?: string } }>(
    "/references",
    async (request) => {
      const { search } = request.query;

      if (search) {
        const pattern = `%${search}%`;
        return db
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
      }

      return db.select().from(plantReferences).all();
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
      .values(parsed.data as typeof plantReferences.$inferInsert)
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
        ...(bodyParsed.data as Partial<typeof plantReferences.$inferInsert>),
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

      // Perenual API search (if API key configured)
      let api: PlantSearchResult[] = [];
      let apiTotal = 0;
      let apiAvailable = false;

      try {
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

      try {
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

  // GET /instances - list all instances
  app.get<{ Querystring: { zoneId?: string; locationId?: string } }>(
    "/instances",
    async (request) => {
      const { zoneId, locationId } = request.query;

      if (zoneId) {
        const zoneIdNum = Number(zoneId);
        if (isNaN(zoneIdNum)) return [];
        return db.query.plantInstances.findMany({
          where: eq(plantInstances.zoneId, zoneIdNum),
          with: { plantReference: true },
        });
      }

      if (locationId) {
        const locationIdNum = Number(locationId);
        if (isNaN(locationIdNum)) return [];
        // BUG-007 fix: Use a proper SQL join instead of fetching all and filtering in JS
        const locationZones = db
          .select({ id: zones.id })
          .from(zones)
          .where(eq(zones.locationId, locationIdNum))
          .all();

        const zoneIds = locationZones.map((z) => z.id);
        if (zoneIds.length === 0) return [];

        // Fetch instances for all zones belonging to this location
        const results = [];
        for (const zId of zoneIds) {
          const instances = await db.query.plantInstances.findMany({
            where: eq(plantInstances.zoneId, zId),
            with: { plantReference: true, zone: true },
          });
          results.push(...instances);
        }
        return results;
      }

      return db.query.plantInstances.findMany({
        with: { plantReference: true },
      });
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
      .values(parsed.data as typeof plantInstances.$inferInsert)
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
        ...(bodyParsed.data as Partial<typeof plantInstances.$inferInsert>),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(plantInstances.id, id))
      .returning()
      .get();

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

  // POST /instances/refresh-moods - recalculate moods for all plants
  app.post("/instances/refresh-moods", async () => {
    const allInstances = await db.query.plantInstances.findMany({
      with: {
        plantReference: true,
        zone: true,
      },
    });

    let updatedCount = 0;

    for (const instance of allInstances) {
      if (!instance.plantReference) continue;

      // Get weather for the plant's location (via zone)
      let weather = null;
      if (instance.zone?.locationId) {
        const cached = db
          .select()
          .from(weatherCache)
          .where(eq(weatherCache.locationId, instance.zone.locationId))
          .orderBy(desc(weatherCache.fetchedAt))
          .limit(1)
          .all();
        weather = cached[0] ?? null;
      }

      // Get the latest water care task log
      let lastWaterLog = null;
      let waterIntervalDays = null;
      const waterTask = await db.query.careTasks.findFirst({
        where: and(
          eq(careTasks.plantInstanceId, instance.id),
          eq(careTasks.taskType, "water"),
        ),
      });
      if (waterTask) {
        waterIntervalDays = waterTask.intervalDays;
        const logs = db
          .select()
          .from(careTaskLogs)
          .where(eq(careTaskLogs.careTaskId, waterTask.id))
          .orderBy(desc(careTaskLogs.completedAt))
          .limit(1)
          .all();
        lastWaterLog = logs[0] ?? null;
      }

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
