import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Locations ───────────────────────────────────────────────────────────────

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  hardinessZone: text("hardiness_zone"),
  lastFrostDate: text("last_frost_date"),
  firstFrostDate: text("first_frost_date"),
  // Site profile (lot boundary as JSON array of {x, y} points in feet)
  lotBoundary: text("lot_boundary", { mode: "json" }).$type<
    { x: number; y: number }[]
  >(),
  lotWidth: real("lot_width"),
  lotDepth: real("lot_depth"),
  compassOrientation: real("compass_orientation"), // degrees from north
  sidewalks: text("sidewalks", { mode: "json" }).$type<
    { edge: "north" | "east" | "south" | "west"; width: number; inset: number }[]
  >(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const locationsRelations = relations(locations, ({ many }) => ({
  structures: many(structures),
  zones: many(zones),
  weatherCache: many(weatherCache),
  dailyWeather: many(dailyWeather),
}));

// ─── Structures (buildings on a location) ────────────────────────────────────

export const structures = sqliteTable("structures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "House", "Garage", "Shed"
  posX: real("pos_x").notNull().default(0), // position on lot grid (feet)
  posY: real("pos_y").notNull().default(0),
  width: real("width").notNull(),
  depth: real("depth").notNull(),
  height: real("height").notNull().default(10),
  stories: integer("stories").notNull().default(1),
  roofType: text("roof_type", {
    enum: ["flat", "gable", "hip", "shed", "gambrel", "pergola", "gazebo", "open", "canopy"],
  })
    .notNull()
    .default("gable"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const structuresRelations = relations(structures, ({ one }) => ({
  location: one(locations, {
    fields: [structures.locationId],
    references: [locations.id],
  }),
}));

// ─── Zones ───────────────────────────────────────────────────────────────────

export const zones = sqliteTable("zones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  zoneType: text("zone_type", {
    enum: ["bed", "container", "raised_bed", "lawn", "patio", "path", "indoor", "greenhouse"],
  }).notNull().default("bed"),
  climbingStructure: text("climbing_structure", {
    enum: ["trellis", "arbor", "pergola", "wall_mount", "fence"],
  }),
  hasPatio: integer("has_patio", { mode: "boolean" }).notNull().default(false),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(0),
  width: real("width").notNull().default(10),
  depth: real("depth").notNull().default(10),
  sunExposure: text("sun_exposure", {
    enum: ["full_sun", "partial_sun", "partial_shade", "full_shade"],
  }).default("partial_sun"),
  soilType: text("soil_type", {
    enum: ["clay", "sandy", "loamy", "silty", "peaty", "chalky", "mixed"],
  }),
  moistureLevel: text("moisture_level", {
    enum: ["dry", "moderate", "moist", "wet"],
  }),
  windExposure: text("wind_exposure", {
    enum: ["sheltered", "moderate", "exposed"],
  }),
  exposure: text("exposure", {
    enum: ["outdoor", "covered", "indoor", "greenhouse"],
  }).notNull().default("outdoor"),
  notes: text("notes"),
  // Notification overrides (null = inherit global defaults)
  notifyWater: integer("notify_water", { mode: "boolean" }),
  notifyFertilize: integer("notify_fertilize", { mode: "boolean" }),
  notifyPrune: integer("notify_prune", { mode: "boolean" }),
  notifyRepot: integer("notify_repot", { mode: "boolean" }),
  notifyInspect: integer("notify_inspect", { mode: "boolean" }),
  notifyProtect: integer("notify_protect", { mode: "boolean" }),
  color: text("color").default("#4ade80"), // for map display
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("zones_location_id_idx").on(table.locationId),
]);

export const zonesRelations = relations(zones, ({ one, many }) => ({
  location: one(locations, {
    fields: [zones.locationId],
    references: [locations.id],
  }),
  plantInstances: many(plantInstances),
}));

// ─── Plant Reference Database ────────────────────────────────────────────────

