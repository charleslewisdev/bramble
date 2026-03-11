import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { zones } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: "Invalid ID",
  }),
});

const sunExposureEnum = z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]);
const soilTypeEnum = z.enum(["clay", "sandy", "loamy", "silty", "peaty", "chalky", "mixed"]);
const moistureLevelEnum = z.enum(["dry", "moderate", "moist", "wet"]);
const windExposureEnum = z.enum(["sheltered", "moderate", "exposed"]);
const zoneTypeEnum = z.enum(["bed", "container", "raised_bed", "lawn", "patio", "path"]);
const climbingStructureEnum = z.enum(["trellis", "arbor", "pergola", "wall_mount", "fence"]);

const createZoneSchema = z.object({
  locationId: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().optional(),
  depth: z.number().optional(),
  sunExposure: sunExposureEnum.optional(),
  soilType: soilTypeEnum.optional(),
  moistureLevel: moistureLevelEnum.optional(),
  windExposure: windExposureEnum.optional(),
  isIndoor: z.boolean().optional(),
  notes: z.string().optional(),
  color: z.string().optional(),
  zoneType: zoneTypeEnum.optional(),
  climbingStructure: climbingStructureEnum.nullable().optional(),
  hasPatio: z.boolean().optional(),
});

const updateZoneSchema = createZoneSchema.omit({ locationId: true }).partial();

export async function zoneRoutes(app: FastifyInstance) {
  // GET / - list all zones (optionally filtered by locationId)
  app.get<{ Querystring: { locationId?: string } }>(
    "/",
    async (request) => {
      const { locationId } = request.query;

      if (locationId) {
        const num = Number(locationId);
        if (isNaN(num)) return [];
        return db.query.zones.findMany({
          where: eq(zones.locationId, num),
        });
      }

      return db.query.zones.findMany();
    },
  );

  // GET /:id - get zone with its plant instances
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const zone = await db.query.zones.findFirst({
      where: eq(zones.id, id),
      with: {
        plantInstances: {
          with: {
            plantReference: true,
          },
        },
      },
    });

    if (!zone) {
      return reply.status(404).send({ error: "Zone not found" });
    }

    return zone;
  });

  // POST / - create zone
  app.post("/", async (request, reply) => {
    const parsed = createZoneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const result = db
      .insert(zones)
      .values(parsed.data)
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update zone
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateZoneSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.zones.findFirst({
      where: eq(zones.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Zone not found" });
    }

    const result = db
      .update(zones)
      .set({ ...bodyParsed.data, updatedAt: new Date().toISOString() })
      .where(eq(zones.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /:id - delete zone
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const existing = await db.query.zones.findFirst({
      where: eq(zones.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Zone not found" });
    }

    db.delete(zones).where(eq(zones.id, id)).run();
    return reply.status(204).send();
  });
}
