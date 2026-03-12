import { db } from "../db/index.js";
import {
  careTasks,
  notificationChannels,
  notificationLogs,
} from "../db/schema.js";
import { eq, lte } from "drizzle-orm";
import { shouldNotify } from "./notification-preferences.js";
import { sendNotification } from "./notifications.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

// Rain-related weather codes from Open-Meteo
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const FROST_TEMP_F = 32;

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

// ─── Scheduler ───────────────────────────────────────────────────────────────

let digestIntervalId: ReturnType<typeof setInterval> | null = null;
let weatherIntervalId: ReturnType<typeof setInterval> | null = null;
let digestSentToday = false;
let lastDigestDate = "";

export function startScheduler(): void {
  console.log("[Scheduler] Starting scheduler...");

  // Check every minute if it's time for the daily digest
  digestIntervalId = setInterval(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]!;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Reset flag at midnight
    if (todayStr !== lastDigestDate) {
      digestSentToday = false;
      lastDigestDate = todayStr;
    }

    // Default digest time is 08:00
    const digestTime = process.env.BRAMBLE_DIGEST_TIME ?? "08:00";

    if (!digestSentToday && currentTime >= digestTime) {
      digestSentToday = true;
      sendDigest().catch((err) => {
        console.error("[Scheduler] Digest error:", err);
      });
    }
  }, ONE_MINUTE_MS);

  // Weather-reactive check every 6 hours
  weatherIntervalId = setInterval(() => {
    // The weather hints are already integrated into the digest
    // This interval ensures we log weather-reactive observations
    console.log("[Scheduler] Weather-reactive check running...");
    getWeatherHints()
      .then((hints) => {
        if (hints.frostWarning) {
          console.log("[Scheduler] Frost warning detected — protect task reminders will be included in next digest.");
        }
        if (hints.rainForecast) {
          console.log("[Scheduler] Rain forecasted — water tasks will be marked as skippable in next digest.");
        }
      })
      .catch((err) => {
        console.error("[Scheduler] Weather check error:", err);
      });
  }, 6 * ONE_HOUR_MS);

  console.log("[Scheduler] Scheduler started. Digest will run daily, weather checks every 6 hours.");
}

export function stopScheduler(): void {
  if (digestIntervalId) {
    clearInterval(digestIntervalId);
    digestIntervalId = null;
  }
  if (weatherIntervalId) {
    clearInterval(weatherIntervalId);
    weatherIntervalId = null;
  }
  console.log("[Scheduler] Scheduler stopped.");
}
