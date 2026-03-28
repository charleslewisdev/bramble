import { db } from "../db/index.js";
import {
  plantInstances,
  plantReferences,
  careTasks,
  careTaskLogs,
  zones,
  weatherCache,
} from "../db/schema.js";
import { eq, and, desc, gte, isNull, sql } from "drizzle-orm";
import type { DayForecast } from "./weather.js";

/**
 * Check weather forecasts and generate "move" care tasks for container plants
 * marked as outdoorCandidate. Creates tasks to move plants outdoors when safe,
 * or bring them indoors urgently when cold is forecast.
 */
export async function checkOutdoorMovement(
  locationId: number,
): Promise<{ created: number }> {
  const today = new Date().toISOString().split("T")[0]!;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0]!;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0]!;

  // Get the latest weather cache for this location
  const cached = db
    .select()
    .from(weatherCache)
    .where(eq(weatherCache.locationId, locationId))
    .orderBy(desc(weatherCache.fetchedAt))
    .limit(1)
    .all();

  const weather = cached[0];
  if (!weather?.forecastJson) return { created: 0 };

  const forecastJson = weather.forecastJson;
  if (!Array.isArray(forecastJson)) return { created: 0 };
  const forecast = forecastJson as DayForecast[];
  if (forecast.length === 0) return { created: 0 };

  // Get next 3 days of forecast (skip today, take tomorrow + 2 more)
  const tomorrowIdx = forecast.findIndex((d) => d.date === tomorrow);
  const next3Days =
    tomorrowIdx >= 0 ? forecast.slice(tomorrowIdx, tomorrowIdx + 3) : [];
  const tomorrowForecast =
    tomorrowIdx >= 0 ? forecast[tomorrowIdx] : undefined;

  // Get all outdoor candidate plants with their zone and reference data
  const candidates = db
    .select({
      instance: plantInstances,
      zone: zones,
      reference: plantReferences,
    })
    .from(plantInstances)
    .innerJoin(
      plantReferences,
      eq(plantInstances.plantReferenceId, plantReferences.id),
    )
    .leftJoin(zones, eq(plantInstances.zoneId, zones.id))
    .where(eq(plantInstances.outdoorCandidate, true))
    .all();

  let created = 0;

  for (const { instance, zone, reference } of candidates) {
    const minTempF = reference.minTempF;
    if (minTempF == null) continue; // Can't evaluate without temp threshold

    const plantName =
      instance.nickname ?? reference.commonName;
    const threshold = minTempF + 5;
    const zoneExposure = zone?.exposure ?? "outdoor";

    // Check for existing pending move task within last 2 days (deduplication)
    const existingTask = db
      .select({ id: careTasks.id })
      .from(careTasks)
      .leftJoin(careTaskLogs, eq(careTaskLogs.careTaskId, careTasks.id))
      .where(
        and(
          eq(careTasks.plantInstanceId, instance.id),
          eq(careTasks.taskType, "move"),
          gte(careTasks.dueDate, sevenDaysAgo),
          isNull(careTaskLogs.id),
        ),
      )
      .limit(1)
      .all();

    if (existingTask.length > 0) continue;

    // BRING INDOORS — urgent
    if (
      zoneExposure !== "indoor" &&
      tomorrowForecast &&
      tomorrowForecast.temperatureMin < threshold
    ) {
      db.insert(careTasks)
        .values({
          plantInstanceId: instance.id,
          zoneId: instance.zoneId,
          locationId,
          taskType: "move",
          title: `Bring ${plantName} indoors — cold tonight!`,
          description: `Tomorrow's low is ${tomorrowForecast.temperatureMin}°F, below ${plantName}'s safe threshold of ${minTempF}°F.`,
          dueDate: today,
          isRecurring: false,
          sendNotification: true,
          plantMessage:
            "Brrr! It's going to be cold tonight — bring me inside please!",
        })
        .run();
      created++;
      continue;
    }

    // MOVE OUTDOORS — safe conditions
    if (zoneExposure === "indoor" && next3Days.length >= 3) {
      const allLowsAboveThreshold = next3Days.every(
        (d) => d.temperatureMin > threshold,
      );
      const allHighsAbove50 = next3Days.every(
        (d) => d.temperatureMax > 50,
      );

      if (allLowsAboveThreshold && allHighsAbove50) {
        db.insert(careTasks)
          .values({
            plantInstanceId: instance.id,
            zoneId: instance.zoneId,
            locationId,
            taskType: "move",
            title: `Move ${plantName} outdoors`,
            description: `Weather looks great! All lows above ${threshold}°F for the next 3 days.`,
            dueDate: tomorrow,
            isRecurring: false,
            sendNotification: true,
          })
          .run();
        created++;
      }
    }
  }

  return { created };
}
