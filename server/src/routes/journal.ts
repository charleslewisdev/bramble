import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { journalEntries, journalPhotos, plantInstances } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { idParamSchema } from "../lib/validation.js";
import { requireAuth, requireRole } from "../plugins/auth.js";

const entryTypeEnum = z.enum([
  "observation",
  "status_check",
  "care_log",
  "milestone",
  "identification",
]);

const createEntrySchema = z
  .object({
    plantInstanceId: z.number().int().positive().nullable().optional(),
    zoneId: z.number().int().positive().nullable().optional(),
    locationId: z.number().int().positive().nullable().optional(),
    entryType: entryTypeEnum,
    title: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    careTaskLogId: z.number().int().positive().nullable().optional(),
    photoIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (data) => data.plantInstanceId || data.zoneId || data.locationId,
    { message: "At least one of plantInstanceId, zoneId, or locationId is required" },
  );

const updateEntrySchema = z.object({
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  photoIds: z.array(z.number().int().positive()).optional(),
});

export async function journalRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET / - list entries for a plant instance
  app.get<{
    Querystring: {
      plantInstanceId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/", async (request, reply) => {
    const { plantInstanceId, limit: limitStr, offset: offsetStr } = request.query;

    if (!plantInstanceId) {
      return reply.status(400).send({ error: "plantInstanceId query parameter is required" });
    }

    const id = Number(plantInstanceId);
    if (isNaN(id) || id <= 0) {
      return reply.status(400).send({ error: "Invalid plantInstanceId" });
    }

    const limit = Math.min(Math.max(1, Number(limitStr) || 50), 100);
    const offset = Math.max(0, Number(offsetStr) || 0);

    const entries = await db.query.journalEntries.findMany({
      where: eq(journalEntries.plantInstanceId, id),
      orderBy: [desc(journalEntries.createdAt)],
      limit,
      offset,
      with: {
        photos: {
          with: { plantPhoto: true },
        },
        careTaskLog: true,
      },
    });

    return entries;
  });

  // GET /:id - single entry with photos and careTaskLog
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
        },
        careTaskLog: true,
      },
    });

    if (!entry) {
      return reply.status(404).send({ error: "Journal entry not found" });
    }

    return entry;
  });

  // POST / - create entry
  app.post("/", async (request, reply) => {
    const parsed = createEntrySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const { photoIds, ...entryData } = parsed.data;

    // Verify plant instance exists if provided
    if (entryData.plantInstanceId) {
      const instance = await db.query.plantInstances.findFirst({
        where: eq(plantInstances.id, entryData.plantInstanceId),
      });
      if (!instance) {
        return reply.status(404).send({ error: "Plant instance not found" });
      }
    }

    // Insert entry and link photos in a transaction
    const result = db.transaction((tx) => {
      const entry = tx
        .insert(journalEntries)
        .values({ ...entryData, createdBy: request.user?.id ?? null })
        .returning()
        .get();

      if (photoIds && photoIds.length > 0) {
        for (let i = 0; i < photoIds.length; i++) {
          tx.insert(journalPhotos)
            .values({
              journalEntryId: entry.id,
              plantPhotoId: photoIds[i]!,
              sortOrder: i,
            })
            .run();
        }
      }

      return entry;
    });

    // Re-fetch with relations
    const created = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, result.id),
      with: {
        photos: {
          with: { plantPhoto: true },
        },
        careTaskLog: true,
      },
    });

    return reply.status(201).send(created);
  });

  // PUT /:id - update entry
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }

    const id = Number(request.params.id);

    const bodyParsed = updateEntrySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply
        .status(400)
        .send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Journal entry not found" });
    }

    const { photoIds, ...updateData } = bodyParsed.data;

    db.transaction((tx) => {
      // Update entry fields if any provided
      if (updateData.title !== undefined || updateData.body !== undefined) {
        tx.update(journalEntries)
          .set({
            ...updateData,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(journalEntries.id, id))
          .run();
      }

      // Replace photo links if photoIds provided
      if (photoIds !== undefined) {
        tx.delete(journalPhotos)
          .where(eq(journalPhotos.journalEntryId, id))
          .run();

        for (let i = 0; i < photoIds.length; i++) {
          tx.insert(journalPhotos)
            .values({
              journalEntryId: id,
              plantPhotoId: photoIds[i]!,
              sortOrder: i,
            })
            .run();
        }
      }
    });

    // Re-fetch with relations
    const updated = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        photos: {
          with: { plantPhoto: true },
        },
        careTaskLog: true,
      },
    });

    return updated;
  });

  // DELETE /:id - delete entry
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: requireRole("gardener") }, async (request, reply) => {
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
