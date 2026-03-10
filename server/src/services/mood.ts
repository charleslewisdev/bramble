import type {
  PlantInstance,
  PlantReference,
  CareTaskLog,
} from "../db/schema.js";
import type { WeatherCacheEntry } from "../db/schema.js";

export type PlantMood = "happy" | "thirsty" | "cold" | "hot" | "wilting" | "sleeping" | "new";

export interface MoodContext {
  weather?: WeatherCacheEntry | null;
  lastWaterLog?: CareTaskLog | null;
  waterIntervalDays?: number | null;
}

export function calculatePlantMood(
  instance: PlantInstance,
  ref: PlantReference,
  context?: MoodContext,
): PlantMood {
  // Dormant plants are sleeping
  if (instance.status === "dormant") return "sleeping";

  // Dead or removed plants are wilting
  if (instance.status === "dead" || instance.status === "removed") return "wilting";

  // Planned plants or those without a planted date are new
  if (instance.status === "planned" || !instance.datePlanted) return "new";

  // Weather-based checks
  const weather = context?.weather;
  if (weather) {
    // Cold check: current temp below plant's minimum
    if (ref.minTempF != null && weather.temperature != null && weather.temperature < ref.minTempF) {
      return "cold";
    }

    // Hot check: current temp above plant's maximum
    if (ref.maxTempF != null && weather.temperature != null && weather.temperature > ref.maxTempF) {
      return "hot";
    }
  }

  // Thirsty check: last watering was > 2x the interval ago
  if (context?.lastWaterLog && context.waterIntervalDays) {
    const lastWatered = new Date(context.lastWaterLog.completedAt);
    const now = new Date();
    const daysSinceWatered = (now.getTime() - lastWatered.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceWatered > context.waterIntervalDays * 2) {
      return "thirsty";
    }
  }

  // Struggling plants are wilting
  if (instance.status === "struggling") return "wilting";

  // Default: happy
  return "happy";
}
