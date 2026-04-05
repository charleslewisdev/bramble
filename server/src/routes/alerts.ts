import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  locations,
  weatherCache,
  plantInstances,
  zones,
} from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";
import { checkWeatherAlerts } from "../services/alerts.js";
import { requireAuth } from "../plugins/auth.js";

export async function alertRoutes(app: FastifyInstance) {
  // Auth: require login for all routes in this plugin
  app.addHook("onRequest", requireAuth);

  // GET /:locationId - get active weather alerts for a location
  app.get<{ Params: { locationId: string } }>(
    "/:locationId",
    async (request, reply) => {
      const locationId = Number(request.params.locationId);
      if (isNaN(locationId)) {
        return reply.status(400).send({ error: "Invalid location ID" });
      }

      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      // Get latest weather
      const cached = db
        .select()
        .from(weatherCache)
        .where(eq(weatherCache.locationId, locationId))
        .orderBy(desc(weatherCache.fetchedAt))
        .limit(1)
        .all();

      const weather = cached[0];
      if (!weather) {
        return { alerts: [], message: "No weather data available" };
      }

      // Get all plant instances for this location (through zones) in a single query
      const locationZones = db
        .select({ id: zones.id })
        .from(zones)
        .where(eq(zones.locationId, locationId))
        .all();

      const zoneIds = locationZones.map((z) => z.id);

      const plants = zoneIds.length > 0
        ? await db.query.plantInstances.findMany({
            where: inArray(plantInstances.zoneId, zoneIds),
            with: { plantReference: true },
          })
        : [];

      const alerts = checkWeatherAlerts(locationId, weather, plants);

      return { alerts };
    },
  );
}
