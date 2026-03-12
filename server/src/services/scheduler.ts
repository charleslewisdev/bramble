import { db } from "../db/index.js";
import {
  careTasks,
  careTaskLogs,
  dailyWeather,
  locations,
  notificationChannels,
  notificationLogs,
  plantInstances,
  weatherCache,
  zones,
} from "../db/schema.js";
import { eq, lte, and, desc, inArray, sql } from "drizzle-orm";
import { shouldNotify } from "./notification-preferences.js";
import { sendNotification } from "./notifications.js";
import { fetchWeather } from "./weather.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const ONE_MINUTE_MS = 60 * 1000;

// Rain-related weather codes from Open-Meteo
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const FROST_TEMP_F = 32;
const RAIN_THRESHOLD_INCHES = 0.25;

// ─── Daily digest ────────────────────────────────────────────────────────────

async function buildDigest(): Promise<{
  title: string;
  message: string;
  taskIds: number[];
} | null> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const threeDaysOut = new Date();
  threeDaysOut.setDate(threeDaysOut.getDate() + 3);
  const threeDaysStr = threeDaysOut.toISOString().split("T")[0]!;

  // Get all tasks that are due today or earlier (not completed)
  const allTasks = await db.query.careTasks.findMany({
    where: lte(careTasks.dueDate, threeDaysStr),
    with: {
      plantInstance: {
        with: { plantReference: true, zone: true },
      },
      zone: true,
      location: true,
      logs: true,
    },
  });

  // Filter out tasks that have been completed/skipped after their due date
  const activeTasks = allTasks.filter((task) => {
    if (!task.dueDate) return false;
    // Check if there's a completion log on or after the due date
    const hasRecentCompletion = task.logs.some((log) => {
      const logDate = log.completedAt.split("T")[0]!;
      return logDate >= task.dueDate! && (log.action === "completed" || log.action === "skipped");
    });
    return !hasRecentCompletion;
  });

  // Filter out tasks for plants that aren't actively growing
  const INACTIVE_STATUSES = new Set(["planned", "dead", "removed"]);
  const livingTasks = activeTasks.filter((task) => {
    if (!task.plantInstance) return true; // zone-only or location-only tasks
    return !INACTIVE_STATUSES.has(task.plantInstance.status);
  });

  if (livingTasks.length === 0) return null;

  // Resolve notification preferences for each task
  const notifyTasks = [];
  for (const task of livingTasks) {
    const should = await shouldNotify(
      task,
      task.plantInstance,
      task.plantInstance?.zone ?? task.zone,
    );
    if (should) notifyTasks.push(task);
  }

  if (notifyTasks.length === 0) return null;

  // Check weather for rain/frost hints
  const weatherHints = await getWeatherHints();

  // Group tasks into overdue, today, upcoming
  const overdue = notifyTasks.filter((t) => t.dueDate! < todayStr);
  const dueToday = notifyTasks.filter((t) => t.dueDate === todayStr);
  const upcoming = notifyTasks.filter((t) => t.dueDate! > todayStr);

  const lines: string[] = [];

  if (overdue.length > 0) {
    lines.push("--- OVERDUE ---");
    for (const task of overdue) {
      const msg = task.plantMessage ? ` "${task.plantMessage}"` : "";
      const rain = weatherHints.rainForecast && task.taskType === "water" ? " (rain expected — can skip!)" : "";
      lines.push(`  [${task.taskType}] ${task.title} (due ${task.dueDate})${msg}${rain}`);
    }
    lines.push("");
  }

  if (dueToday.length > 0) {
    lines.push("--- DUE TODAY ---");
    for (const task of dueToday) {
      const msg = task.plantMessage ? ` "${task.plantMessage}"` : "";
      const rain = weatherHints.rainForecast && task.taskType === "water" ? " (rain expected — can skip!)" : "";
      lines.push(`  [${task.taskType}] ${task.title}${msg}${rain}`);
    }
    lines.push("");
  }

  if (upcoming.length > 0) {
    lines.push("--- COMING UP (next 3 days) ---");
    for (const task of upcoming) {
      lines.push(`  [${task.taskType}] ${task.title} (due ${task.dueDate})`);
    }
    lines.push("");
  }

  if (weatherHints.frostWarning) {
    lines.push("*** FROST WARNING — check protect tasks for tender plants! ***");
    lines.push("");
  }

  if (weatherHints.rainForecast) {
    lines.push("Rain in forecast — water tasks can likely be skipped.");
    lines.push("");
  }

  const taskIds = notifyTasks.map((t) => t.id);

  return {
    title: `Bramble Daily Digest — ${todayStr}`,
    message: lines.join("\n"),
    taskIds,
  };
}

