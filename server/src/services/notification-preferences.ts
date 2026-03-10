import { db } from "../db/index.js";
import {
  notificationPreferences,
  type CareTask,
  type PlantInstance,
  type Zone,
} from "../db/schema.js";
import { eq } from "drizzle-orm";

// ─── Task type to notification field mapping ─────────────────────────────────

type NotifyField = "notifyWater" | "notifyFertilize" | "notifyPrune" | "notifyRepot" | "notifyInspect" | "notifyProtect";

const TASK_TYPE_TO_FIELD: Record<string, NotifyField> = {
  water: "notifyWater",
  fertilize: "notifyFertilize",
  prune: "notifyPrune",
  repot: "notifyRepot",
  inspect: "notifyInspect",
  protect: "notifyProtect",
};

const ALL_TASK_TYPES = [
  "water", "fertilize", "prune", "mulch", "harvest",
  "protect", "move", "repot", "inspect", "custom",
] as const;

// ─── Resolve whether a notification should be sent ───────────────────────────

export async function shouldNotify(
  task: CareTask,
  plantInstance?: PlantInstance | null,
  zone?: Zone | null,
): Promise<boolean> {
  // 1. Task-level explicit opt-out
  if (task.sendNotification === false) {
    return false;
  }

  // 2. Plant-instance-level override
  const field = TASK_TYPE_TO_FIELD[task.taskType];
  if (field && plantInstance) {
    const plantOverride = plantInstance[field];
    if (plantOverride !== null && plantOverride !== undefined) {
      return plantOverride;
    }
  }

  // 3. Zone-level override
  if (field && zone) {
    const zoneOverride = zone[field];
    if (zoneOverride !== null && zoneOverride !== undefined) {
      return zoneOverride;
    }
  }

  // 4. Global notification preferences
  const pref = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.taskType, task.taskType),
  });
  if (pref) {
    return pref.enabled;
  }

  // 5. Default: true
  return true;
}

// ─── Get resolved preferences for all task types ─────────────────────────────

export async function getResolvedPreferences(): Promise<
  Record<string, { enabled: boolean; frequency: string }>
> {
  const prefs = await db.select().from(notificationPreferences).all();

  const prefMap = new Map(prefs.map((p) => [p.taskType, p]));

  const result: Record<string, { enabled: boolean; frequency: string }> = {};

  for (const taskType of ALL_TASK_TYPES) {
    const pref = prefMap.get(taskType);
    result[taskType] = {
      enabled: pref?.enabled ?? true,
      frequency: pref?.frequency ?? "daily_digest",
    };
  }

  return result;
}
