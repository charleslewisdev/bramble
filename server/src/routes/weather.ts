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
import { eq, desc, and, inArray } from "drizzle-orm";
import { fetchWeather } from "../services/weather.js";
import { calculatePlantMood } from "../services/mood.js";
import { z } from "zod";
import { locationIdParamSchema } from "../lib/validation.js";

function upsertWeatherCache(locationId: number, weather: Awaited<ReturnType<typeof fetchWeather>>) {
  // Wrap delete + insert in a transaction for atomicity
  return db.transaction((tx) => {
    tx.delete(weatherCache).where(eq(weatherCache.locationId, locationId)).run();

    return tx
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
  });
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

  // Get all plant instances for this location in one query
  const allInstances = await db.query.plantInstances.findMany({
    where: inArray(plantInstances.zoneId, zoneIds),
    with: { plantReference: true },
  });

  if (allInstances.length === 0) return 0;

  // Get latest weather (single query)
  const cached = db
    .select()
    .from(weatherCache)
    .where(eq(weatherCache.locationId, locationId))
    .orderBy(desc(weatherCache.fetchedAt))
    .limit(1)
    .all();
  const weather = cached[0] ?? null;

  // Batch-fetch all water care tasks for these instances
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