async function getWeatherHints(): Promise<{ rainForecast: boolean; frostWarning: boolean }> {
  try {
    // Get the most recent weather cache entry
    const latest = await db.query.weatherCache.findFirst({
      orderBy: (wc, { desc }) => [desc(wc.fetchedAt)],
    });

    if (!latest) return { rainForecast: false, frostWarning: false };

    let rainForecast = false;
    let frostWarning = false;

    // Check forecast JSON for rain codes
    if (latest.forecastJson && Array.isArray(latest.forecastJson)) {
      const forecast = latest.forecastJson as Array<{
        weatherCode?: number;
        temperatureMin?: number;
        precipitationProbabilityMax?: number;
      }>;
      for (const day of forecast.slice(0, 2)) {
        if (day.weatherCode !== undefined && RAIN_CODES.has(day.weatherCode)) {
          rainForecast = true;
        }
        if (day.precipitationProbabilityMax !== undefined && day.precipitationProbabilityMax >= 70) {
          rainForecast = true;
        }
        if (day.temperatureMin !== undefined && day.temperatureMin <= FROST_TEMP_F) {
          frostWarning = true;
        }
      }
    }

    // Also check current conditions
    if (latest.temperatureLow !== null && latest.temperatureLow !== undefined && latest.temperatureLow <= FROST_TEMP_F) {
      frostWarning = true;
    }

    return { rainForecast, frostWarning };
  } catch (err) {
    console.error("[Scheduler] Weather hints error:", err);
    return { rainForecast: false, frostWarning: false };
  }
}

// ─── Send digest to all enabled channels ─────────────────────────────────────

async function sendDigest(): Promise<void> {
  const digest = await buildDigest();
  if (!digest) {
    console.log("[Scheduler] No tasks to notify about today.");
    return;
  }

  const channels = await db.select().from(notificationChannels).all();
  const enabledChannels = channels.filter((c) => c.enabled);

  if (enabledChannels.length === 0) {
    console.log("[Scheduler] No enabled notification channels — digest not sent.");
    return;
  }

  for (const channel of enabledChannels) {
    const success = await sendNotification(channel, digest.title, digest.message);

    // Log the notification
    db.insert(notificationLogs)
      .values({
        channelId: channel.id,
        title: digest.title,
        message: digest.message,
        taskIds: digest.taskIds,
        success,
      })
      .run();
  }

  // Update lastNotifiedAt on each task
  const now = new Date().toISOString();
  for (const taskId of digest.taskIds) {
    db.update(careTasks)
      .set({ lastNotifiedAt: now, updatedAt: now })
      .where(eq(careTasks.id, taskId))
      .run();
  }

  console.log(`[Scheduler] Digest sent for ${digest.taskIds.length} tasks to ${enabledChannels.length} channels.`);
}

// ─── Exported digest builder for manual trigger ──────────────────────────────

export { sendDigest };

// ─── Rain auto-completion ─────────────────────────────────────────────────────