export const plantReferences = sqliteTable("plant_references", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commonName: text("common_name").notNull(),
  latinName: text("latin_name"),
  cultivar: text("cultivar"),
  family: text("family"),
  plantType: text("plant_type", {
    enum: [
      "flower",
      "shrub",
      "tree",
      "herb",
      "grass",
      "fern",
      "succulent",
      "cactus",
      "vine",
      "aquatic",
      "vegetable",
      "fruit",
      "houseplant",
      "groundcover",
      "bulb",
    ],
  }),
  // Care requirements
  sunRequirement: text("sun_requirement", {
    enum: ["full_sun", "partial_sun", "partial_shade", "full_shade"],
  }),
  waterNeeds: text("water_needs", {
    enum: ["low", "moderate", "high", "aquatic"],
  }),
  soilPreference: text("soil_preference"),
  hardinessZoneMin: integer("hardiness_zone_min"),
  hardinessZoneMax: integer("hardiness_zone_max"),
  // Growth info
  matureHeight: text("mature_height"),
  matureSpread: text("mature_spread"),
  growthRate: text("growth_rate", { enum: ["slow", "moderate", "fast"] }),
  bloomTime: text("bloom_time"), // e.g., "March-May"
  bloomColor: text("bloom_color"),
  foliageType: text("foliage_type", {
    enum: ["evergreen", "deciduous", "semi-evergreen"],
  }),
  // Safety
  toxicityDogs: text("toxicity_dogs", {
    enum: ["safe", "caution", "toxic", "highly_toxic"],
  }).default("safe"),
  toxicityCats: text("toxicity_cats", {
    enum: ["safe", "caution", "toxic", "highly_toxic"],
  }).default("safe"),
  toxicityChildren: text("toxicity_children", {
    enum: ["safe", "caution", "toxic", "highly_toxic"],
  }).default("safe"),
  toxicityNotes: text("toxicity_notes"),
  // Sprite type for pixel art
  spriteType: text("sprite_type", {
    enum: [
      "flower",
      "shrub",
      "tree",
      "herb",
      "fern",
      "succulent",
      "cactus",
      "vine",
      "grass",
      "bulb",
      "vegetable",
      "fruit",
    ],
  }).default("flower"),
  // Extended plant info
  lifecycle: text("lifecycle", {
    enum: ["annual", "biennial", "perennial", "tender_perennial"],
  }),
  plantingNotes: text("planting_notes"),
  pruningNotes: text("pruning_notes"),
  overwinteringNotes: text("overwintering_notes"),
  nativeRegion: text("native_region"),
  deerResistant: integer("deer_resistant", { mode: "boolean" }),
  droughtTolerant: integer("drought_tolerant", { mode: "boolean" }),
  containerSuitable: integer("container_suitable", { mode: "boolean" }),
  attractsPollinators: integer("attracts_pollinators", { mode: "boolean" }),
  attractsBirds: integer("attracts_birds", { mode: "boolean" }),
  attractsButterflies: integer("attracts_butterflies", { mode: "boolean" }),
  companionPlants: text("companion_plants"),
  minTempF: integer("min_temp_f"),
  maxTempF: integer("max_temp_f"),
  // Source tracking
  source: text("source").default("user"),
  externalId: text("external_id"),
  description: text("description"),
  careNotes: text("care_notes"),
  // Fertilizer guidance
  fertilizerType: text("fertilizer_type", {
    enum: ["liquid", "granular", "slow_release", "compost", "compost_tea", "fish_emulsion", "other"],
  }),
  fertilizerNpk: text("fertilizer_npk"), // "10-10-10" format
  fertilizerFrequency: text("fertilizer_frequency"), // "Monthly during growing season"
  fertilizerNotes: text("fertilizer_notes"), // "Acid-loving, avoid alkaline"
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("plant_refs_common_name_idx").on(table.commonName),
  index("plant_refs_external_id_idx").on(table.externalId),
]);

export const plantReferencesRelations = relations(
  plantReferences,
  ({ many }) => ({
    instances: many(plantInstances),
  }),
);

// ─── Plant Instances (user's actual plants) ──────────────────────────────────

