/**
 * Shared types derived from Drizzle schema.
 * Used by both server and web packages.
 */

// Re-export all Drizzle-inferred types from the schema
export type {
  Location,
  NewLocation,
  Structure,
  NewStructure,
  Zone,
  NewZone,
  PlantReference,
  NewPlantReference,
  PlantInstance,
  NewPlantInstance,
  PlantPhoto,
  CareTask,
  NewCareTask,
  CareTaskLog,
  ShoppingListItem,
  NewShoppingListItem,
  WeatherCacheEntry,
  NotificationChannel,
  NewNotificationChannel,
  NotificationPreference,
  NotificationLog,
  Setting,
} from "./schema.js";

// ─── Enum-like union types extracted from schema columns ──────────────────────

export type PlantType =
  | "flower"
  | "shrub"
  | "tree"
  | "herb"
  | "grass"
  | "fern"
  | "succulent"
  | "cactus"
  | "vine"
  | "aquatic"
  | "vegetable"
  | "fruit"
  | "houseplant"
  | "groundcover"
  | "bulb";

export type SpriteType =
  | "flower"
  | "shrub"
  | "tree"
  | "herb"
  | "fern"
  | "succulent"
  | "cactus"
  | "vine"
  | "grass"
  | "bulb"
  | "vegetable"
  | "fruit";

export type PlantStatus =
  | "planned"
  | "planted"
  | "established"
  | "struggling"
  | "dormant"
  | "dead"
  | "removed";

export type PlantMood =
  | "happy"
  | "thirsty"
  | "cold"
  | "hot"
  | "wilting"
  | "sleeping"
  | "new";

export type CareTaskType =
  | "water"
  | "fertilize"
  | "prune"
  | "mulch"
  | "harvest"
  | "protect"
  | "move"
  | "repot"
  | "inspect"
  | "custom";

export type SafetyLevel = "safe" | "caution" | "toxic" | "highly_toxic";

export type SunRequirement = "full_sun" | "partial_sun" | "partial_shade" | "full_shade";

export type WaterNeeds = "low" | "moderate" | "high" | "aquatic";

export type ZoneType = "bed" | "container" | "raised_bed" | "lawn" | "patio" | "path" | "indoor" | "greenhouse";

export type ZoneExposure = "outdoor" | "covered" | "indoor" | "greenhouse";

export type RoofType = "flat" | "gable" | "hip" | "shed" | "gambrel" | "pergola" | "gazebo" | "open" | "canopy";

export type NotificationChannelType = "slack" | "discord" | "email" | "pushover" | "ntfy" | "homeassistant";

export type CareTaskLogAction = "completed" | "skipped" | "deferred";

export type NotificationFrequency = "immediate" | "daily_digest" | "weekly_digest";

// ─── Extended client types (with optional joined relations) ───────────────────

import type {
  PlantInstance,
  PlantReference,
  PlantPhoto,
  CareTask,
  Zone,
} from "./schema.js";

/** PlantInstance with optional eagerly-loaded relations */
export interface PlantInstanceWithRelations extends PlantInstance {
  plantReference?: PlantReference;
  zone?: Zone;
  photos?: PlantPhoto[];
  careTasks?: CareTask[];
}

/** CareTask with optional eagerly-loaded relations */
export interface CareTaskWithRelations extends CareTask {
  plantInstance?: PlantInstanceWithRelations;
  zone?: Zone;
}