async function autoCompleteRainTasks(): Promise<void> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const allLocations = db.select().from(locations).all();

  for (const location of allLocations) {
    try {
      // Get latest weather cache for this location
      const cached = db.select().from(weatherCache)
        .where(eq(weatherCache.locationId, location.id))
        .orderBy(desc(weatherCache.fetchedAt))
        .limit(1).all();

      const latest = cached[0];
      if (!latest?.forecastJson) continue;

      const forecast = latest.forecastJson as Array<{
        date: string;
        precipitationSum: number;
        temperatureMax?: number;
        temperatureMin?: number;
        conditions?: string;
      }>;

      const todayForecast = forecast.find((d) => d.date === todayStr);
      if (!todayForecast) continue;

      // Upsert daily weather record with forecast data
      const existing = db.select().from(dailyWeather)
        .where(and(
          eq(dailyWeather.locationId, location.id),
          eq(dailyWeather.date, todayStr),
        )).all();

      if (existing.length === 0) {
        db.insert(dailyWeather).values({
          locationId: location.id,
          date: todayStr,
          precipitationForecast: todayForecast.precipitationSum,
          temperatureHigh: todayForecast.temperatureMax ?? null,
          temperatureLow: todayForecast.temperatureMin ?? null,
          conditions: todayForecast.conditions ?? null,
        }).run();
      } else {
        db.update(dailyWeather).set({
          precipitationForecast: todayForecast.precipitationSum,
        }).where(eq(dailyWeather.id, existing[0]!.id)).run();
      }

      // If forecast precipitation below threshold, skip
      if (todayForecast.precipitationSum < RAIN_THRESHOLD_INCHES) continue;

      // Find outdoor zones for this location
      const locationZones = db.select().from(zones)
        .where(and(
          eq(zones.locationId, location.id),
          eq(zones.exposure, "outdoor"),
        )).all();

      const zoneIds = locationZones.map((z) => z.id);
      if (zoneIds.length === 0) continue;

      // Get plant instances in outdoor zones (exclude inactive)
      const outdoorPlants = db.select().from(plantInstances)
        .where(inArray(plantInstances.zoneId, zoneIds)).all();

      const plantIds = outdoorPlants
        .filter((p) => !["planned", "dead", "removed"].includes(p.status))
        .map((p) => p.id);
      if (plantIds.length === 0) continue;

      // Find due/overdue water tasks for these plants
      const waterTasks = db.select().from(careTasks)
        .where(and(
          inArray(careTasks.plantInstanceId, plantIds),
          eq(careTasks.taskType, "water"),
          lte(careTasks.dueDate, todayStr),
        )).all();

      if (waterTasks.length === 0) continue;

      let completedCount = 0;
      db.transaction((tx) => {
        for (const task of waterTasks) {
          // Check for existing completion on/after due date
          const existingLog = db.select().from(careTaskLogs)
            .where(and(
              eq(careTaskLogs.careTaskId, task.id),
              sql`date(${careTaskLogs.completedAt}) >= ${task.dueDate}`,
            )).limit(1).all();

          if (existingLog.length > 0) continue;

          // Auto-complete with rain provisional flag
          tx.insert(careTaskLogs).values({
            careTaskId: task.id,
            action: "completed",
            notes: `Auto-watered: rain forecasted (${todayForecast.precipitationSum.toFixed(2)}" expected)`,
            rainProvisional: true,
          }).run();

          // Advance due date if recurring
          if (task.isRecurring && task.intervalDays && task.dueDate) {
            const baseDate = new Date(task.dueDate) < new Date() ? new Date() : new Date(task.dueDate);
            const nextDue = new Date(baseDate);
            nextDue.setDate(nextDue.getDate() + task.intervalDays);
            tx.update(careTasks).set({
              dueDate: nextDue.toISOString().split("T")[0],
              updatedAt: new Date().toISOString(),
            }).where(eq(careTasks.id, task.id)).run();
          }

          completedCount++;
        }
      });

      if (completedCount > 0) {
        console.log(`[Scheduler] Rain auto-completed ${completedCount} water tasks for location ${location.name}`);
      }
    } catch (err) {
      console.error(`[Scheduler] Rain auto-complete error for location ${location.id}:`, err);
    }
  }
}

// ─── Evening rain verification ────────────────────────────────────────────────