export const plantInstances = sqliteTable("plant_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantReferenceId: integer("plant_reference_id")
    .notNull()
    .references(() => plantReferences.id),
  zoneId: integer("zone_id").references(() => zones.id, {
    onDelete: "set null",
  }),
  nickname: text("nickname"), // The tamagotchi name!
  status: text("status", {
    enum: [
      "planned",
      "planted",
      "established",
      "struggling",
      "dormant",
      "dead",
      "removed",
    ],
  })
    .notNull()
    .default("planned"),
  isContainer: integer("is_container", { mode: "boolean" })
    .notNull()
    .default(false),
  containerDescription: text("container_description"),
  containerSize: text("container_size"), // "6 inch", "5 gallon", etc.
  containerShape: text("container_shape", {
    enum: ["round", "square", "rectangular", "oval", "hanging", "window_box", "other"],
  }),
  containerMaterial: text("container_material", {
    enum: ["terracotta", "ceramic", "plastic", "fabric", "metal", "wood", "concrete", "fiberglass", "stone"],
  }),
  outdoorCandidate: integer("outdoor_candidate", { mode: "boolean" })
    .notNull()
    .default(false),
  datePlanted: text("date_planted"),
  dateRemoved: text("date_removed"),
  notes: text("notes"),
  // Notification overrides (null = inherit zone → global defaults)
  notifyWater: integer("notify_water", { mode: "boolean" }),
  notifyFertilize: integer("notify_fertilize", { mode: "boolean" }),
  notifyPrune: integer("notify_prune", { mode: "boolean" }),
  notifyRepot: integer("notify_repot", { mode: "boolean" }),
  notifyInspect: integer("notify_inspect", { mode: "boolean" }),
  notifyProtect: integer("notify_protect", { mode: "boolean" }),
  // Sprite override (user-selected sprite, overrides auto-match from plant type)
  spriteOverride: text("sprite_override", {
    enum: [
      "flower", "shrub", "tree", "herb", "fern", "succulent",
      "cactus", "vine", "grass", "bulb", "vegetable", "fruit",
    ],
  }),
  // Current mood for sprite display
  mood: text("mood", {
    enum: ["happy", "thirsty", "cold", "hot", "wilting", "sleeping", "new"],
  })
    .notNull()
    .default("happy"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("plant_instances_zone_id_idx").on(table.zoneId),
  index("plant_instances_ref_id_idx").on(table.plantReferenceId),
]);

export const plantInstancesRelations = relations(
  plantInstances,
  ({ one, many }) => ({
    plantReference: one(plantReferences, {
      fields: [plantInstances.plantReferenceId],
      references: [plantReferences.id],
    }),
    zone: one(zones, {
      fields: [plantInstances.zoneId],
      references: [zones.id],
    }),
    photos: many(plantPhotos),
    careTasks: many(careTasks),
  }),
);

// ─── Plant Photos ────────────────────────────────────────────────────────────

