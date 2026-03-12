import type { PlantMood, PlantStatus, PlantInstance, CareTask, Weather } from "../api";

interface MoodContext {
  plant: PlantInstance;
  tasks?: CareTask[];
  weather?: Weather | null;
}

/**
 * Calculate what a plant's mood SHOULD be based on care history, weather, and status.
 *
 * Priority:
 *  1. Status-based (dormant -> sleeping, planned/new -> new, dead/removed -> wilting)
 *  2. Weather-based (too cold or too hot for the plant)
 *  3. Care-based (overdue tasks -> thirsty/wilting)
 *  4. Default: happy
 */
export function calculateMood(ctx: MoodContext): PlantMood {
  const { plant, tasks, weather } = ctx;

  // Status-based moods take priority
  if (plant.status === "dormant") return "sleeping";
  if (plant.status === "planned" || plant.status === "planted") {
    // If recently planted (no tasks completed yet), treat as new
    const hasCompletedTasks = tasks?.some((t) => t.updatedAt !== t.createdAt);
    if (!hasCompletedTasks) return "new";
  }
  if (plant.status === "dead" || plant.status === "removed") return "wilting";
  if (plant.status === "struggling") return "wilting";

  // Weather-based moods
  const ref = plant.plantReference;
  if (weather?.temperature != null && ref) {
    const temp = weather.temperature;
    const minTemp = ref.minTempF;
    const maxTemp = ref.maxTempF;

    if (minTemp != null && temp < minTemp) return "cold";
    if (maxTemp != null && temp > maxTemp) return "hot";
    // General thresholds if plant-specific data not available
    if (temp < 35) return "cold";
    if (temp > 100) return "hot";
  }

  // Care-based moods: check for overdue tasks
  if (tasks && tasks.length > 0) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return t.dueDate < todayStr;
    });

    if (overdueTasks.length > 0) {
      // Check how overdue - more than 3 days is wilting, less is thirsty
      const mostOverdue = overdueTasks.reduce((worst, t) => {
        if (!worst.dueDate) return t;
        if (!t.dueDate) return worst;
        return t.dueDate < worst.dueDate ? t : worst;
      }, overdueTasks[0]!);

      if (mostOverdue.dueDate) {
        const dueDate = new Date(mostOverdue.dueDate + "T00:00:00");
        const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 3) return "wilting";
        return "thirsty";
      }
    }
  }

  return "happy";
}

/**
 * Get the current season name based on month.
 */
export function getCurrentSeason(month?: number): string {
  const m = month ?? new Date().getMonth(); // 0-indexed
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

/**
 * Get a seasonal garden summary message.
 */
export function getSeasonalSummary(month?: number, hardinessZone?: string | null): string {
  const season = getCurrentSeason(month);
  const m = month ?? new Date().getMonth();

  const earlyMidLate = (start: number) => {
    const offset = m - start;
    if (offset === 0) return "early";
    if (offset === 1) return "mid";
    return "late";
  };

  switch (season) {
    case "spring": {
      const timing = earlyMidLate(2);
      if (timing === "early")
        return "The garden is waking up! Check for frost damage and start planning your beds.";
      if (timing === "mid")
        return "Things are warming up! Harden off seedlings and keep an eye on late frosts.";
      return "Frost risk is fading — time to get warm-season plants in the ground!";
    }
    case "summer": {
      const timing = earlyMidLate(5);
      if (timing === "early")
        return "Growing season is in full swing. Water deeply and watch for pests.";
      if (timing === "mid")
        return "Peak summer! Your plants are working hard — keep them hydrated.";
      return "The garden's still going strong. Start thinking about fall plantings.";
    }
    case "fall": {
      const timing = earlyMidLate(8);
      if (timing === "early")
        return "Cooler days ahead. Great time for cool-season crops and bed cleanup.";
      if (timing === "mid")
        return "Bulb planting season! Get them in the ground before the freeze.";
      return "Tuck your tender plants in — winter's almost here.";
    }
    case "winter": {
      if (m === 11)
        return "The garden is resting. Perfect time to plan next year's layout.";
      if (m === 0)
        return "Seed catalog season! Dream big for spring.";
      return "Spring is close. Start seeds indoors and prep those beds.";
    }
    default:
      return "Time to check on your garden!";
  }
}

/**
 * Calculate frost date info from location data.
 */
export function getFrostInfo(lastFrostDate?: string | null, firstFrostDate?: string | null) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let daysSinceLastFrost: number | null = null;
  let daysUntilFirstFrost: number | null = null;
  let frostStatus: "before-last" | "growing-season" | "after-first" | "unknown" = "unknown";

  if (lastFrostDate) {
    // Adjust to current year
    const lastFrostThisYear = `${now.getFullYear()}-${lastFrostDate.slice(5)}`;
    const lastFrostD = new Date(lastFrostThisYear + "T00:00:00");
    daysSinceLastFrost = Math.floor((now.getTime() - lastFrostD.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (firstFrostDate) {
    const firstFrostThisYear = `${now.getFullYear()}-${firstFrostDate.slice(5)}`;
    const firstFrostD = new Date(firstFrostThisYear + "T00:00:00");
    daysUntilFirstFrost = Math.floor((firstFrostD.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (daysSinceLastFrost != null && daysSinceLastFrost < 0) {
    frostStatus = "before-last";
  } else if (daysUntilFirstFrost != null && daysUntilFirstFrost < 0) {
    frostStatus = "after-first";
  } else if (daysSinceLastFrost != null && daysSinceLastFrost >= 0) {
    frostStatus = "growing-season";
  }

  return { daysSinceLastFrost, daysUntilFirstFrost, frostStatus };
}