async function verifyRainCompletion(): Promise<void> {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const allLocations = db.select().from(locations).all();

  for (const location of allLocations) {
    try {
      // Fetch fresh weather to get actual precipitation
      const weather = await fetchWeather(location.latitude, location.longitude);
      const todayForecast = weather.forecast.find((d) => d.date === todayStr);
      const actualPrecip = todayForecast?.precipitationSum ?? weather.current.precipitation;

      // Update daily weather record with actual data
      const record = db.select().from(dailyWeather)
        .where(and(
          eq(dailyWeather.locationId, location.id),
          eq(dailyWeather.date, todayStr),
        )).limit(1).all();

      if (record.length > 0) {
        db.update(dailyWeather).set({
          precipitationActual: actualPrecip,
          temperatureHigh: weather.daily.temperatureMax,
          temperatureLow: weather.daily.temperatureMin,
        }).where(eq(dailyWeather.id, record[0]!.id)).run();
      }

      // Find provisional logs from today
      // We need to filter by location — get care task IDs linked to this location's outdoor zones
      const locationZones = db.select().from(zones)
        .where(and(
          eq(zones.locationId, location.id),
          eq(zones.exposure, "outdoor"),
        )).all();
      const zoneIds = locationZones.map((z) => z.id);
      if (zoneIds.length === 0) continue;

      const outdoorPlants = db.select().from(plantInstances)
        .where(inArray(plantInstances.zoneId, zoneIds)).all();
      const plantIds = outdoorPlants.map((p) => p.id);
      if (plantIds.length === 0) continue;

      const locationTaskIds = db.select({ id: careTasks.id }).from(careTasks)
        .where(inArray(careTasks.plantInstanceId, plantIds)).all()
        .map((t) => t.id);
      if (locationTaskIds.length === 0) continue;

      const provisionalLogs = db.select().from(careTaskLogs)
        .where(and(
          eq(careTaskLogs.rainProvisional, true),
          sql`date(${careTaskLogs.completedAt}) = ${todayStr}`,
          inArray(careTaskLogs.careTaskId, locationTaskIds),
        )).all();

      if (provisionalLogs.length === 0) continue;

      if (actualPrecip >= RAIN_THRESHOLD_INCHES) {
        // Rain confirmed — clear provisional flag
        db.update(careTaskLogs).set({
          rainProvisional: false,
          notes: `Watered by rain (${actualPrecip.toFixed(2)}" recorded)`,
        }).where(and(
          eq(careTaskLogs.rainProvisional, true),
          sql`date(${careTaskLogs.completedAt}) = ${todayStr}`,
          inArray(careTaskLogs.careTaskId, locationTaskIds),
        )).run();

        console.log(`[Scheduler] Rain confirmed for ${location.name} — ${provisionalLogs.length} tasks verified`);
      } else {
        // Rain didn't materialize — undo provisional completions
        db.transaction((tx) => {
          for (const log of provisionalLogs) {
            const task = db.select().from(careTasks)
              .where(eq(careTasks.id, log.careTaskId)).limit(1).all()[0];

            if (task?.isRecurring && task.intervalDays && task.dueDate) {
              // Rewind due date back
              const currentDue = new Date(task.dueDate);
              currentDue.setDate(currentDue.getDate() - task.intervalDays);
              tx.update(careTasks).set({
                dueDate: currentDue.toISOString().split("T")[0],
                updatedAt: new Date().toISOString(),
              }).where(eq(careTasks.id, task.id)).run();
            }

            // Delete the provisional log
            tx.delete(careTaskLogs).where(eq(careTaskLogs.id, log.id)).run();
          }
        });

        console.log(`[Scheduler] Rain didn't materialize for ${location.name} — undid ${provisionalLogs.length} provisional completions`);
      }
    } catch (err) {
      console.error(`[Scheduler] Rain verification error for location ${location.id}:`, err);
    }
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
let digestSentToday = false;
let rainVerifiedToday = false;
let lastDigestDate = "";

export function startScheduler(): void {
  console.log("[Scheduler] Starting scheduler...");

  schedulerIntervalId = setInterval(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]!;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Reset flags at midnight
    if (todayStr !== lastDigestDate) {
      digestSentToday = false;
      rainVerifiedToday = false;
      lastDigestDate = todayStr;
    }

    // Morning digest + rain auto-completion (default 08:00)
    const digestTime = process.env.BRAMBLE_DIGEST_TIME ?? "08:00";
    if (!digestSentToday && currentTime >= digestTime) {
      digestSentToday = true;
      autoCompleteRainTasks()
        .then(() => sendDigest())
        .catch((err) => console.error("[Scheduler] Morning pass error:", err));
    }

    // Evening rain verification (default 20:00)
    const verifyTime = process.env.BRAMBLE_VERIFY_TIME ?? "20:00";
    if (!rainVerifiedToday && currentTime >= verifyTime) {
      rainVerifiedToday = true;
      verifyRainCompletion()
        .catch((err) => console.error("[Scheduler] Evening verification error:", err));
    }
  }, ONE_MINUTE_MS);

  console.log("[Scheduler] Scheduler started. Morning digest + rain check, evening verification.");
}

export function stopScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
  }
  console.log("[Scheduler] Scheduler stopped.");
}