export const plantPhotos = sqliteTable("plant_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantInstanceId: integer("plant_instance_id")
    .notNull()
    .references(() => plantInstances.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  caption: text("caption"),
  thumbnailFilename: text("thumbnail_filename"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  takenAt: text("taken_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const plantPhotosRelations = relations(plantPhotos, ({ one }) => ({
  plantInstance: one(plantInstances, {
    fields: [plantPhotos.plantInstanceId],
    references: [plantInstances.id],
  }),
}));

// ─── Care Tasks ──────────────────────────────────────────────────────────────

export const careTasks = sqliteTable("care_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantInstanceId: integer("plant_instance_id").references(
    () => plantInstances.id,
    { onDelete: "cascade" },
  ),
  zoneId: integer("zone_id").references(() => zones.id, {
    onDelete: "cascade",
  }),
  locationId: integer("location_id").references(() => locations.id, {
    onDelete: "cascade",
  }),
  taskType: text("task_type", {
    enum: [
      "water",
      "fertilize",
      "prune",
      "mulch",
      "harvest",
      "protect",
      "move",
      "repot",
      "inspect",
      "status_check",
      "custom",
    ],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  // Scheduling
  dueDate: text("due_date"),
  isRecurring: integer("is_recurring", { mode: "boolean" })
    .notNull()
    .default(false),
  intervalDays: integer("interval_days"), // recurrence interval
  activeMonths: text("active_months", { mode: "json" }).$type<number[]>(), // [3,4,5,6] = Mar-Jun
  // Notification
  sendNotification: integer("send_notification", { mode: "boolean" })
    .notNull()
    .default(true),
  lastNotifiedAt: text("last_notified_at"),
  // Plant-POV message for notifications
  plantMessage: text("plant_message"), // "I could use a trim! 🌿"
  // Set when a one-time (non-recurring) task is completed or skipped. Filtered
  // out of the default list view. Recurring tasks advance dueDate instead.
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("care_tasks_plant_instance_id_idx").on(table.plantInstanceId),
  index("care_tasks_zone_id_idx").on(table.zoneId),
  index("care_tasks_due_date_idx").on(table.dueDate),
  index("care_tasks_completed_at_idx").on(table.completedAt),
]);

export const careTasksRelations = relations(careTasks, ({ one, many }) => ({
  plantInstance: one(plantInstances, {
    fields: [careTasks.plantInstanceId],
    references: [plantInstances.id],
  }),
  zone: one(zones, {
    fields: [careTasks.zoneId],
    references: [zones.id],
  }),
  location: one(locations, {
    fields: [careTasks.locationId],
    references: [locations.id],
  }),
  logs: many(careTaskLogs),
}));

// ─── Care Task Logs (completion tracking) ────────────────────────────────────

export const careTaskLogs = sqliteTable("care_task_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  careTaskId: integer("care_task_id")
    .notNull()
    .references(() => careTasks.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["completed", "skipped", "deferred"] })
    .notNull()
    .default("completed"),
  notes: text("notes"),
  photoId: integer("photo_id").references(() => plantPhotos.id, {
    onDelete: "set null",
  }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  rainProvisional: integer("rain_provisional", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("care_task_logs_care_task_id_idx").on(table.careTaskId),
]);

export const careTaskLogsRelations = relations(careTaskLogs, ({ one }) => ({
  careTask: one(careTasks, {
    fields: [careTaskLogs.careTaskId],
    references: [careTasks.id],
  }),
  photo: one(plantPhotos, {
    fields: [careTaskLogs.photoId],
    references: [plantPhotos.id],
  }),
}));

// ─── Journal Entries ──────────────────────────────────────────────────────────

export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  plantInstanceId: integer("plant_instance_id").references(() => plantInstances.id, {
    onDelete: "cascade",
  }),
  zoneId: integer("zone_id").references(() => zones.id, { onDelete: "set null" }),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  entryType: text("entry_type", {
    enum: ["observation", "status_check", "care_log", "milestone", "identification"],
  }).notNull(),
  title: text("title"),
  body: text("body"),
  careTaskLogId: integer("care_task_log_id").references(() => careTaskLogs.id, {
    onDelete: "set null",
  }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("journal_entries_plant_instance_id_idx").on(table.plantInstanceId),
  index("journal_entries_zone_id_idx").on(table.zoneId),
  index("journal_entries_location_id_idx").on(table.locationId),
  index("journal_entries_created_at_idx").on(table.createdAt),
]);

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  plantInstance: one(plantInstances, {
    fields: [journalEntries.plantInstanceId],
    references: [plantInstances.id],
  }),
  zone: one(zones, {
    fields: [journalEntries.zoneId],
    references: [zones.id],
  }),
  location: one(locations, {
    fields: [journalEntries.locationId],
    references: [locations.id],
  }),
  careTaskLog: one(careTaskLogs, {
    fields: [journalEntries.careTaskLogId],
    references: [careTaskLogs.id],
  }),
  photos: many(journalPhotos),
}));

// ─── Journal Photos (join table) ─────────────────────────────────────────────

export const journalPhotos = sqliteTable("journal_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journalEntryId: integer("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id, { onDelete: "cascade" }),
  plantPhotoId: integer("plant_photo_id")
    .notNull()
    .references(() => plantPhotos.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const journalPhotosRelations = relations(journalPhotos, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalPhotos.journalEntryId],
    references: [journalEntries.id],
  }),
  plantPhoto: one(plantPhotos, {
    fields: [journalPhotos.plantPhotoId],
    references: [plantPhotos.id],
  }),
}));

// ─── Shopping List ───────────────────────────────────────────────────────────

