import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { locations, structures } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { geocodeAddress } from "../services/geocoding.js";
import {
  getHardinessZone,
  extractZipCode,
  detectTimezoneFromCoordinates,
} from "../services/hardiness.js";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: "Invalid ID",
  }),
});

const roofTypeEnum = z.enum(["flat", "gable", "hip", "shed", "gambrel", "pergola", "gazebo", "open", "canopy"]);

const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().optional(),
  hardinessZone: z.string().optional(),
  lastFrostDate: z.string().optional(),
  firstFrostDate: z.string().optional(),
  lotBoundary: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  lotWidth: z.number().optional(),
  lotDepth: z.number().optional(),
  compassOrientation: z.number().optional(),
  sidewalks: z.array(z.object({
    edge: z.enum(["north", "east", "south", "west"]),
    width: z.number().positive(),
    inset: z.number().min(0),
  })).nullable().optional(),
});

const updateLocationSchema = createLocationSchema.partial();

const createStructureSchema = z.object({
  name: z.string().min(1),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive().optional(),
  stories: z.number().int().positive().optional(),
  roofType: roofTypeEnum.optional(),
});

const updateStructureSchema = z.object({
  name: z.string().min(1).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  height: z.number().positive().optional(),
  stories: z.number().int().positive().optional(),
  roofType: roofTypeEnum.optional(),
});

export async function locationRoutes(app: FastifyInstance) {
  // GET /geocode?q=address - geocode an address for autocomplete
  app.get<{ Querystring: { q: string } }>("/geocode", async (request, reply) => {
    const { q } = request.query;

    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: "Query parameter 'q' is required" });
    }

    try {
      const results = await geocodeAddress(q);
      if (results.length === 0) {
        return [];
      }
      return results;
    } catch (err) {
      return reply.status(502).send({ error: "Geocoding service error" });
    }
  });

  // GET /hardiness?lat=XX&lng=YY&zip=ZZZZZ - look up hardiness zone
  app.get<{ Querystring: { lat?: string; lng?: string; zip?: string } }>(
    "/hardiness",
    async (request, reply) => {
      const { lat, lng, zip } = request.query;

      // If zip provided directly, use it
      if (zip) {
        const result = await getHardinessZone(zip);
        if (result) return result;
        return reply.status(404).send({ error: "Hardiness zone not found for this ZIP code" });
      }

      // If lat/lng provided, reverse geocode to get zip
      if (lat && lng) {
        try {
          const params = new URLSearchParams({
            lat,
            lon: lng,
            format: "json",
            zoom: "18",
          });
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params}`,
            {
              headers: { "User-Agent": "Bramble Garden App/1.0 (self-hosted garden management)" },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as { address?: { postcode?: string } };
            const postcode = data.address?.postcode;
            if (postcode) {
              const zipClean = postcode.split("-")[0];
              if (zipClean && /^\d{5}$/.test(zipClean)) {
                const result = await getHardinessZone(zipClean);
                if (result) return { ...result, zip: zipClean };
              }
            }
          }
        } catch {
          // Reverse geocode failed
        }
        return reply.status(404).send({ error: "Could not determine hardiness zone from coordinates" });
      }

      return reply.status(400).send({ error: "Provide lat+lng or zip" });
    },
  );

  // GET / - list all locations
  app.get("/", async () => {
    return db.query.locations.findMany();
  });

  // GET /:id - get location with zones and structures
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, id),
      with: {
        zones: true,
        structures: true,
      },
    });

    if (!location) {
      return reply.status(404).send({ error: "Location not found" });
    }

    return location;
  });

  // POST / - create location with auto-enrichment
  app.post("/", async (request, reply) => {
    const parsed = createLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    let { latitude, longitude, timezone, hardinessZone, address } = parsed.data;

    // If no lat/lng but address is provided, auto-geocode
    if ((latitude == null || longitude == null) && address) {
      try {
        const results = await geocodeAddress(address);
        if (results.length > 0) {
          latitude = results[0]!.lat;
          longitude = results[0]!.lng;
        }
      } catch {
        // Geocoding failed — continue without coordinates
      }
    }

    if (latitude == null || longitude == null) {
      return reply.status(400).send({
        error: "Latitude and longitude are required (provide them directly or supply an address for auto-geocoding)",
      });
    }

    // Auto-detect timezone from coordinates if not provided
    if (!timezone) {
      timezone = detectTimezoneFromCoordinates(latitude, longitude);
    }

    // Auto-fetch hardiness zone from ZIP code if not provided
    if (!hardinessZone && address) {
      const zip = extractZipCode(address);
      if (zip) {
        try {
          const zoneResult = await getHardinessZone(zip);
          if (zoneResult) {
            hardinessZone = zoneResult.zone;
          }
        } catch {
          // Hardiness lookup failed — continue without it
        }
      }
    }

    const result = db
      .insert(locations)
      .values({
        ...parsed.data,
        latitude,
        longitude,
        timezone: timezone ?? "America/New_York",
        hardinessZone: hardinessZone ?? null,
      })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /:id - update location
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateLocationSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.locations.findFirst({
      where: eq(locations.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Location not found" });
    }

    const result = db
      .update(locations)
      .set({ ...bodyParsed.data, updatedAt: new Date().toISOString() })
      .where(eq(locations.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /:id - delete location
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);
    const existing = await db.query.locations.findFirst({
      where: eq(locations.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Location not found" });
    }

    db.delete(locations).where(eq(locations.id, id)).run();
    return reply.status(204).send();
  });

  // GET /:id/structures - list structures for a location
  app.get<{ Params: { id: string } }>("/:id/structures", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const locationId = Number(request.params.id);
    return db.query.structures.findMany({
      where: eq(structures.locationId, locationId),
    });
  });

  // POST /:id/structures - add structure to location
  app.post<{ Params: { id: string } }>("/:id/structures", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const locationId = Number(request.params.id);

    const bodyParsed = createStructureSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Location not found" });
    }

    const result = db
      .insert(structures)
      .values({ ...bodyParsed.data, locationId })
      .returning()
      .get();

    return reply.status(201).send(result);
  });

  // PUT /structures/:id - update structure
  app.put<{ Params: { id: string } }>("/structures/:id", async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: "Invalid ID" });
    }
    const id = Number(request.params.id);

    const bodyParsed = updateStructureSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request body" });
    }

    const existing = await db.query.structures.findFirst({
      where: eq(structures.id, id),
    });

    if (!existing) {
      return reply.status(404).send({ error: "Structure not found" });
    }

    const result = db
      .update(structures)
      .set(bodyParsed.data)
      .where(eq(structures.id, id))
      .returning()
      .get();

    return result;
  });

  // DELETE /structures/:id - delete structure
  app.delete<{ Params: { id: string } }>(
    "/structures/:id",
    async (request, reply) => {
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const id = Number(request.params.id);
      const existing = await db.query.structures.findFirst({
        where: eq(structures.id, id),
      });

      if (!existing) {
        return reply.status(404).send({ error: "Structure not found" });
      }

      db.delete(structures).where(eq(structures.id, id)).run();
      return reply.status(204).send();
    },
  );
}
