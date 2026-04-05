import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { fertilizers } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { idParamSchema, locationIdParamSchema } from "../lib/validation.js";
import { requireAuth, requireRole } from "../plugins/auth.js";

const fertilizerTypeEnum = z.enum([
  "liquid",
  "granular",
  "slow_release",
  "compost",
  "compost_tea",
  "fish_emulsion",
  "other",
]);

const fertilizerStatusEnum = z.enum(["have_it", "running_low", "out"]);

const createFertilizerSchema = z.object({
  name: z.string().min(1),
  type: fertilizerTypeEnum,
  npkN: z.number().optional(),
  npkP: z.number().optional(),
  npkK: z.number().optional(),
  organic: z.boolean().optional(),
  status: fertilizerStatusEnum.optional(),
  notes: z.string().optional(),
});

const updateFertilizerSchema = z.object({
  name: z.string().min(1).optional(),
  type: fertilizerTypeEnum.optional(),
  npkN: z.number().nullable().optional(),
  npkP: z.number().nullable().optional(),
  npkK: z.number().nullable().optional(),
  organic: z.boolean().optional(),
  status: fertilizerStatusEnum.optional(),
  notes: z.string().nullable().optional(),
});

export async function fertilizerRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET / - list all fertilizers for a location, ordered by name
  app.get<{ Params: { locationId: string } }>("/", async (request, reply) => {
    const paramsParsed = locationIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid location ID" });
    }
    const locationId = Number(request.params.locationId);

    return db
      .select()
      .from(fertilizers)
      .where(eq(fertilizers.locationId, locationId))
      .orderBy(asc(fertilizers.name))
      .all();
  });

  // GET /:id - get single fertilizer
  app.get<{ Params: { locationId: string; id: string } }>(
    "/:id",
    async (request, reply) => {
      const locationParsed = locationIdParamSchema.safeParse(request.params);
      if (!locationParsed.success) {
        return reply.status(400).send({ error: "Invalid location ID" });
      }
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const locationId = Number(request.params.locationId);

      const fertilizer = await db.query.fertilizers.findFirst({
        where: and(eq(fertilizers.id, id), eq(fertilizers.locationId, locationId)),
      });

      if (!fertilizer) {
        return reply.status(404).send({ error: "Fertilizer not found" });
      }

      return fertilizer;
    },
  );

  // POST / - create fertilizer
  app.post<{ Params: { locationId: string } }>("/", { preHandler: requireRole("gardener") }, async (request, reply) => {
    const locationParsed = locationIdParamSchema.safeParse(request.params);
    if (!locationParsed.success) {
      return reply.status(400).send({ error: "Invalid location ID" });
    }
    const locationId = Number(request.params.locationId);

    const parsed = createFertilizerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(fertilizers)
      .values({ ...parsed.data, locationId })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update fertilizer
  app.put<{ Params: { locationId: string; id: string } }>(
    "/:id",
    { preHandler: requireRole("gardener") },
    async (request, reply) => {
      const locationParsed = locationIdParamSchema.safeParse(request.params);
      if (!locationParsed.success) {
        return reply.status(400).send({ error: "Invalid location ID" });
      }
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const locationId = Number(request.params.locationId);

      const bodyParsed = updateFertilizerSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
      }

      const existing = await db.query.fertilizers.findFirst({
        where: and(eq(fertilizers.id, id), eq(fertilizers.locationId, locationId)),
      });

      if (!existing) {
        return reply.status(404).send({ error: "Fertilizer not found" });
      }

      const result = db
        .update(fertilizers)
        .set({ ...bodyParsed.data, updatedAt: new Date().toISOString() })
        .where(eq(fertilizers.id, id))
        .returning()
        .get();

      return result;
    },
  );

  // DELETE /:id - delete fertilizer
  app.delete<{ Params: { locationId: string; id: string } }>(
    "/:id",
    { preHandler: requireRole("gardener") },
    async (request, reply) => {
      const locationParsed = locationIdParamSchema.safeParse(request.params);
      if (!locationParsed.success) {
        return reply.status(400).send({ error: "Invalid location ID" });
      }
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const locationId = Number(request.params.locationId);

      const existing = await db.query.fertilizers.findFirst({
        where: and(eq(fertilizers.id, id), eq(fertilizers.locationId, locationId)),
      });

      if (!existing) {
        return reply.status(404).send({ error: "Fertilizer not found" });
      }

      db.delete(fertilizers).where(eq(fertilizers.id, id)).run();
      return reply.status(204).send();
    },
  );
}
