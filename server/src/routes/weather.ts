import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  locations,
  weatherCache,
  plantInstances,
  careTasks,
  careTaskLogs,
  zones,
} from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { fetchWeather } from "../services/weather.js";
import { calculatePlantMood } from "../services/mood.js";
import { z } from "zod";

const locationIdParamSchema = z.object({
  locationId: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: "Invalid ID",
  }),
});

function upsertWeatherCache(locationId: number, weather: Awaited<ReturnType<typeof fetchWeather>>) {
  // Delete existing cache for this location, then insert fresh
  db.delete(weatherCache).where(eq(weatherCache.locationId, locationId)).run();

  return db
    .insert(weatherCache)
    .values({
      locationId,
      temperature: weather.current.temperature,
      temperatureHigh: weather.daily.temperatureMax,
      temperatureLow: weather.daily.temperatureMin,
      humidity: weather.current.humidity,
      precipitation: weather.current.precipitation,
      windSpeed: weather.current.windSpeed,
      conditions: weather.current.conditions,
      forecastJson: weather.forecast,
      uvIndex: weather.current.uvIndex,
      precipitationProbability: weather.daily.precipitationProbability,
      soilTemperature: weather.soilTemperature,
      windGust: weather.current.windGust,
    })
    .returning()
    .get();
}

async function refreshMoodsForLocation(locationId: number) {
  // Get zones for this location
  const locationZones = db
    .select({ id: zones.id })
    .from(zones)
    .where(eq(zones.locationId, locationId))
    .all();

  const zoneIds = locationZones.map((z) => z.id);
  if (zoneIds.length === 0) return 0;

  // Get latest weather
  const cached = db
    .select()
    .from(weatherCache)
    .where(eq(weatherCache.locationId, locationId))
    .orderBy(desc(weatherCache.fetchedAt))
    .limit(1)
    .all();
  const weather = cached[0] ?? null;

  let updatedCount = 0;

  for (const zId of zoneIds) {
    const instancesInZone = await db.query.plantInstances.findMany({
      where: eq(plantInstances.zoneId, zId),
      with: { plantReference: true },
    });

    for (const instance of instancesInZone) {
      if (!instance.plantReference) continue;

      // Get latest water log
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
  }

  return updatedCount;
}

export async function weatherRoutes(app: FastifyInstance) {
  // GET /:locationId - get cached weather for a location
  app.get<{ Params: { locationId: string } }>(
    "/:locationId",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      // Check for recent cache (less than 1 hour old)
      const cached = db
        .select()
        .from(weatherCache)
        .where(eq(weatherCache.locationId, locationId))
        .orderBy(desc(weatherCache.fetchedAt))
        .limit(1)
        .all();

      const latestCached = cached[0];
      if (latestCached) {
        const fetchedAt = new Date(latestCached.fetchedAt);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        if (fetchedAt > oneHourAgo) {
          return { ...latestCached, fromCache: true };
        }
      }

      // Fetch fresh weather
      try {
        const weather = await fetchWeather(
          location.latitude,
          location.longitude,
        );

        const entry = upsertWeatherCache(locationId, weather);

        return { ...entry, fromCache: false };
      } catch (err) {
        // If fetch fails but we have stale cache, return it
        if (latestCached) {
          return { ...latestCached, fromCache: true, stale: true };
        }
        return reply.status(502).send({ error: "Failed to fetch weather data" });
      }
    },
  );

  // POST /:locationId/refresh - force refresh weather
  app.post<{ Params: { locationId: string } }>(
    "/:locationId/refresh",
    async (request, reply) => {
      const paramsParsed = locationIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID" });
      }
      const locationId = Number(request.params.locationId);
      const location = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });

      if (!location) {
        return reply.status(404).send({ error: "Location not found" });
      }

      try {
        const weather = await fetchWeather(
          location.latitude,
          location.longitude,
        );

        const entry = upsertWeatherCache(locationId, weather);

        // Also refresh moods for all plants at this location
        try {
          await refreshMoodsForLocation(locationId);
        } catch (moodErr) {
          console.warn("Failed to refresh moods after weather update:", moodErr);
        }

        return reply.status(201).send(entry);
      } catch (err) {
        return reply.status(502).send({ error: "Failed to fetch weather data" });
      }
    },
  );
}