export const shoppingListItems = sqliteTable("shopping_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  isChecked: integer("is_checked", { mode: "boolean" })
    .notNull()
    .default(false),
  notes: text("notes"),
  plantReferenceId: integer("plant_reference_id").references(
    () => plantReferences.id,
  ),
  category: text("category", {
    enum: ["plant", "soil", "fertilizer", "tool", "container", "other"],
  }),
  estimatedCost: real("estimated_cost"),
  vendorName: text("vendor_name"),
  purchasedAt: text("purchased_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const shoppingListItemsRelations = relations(
  shoppingListItems,
  ({ one }) => ({
    plantReference: one(plantReferences, {
      fields: [shoppingListItems.plantReferenceId],
      references: [plantReferences.id],
    }),
  }),
);

// ─── Fertilizer Inventory ───────────────────────────────────────────────────

export const fertilizers = sqliteTable("fertilizers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["liquid", "granular", "slow_release", "compost", "compost_tea", "fish_emulsion", "other"],
  }).notNull(),
  npkN: real("npk_n"),
  npkP: real("npk_p"),
  npkK: real("npk_k"),
  organic: integer("organic", { mode: "boolean" }).notNull().default(false),
  status: text("status", {
    enum: ["have_it", "running_low", "out"],
  }).notNull().default("have_it"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("fertilizers_location_id_idx").on(table.locationId),
]);

export const fertilizersRelations = relations(fertilizers, ({ one }) => ({
  location: one(locations, {
    fields: [fertilizers.locationId],
    references: [locations.id],
  }),
}));

// ─── Weather Cache ───────────────────────────────────────────────────────────

export const weatherCache = sqliteTable("weather_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  temperature: real("temperature"),
  temperatureHigh: real("temperature_high"),
  temperatureLow: real("temperature_low"),
  humidity: real("humidity"),
  precipitation: real("precipitation"),
  windSpeed: real("wind_speed"),
  conditions: text("conditions"),
  forecastJson: text("forecast_json", { mode: "json" }),
  uvIndex: real("uv_index"),
  precipitationProbability: integer("precipitation_probability"),
  soilTemperature: real("soil_temperature"),
  windGust: real("wind_gust"),
  fetchedAt: text("fetched_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("weather_cache_location_fetched_idx").on(table.locationId, table.fetchedAt),
]);

export const weatherCacheRelations = relations(weatherCache, ({ one }) => ({
  location: one(locations, {
    fields: [weatherCache.locationId],
    references: [locations.id],
  }),
}));

// ─── Daily Weather Records ──────────────────────────────────────────────────

export const dailyWeather = sqliteTable("daily_weather", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: integer("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  precipitationForecast: real("precipitation_forecast"), // inches, from morning forecast
  precipitationActual: real("precipitation_actual"), // inches, verified evening
  temperatureHigh: real("temperature_high"),
  temperatureLow: real("temperature_low"),
  conditions: text("conditions"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("daily_weather_location_date_idx").on(table.locationId, table.date),
]);

export const dailyWeatherRelations = relations(dailyWeather, ({ one }) => ({
  location: one(locations, {
    fields: [dailyWeather.locationId],
    references: [locations.id],
  }),
}));

// ─── Notification Channels ───────────────────────────────────────────────────

export const notificationChannels = sqliteTable("notification_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["slack", "discord", "email", "pushover", "ntfy", "homeassistant"],
  }).notNull(),
  config: text("config", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd: text("quiet_hours_end"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Notification Preferences (global defaults by task type) ─────────────────

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskType: text("task_type", {
    enum: [
      "water", "fertilize", "prune", "mulch", "harvest",
      "protect", "move", "repot", "inspect", "status_check", "custom",
    ],
  }).notNull().unique(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  // Digest settings
  digestTime: text("digest_time").default("08:00"), // When to send daily digest
  frequency: text("frequency", {
    enum: ["immediate", "daily_digest", "weekly_digest"],
  }).notNull().default("daily_digest"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Notification Log (what was actually sent) ──────────────────────────────

export const notificationLogs = sqliteTable("notification_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").references(() => notificationChannels.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  taskIds: text("task_ids", { mode: "json" }).$type<number[]>(),
  success: integer("success", { mode: "boolean" }).notNull(),
  sentAt: text("sent_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Settings ───────────────────────────────────────────────────────────────

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", {
    enum: ["groundskeeper", "gardener", "helper"],
  }).notNull(),
  avatarUrl: text("avatar_url"),
  lastLoginAt: text("last_login_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("users_username_idx").on(table.username),
]);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // random 256-bit token
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ─── Invites ────────────────────────────────────────────────────────────────

export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  role: text("role", {
    enum: ["gardener", "helper"],
  }).notNull(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  claimedBy: integer("claimed_by").references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("invites_token_idx").on(table.token),
]);

export const invitesRelations = relations(invites, ({ one }) => ({
  creator: one(users, {
    fields: [invites.createdBy],
    references: [users.id],
  }),
}));

// ─── API Keys ───────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // label, e.g. "Home Assistant"
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the key
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for display ("brk_a1b2...")
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("api_keys_key_hash_idx").on(table.keyHash),
]);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

// ─── Almanac (user-authored knowledge base) ─────────────────────────────────

export const almanacEntries = sqliteTable("almanac_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull().default(""),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("almanac_entries_slug_idx").on(table.slug),
  index("almanac_entries_updated_at_idx").on(table.updatedAt),
]);

export const almanacTags = sqliteTable("almanac_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const almanacEntryTags = sqliteTable("almanac_entry_tags", {
  entryId: integer("entry_id")
    .notNull()
    .references(() => almanacEntries.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => almanacTags.id, { onDelete: "cascade" }),
}, (table) => [
  index("almanac_entry_tags_entry_id_idx").on(table.entryId),
  index("almanac_entry_tags_tag_id_idx").on(table.tagId),
]);

export const almanacImages = sqliteTable("almanac_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id")
    .notNull()
    .references(() => almanacEntries.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("almanac_images_entry_id_idx").on(table.entryId),
]);

export const almanacEntriesRelations = relations(almanacEntries, ({ many }) => ({
  entryTags: many(almanacEntryTags),
  images: many(almanacImages),
}));

export const almanacTagsRelations = relations(almanacTags, ({ many }) => ({
  entryTags: many(almanacEntryTags),
}));

export const almanacEntryTagsRelations = relations(almanacEntryTags, ({ one }) => ({
  entry: one(almanacEntries, {
    fields: [almanacEntryTags.entryId],
    references: [almanacEntries.id],
  }),
  tag: one(almanacTags, {
    fields: [almanacEntryTags.tagId],
    references: [almanacTags.id],
  }),
}));

export const almanacImagesRelations = relations(almanacImages, ({ one }) => ({
  entry: one(almanacEntries, {
    fields: [almanacImages.entryId],
    references: [almanacEntries.id],
  }),
}));

// ─── Type exports ────────────────────────────────────────────────────────────

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Structure = typeof structures.$inferSelect;
export type NewStructure = typeof structures.$inferInsert;
export type Zone = typeof zones.$inferSelect;
export type NewZone = typeof zones.$inferInsert;
export type PlantReference = typeof plantReferences.$inferSelect;
export type NewPlantReference = typeof plantReferences.$inferInsert;
export type PlantInstance = typeof plantInstances.$inferSelect;
export type NewPlantInstance = typeof plantInstances.$inferInsert;
export type PlantPhoto = typeof plantPhotos.$inferSelect;
export type CareTask = typeof careTasks.$inferSelect;
export type NewCareTask = typeof careTasks.$inferInsert;
export type CareTaskLog = typeof careTaskLogs.$inferSelect;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type NewShoppingListItem = typeof shoppingListItems.$inferInsert;
export type WeatherCacheEntry = typeof weatherCache.$inferSelect;
export type DailyWeatherRecord = typeof dailyWeather.$inferSelect;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NewNotificationChannel = typeof notificationChannels.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type Fertilizer = typeof fertilizers.$inferSelect;
export type NewFertilizer = typeof fertilizers.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalPhoto = typeof journalPhotos.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type AlmanacEntry = typeof almanacEntries.$inferSelect;
export type NewAlmanacEntry = typeof almanacEntries.$inferInsert;
export type AlmanacTag = typeof almanacTags.$inferSelect;
export type AlmanacImage = typeof almanacImages.$inferSelect;
export type NewAlmanacImage = typeof almanacImages.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
