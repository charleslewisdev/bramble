import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "./api.js";

/** Wrap tool handlers to catch errors and return them as isError content */
type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ToolContent = TextContent | ImageContent;
type ToolResult = { content: ToolContent[]; isError?: boolean };

async function handle(fn: () => Promise<string>): Promise<ToolResult> {
  try {
    const text = await fn();
    return { content: [{ type: "text" as const, text }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
}

/** Like handle() but allows returning mixed text/image content */
async function handleContent(fn: () => Promise<ToolContent[]>): Promise<ToolResult> {
  try {
    return { content: await fn() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
}

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function registerTools(server: McpServer) {
  // ─── Read tools ───────────────────────────────────────────────────────────

  server.tool(
    "get_dashboard",
    "Get a summary of the garden: plants, upcoming care tasks, weather, and alerts for a location",
    { location_id: z.number().optional().describe("Location ID (defaults to first location)") },
    async ({ location_id }) => handle(async () => {
      let locId = location_id;
      if (!locId) {
        const locs = await api.getLocations();
        locId = locs[0]?.id;
      }
      if (!locId) return "No locations found";
      return json(await api.getDashboard(locId));
    }),
  );

  server.tool(
    "list_locations",
    "List all garden locations",
    {},
    async () => handle(async () => json(await api.getLocations())),
  );

  server.tool(
    "list_plants",
    "List all plants in the garden, optionally filtered by zone or status",
    {
      zone_id: z.number().optional().describe("Filter by zone ID"),
      status: z.enum(["planned", "planted", "established", "struggling", "dormant", "dead", "removed"]).optional().describe("Filter by plant status"),
    },
    async ({ zone_id, status }) => handle(async () => {
      const plants = await api.getPlants({ zoneId: zone_id, status });
      const summary = plants.map((p: any) => ({
        id: p.id,
        name: p.nickname ?? p.plantReference?.commonName ?? "Unknown",
        species: p.plantReference?.latinName,
        zone: p.zone?.name ?? "Unassigned",
        status: p.status,
        mood: p.mood,
        container: p.isContainer,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "get_plant",
    "Get detailed information about a specific plant including care history",
    { plant_id: z.number().describe("Plant instance ID") },
    async ({ plant_id }) => handle(async () => json(await api.getPlant(plant_id))),
  );

  server.tool(
    "list_zones",
    "List all garden zones/beds with their details",
    { location_id: z.number().optional().describe("Filter by location ID") },
    async ({ location_id }) => handle(async () => {
      const zones = await api.getZones(location_id);
      const summary = zones.map((z: any) => ({
        id: z.id,
        name: z.name,
        type: z.zoneType,
        sun: z.sunExposure,
        soil: z.soilType,
        moisture: z.moistureLevel,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "list_care_tasks",
    "List care tasks, optionally filtered by plant or upcoming only",
    {
      plant_id: z.number().optional().describe("Filter by plant instance ID"),
      upcoming: z.boolean().optional().describe("Only show upcoming/due tasks"),
    },
    async ({ plant_id, upcoming }) => handle(async () => {
      const tasks = await api.getCareTasks({ plantInstanceId: plant_id, upcoming });
      const summary = tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        type: t.taskType,
        dueDate: t.dueDate,
        plant: t.plantInstance?.nickname ?? t.plantInstance?.plantReference?.commonName ?? null,
        zone: t.zone?.name ?? null,
        recurring: t.isRecurring,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "get_weather",
    "Get current weather and forecast for a location",
    { location_id: z.number().optional().describe("Location ID (defaults to first location)") },
    async ({ location_id }) => handle(async () => {
      let locId = location_id;
      if (!locId) {
        const locs = await api.getLocations();
        locId = locs[0]?.id;
      }
      if (!locId) return "No locations found";
      return json(await api.getWeather(locId));
    }),
  );

  server.tool(
    "get_alerts",
    "Get weather-based alerts (frost warnings, heat warnings, rain skip suggestions) for a location",
    { location_id: z.number().optional().describe("Location ID (defaults to first location)") },
    async ({ location_id }) => handle(async () => {
      let locId = location_id;
      if (!locId) {
        const locs = await api.getLocations();
        locId = locs[0]?.id;
      }
      if (!locId) return "No locations found";
      return json(await api.getAlerts(locId));
    }),
  );

  server.tool(
    "get_shopping_list",
    "Get the current shopping list",
    {},
    async () => handle(async () => json(await api.getShoppingList())),
  );

  server.tool(
    "search_plant_references",
    "Search the plant reference database by name",
    { query: z.string().describe("Search term (common name, latin name, or cultivar)") },
    async ({ query }) => handle(async () => {
      const refs = await api.searchPlantReferences(query);
      const summary = refs.map((r: any) => ({
        id: r.id,
        name: r.commonName,
        latin: r.latinName,
        cultivar: r.cultivar,
        type: r.plantType,
        sun: r.sunRequirement,
        water: r.waterNeeds,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "list_structures",
    "List garden structures (house, sheds, greenhouses, pergolas, etc.) at a location",
    { location_id: z.number().describe("Location ID") },
    async ({ location_id }) => handle(async () => {
      const structures = await api.getStructures(location_id);
      const summary = structures.map((s: any) => ({
        id: s.id,
        name: s.name,
        roofType: s.roofType,
        dimensions: `${s.width}×${s.depth}×${s.height} ft`,
        stories: s.stories,
        position: `(${s.posX}, ${s.posY})`,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "list_plant_photos",
    "List all photos for a plant instance (IDs, filenames, captions, timestamps)",
    { plant_id: z.number().describe("Plant instance ID") },
    async ({ plant_id }) => handle(async () => {
      const photos = await api.getPhotos(plant_id);
      const summary = photos.map((p: any) => ({
        id: p.id,
        filename: p.filename,
        thumbnail: p.thumbnailFilename,
        caption: p.caption,
        createdAt: p.createdAt,
      }));
      return json(summary);
    }),
  );

  server.tool(
    "view_plant_photo",
    "View an actual plant photo (returns the image so Claude can see it). Use list_plant_photos first to get the filename.",
    {
      filename: z.string().describe("Photo filename from list_plant_photos"),
    },
    async ({ filename }) => handleContent(async () => {
      const { data, mimeType } = await api.getPhotoFile(filename);
      const base64 = Buffer.from(data).toString("base64");
      return [{ type: "image" as const, data: base64, mimeType }];
    }),
  );

  server.tool(
    "list_fertilizers",
    "List fertilizers tracked for a location (NPK, stock, usage notes)",
    { location_id: z.number().describe("Location ID") },
    async ({ location_id }) => handle(async () => {
      return json(await api.getFertilizers(location_id));
    }),
  );

  server.tool(
    "get_sun_info",
    "Get sunrise, sunset, day length, and golden hour times for a location",
    {
      location_id: z.number().optional().describe("Location ID (defaults to first)"),
      date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
    },
    async ({ location_id, date }) => handle(async () => {
      let locId = location_id;
      if (!locId) {
        const locs = await api.getLocations();
        locId = locs[0]?.id;
      }
      if (!locId) return "No locations found";
      return json(await api.getSunInfo(locId, date));
    }),
  );

  server.tool(
    "list_wildlife",
    "List seasonal wildlife (birds, pollinators, pests) active at a location",
    { location_id: z.number().optional().describe("Location ID (defaults to first)") },
    async ({ location_id }) => handle(async () => {
      let locId = location_id;
      if (!locId) {
        const locs = await api.getLocations();
        locId = locs[0]?.id;
      }
      if (!locId) return "No locations found";
      return json(await api.getWildlife(locId));
    }),
  );

  server.tool(
    "get_journal",
    "Get journal entries for a plant, zone, or location",
    {
      plant_id: z.number().optional().describe("Plant instance ID"),
      zone_id: z.number().optional().describe("Zone ID"),
      location_id: z.number().optional().describe("Location ID"),
    },
    async ({ plant_id, zone_id, location_id }) => handle(async () => {
      if (!plant_id && !zone_id && !location_id) return "Provide at least one of plant_id, zone_id, or location_id";
      return json(await api.getJournalEntries(plant_id, zone_id, location_id));
    }),
  );

  // ─── Write tools ──────────────────────────────────────────────────────────

  server.tool(
    "complete_care_task",
    "Mark a care task as completed",
    {
      task_id: z.number().describe("Care task ID"),
      notes: z.string().optional().describe("Optional completion notes"),
    },
    async ({ task_id, notes }) => handle(async () => {
      const result = await api.logCareTask(task_id, "completed", notes);
      return `Task completed. Log ID: ${result.id}`;
    }),
  );

  server.tool(
    "skip_care_task",
    "Skip a care task (e.g., watering skipped due to rain)",
    {
      task_id: z.number().describe("Care task ID"),
      notes: z.string().optional().describe("Reason for skipping"),
    },
    async ({ task_id, notes }) => handle(async () => {
      const result = await api.logCareTask(task_id, "skipped", notes);
      return `Task skipped. Log ID: ${result.id}`;
    }),
  );

  server.tool(
    "defer_care_task",
    "Defer a care task to a later date",
    {
      task_id: z.number().describe("Care task ID"),
      notes: z.string().optional().describe("Reason for deferring"),
    },
    async ({ task_id, notes }) => handle(async () => {
      const result = await api.logCareTask(task_id, "deferred", notes);
      return `Task deferred. Log ID: ${result.id}`;
    }),
  );

  server.tool(
    "update_plant",
    "Update a plant instance (status, nickname, notes, mood, zone, etc.)",
    {
      plant_id: z.number().describe("Plant instance ID"),
      status: z.enum(["planned", "planted", "established", "struggling", "dormant", "dead", "removed"]).optional(),
      nickname: z.string().optional(),
      notes: z.string().optional(),
      zone_id: z.number().optional().describe("Move plant to a different zone"),
      mood: z.enum(["happy", "thirsty", "cold", "hot", "wilting", "sleeping", "new"]).optional(),
      date_planted: z.string().optional().describe("Date planted in YYYY-MM-DD format"),
      is_container: z.boolean().optional(),
    },
    async ({ plant_id, status, nickname, notes, zone_id, mood, date_planted, is_container }) => handle(async () => {
      const update: any = {};
      if (status !== undefined) update.status = status;
      if (nickname !== undefined) update.nickname = nickname;
      if (notes !== undefined) update.notes = notes;
      if (zone_id !== undefined) update.zoneId = zone_id;
      if (mood !== undefined) update.mood = mood;
      if (date_planted !== undefined) update.datePlanted = date_planted;
      if (is_container !== undefined) update.isContainer = is_container;
      const result = await api.updatePlant(plant_id, update);
      return `Updated plant ${result.id}: ${result.nickname ?? "unnamed"}`;
    }),
  );

  server.tool(
    "add_plant",
    "Add a new plant instance to a zone. Requires a plant reference ID — search references first if needed.",
    {
      plant_reference_id: z.number().describe("Plant reference ID (search references first)"),
      zone_id: z.number().describe("Zone to plant in"),
      nickname: z.string().optional().describe("Friendly name for this plant"),
      status: z.enum(["planned", "planted", "established"]).optional().default("planted"),
      is_container: z.boolean().optional().default(false),
      notes: z.string().optional(),
    },
    async ({ plant_reference_id, zone_id, nickname, status, is_container, notes }) => handle(async () => {
      const result = await api.createPlant({
        plantReferenceId: plant_reference_id,
        zoneId: zone_id,
        nickname,
        status,
        isContainer: is_container,
        notes,
      });
      return `Created plant ${result.id} in zone ${zone_id}`;
    }),
  );

  server.tool(
    "add_plant_reference",
    "Add a new plant species/cultivar to the reference database",
    {
      common_name: z.string().describe("Common name (e.g., 'Lavender')"),
      latin_name: z.string().optional().describe("Scientific name"),
      cultivar: z.string().optional(),
      plant_type: z.enum(["flower", "shrub", "tree", "herb", "grass", "fern", "succulent", "cactus", "vine", "aquatic", "vegetable", "fruit", "houseplant", "groundcover", "bulb"]),
      sun_requirement: z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]).optional(),
      water_needs: z.enum(["low", "moderate", "high", "aquatic"]).optional(),
      description: z.string().optional(),
    },
    async ({ common_name, latin_name, cultivar, plant_type, sun_requirement, water_needs, description }) => handle(async () => {
      const result = await api.createPlantReference({
        commonName: common_name,
        latinName: latin_name,
        cultivar,
        plantType: plant_type,
        sunRequirement: sun_requirement,
        waterNeeds: water_needs,
        description,
        source: "user",
      });
      return `Created reference ${result.id}: ${result.commonName}`;
    }),
  );

  server.tool(
    "upload_plant_photo",
    "Upload a photo for a plant. Send the image as a base64-encoded string (JPEG or PNG).",
    {
      plant_id: z.number().describe("Plant instance ID"),
      image_base64: z.string().describe("Base64-encoded image data (JPEG or PNG)"),
      caption: z.string().optional().describe("Photo caption/description"),
    },
    async ({ plant_id, image_base64, caption }) => handle(async () => {
      const result = await api.uploadPhoto(plant_id, image_base64, caption);
      return `Photo uploaded for plant ${plant_id}. Photo ID: ${result.id}, filename: ${result.filename}`;
    }),
  );

  server.tool(
    "add_shopping_item",
    "Add an item to the shopping list",
    {
      name: z.string().describe("Item name"),
      quantity: z.number().optional().default(1),
      category: z.enum(["plant", "soil", "fertilizer", "tool", "container", "other"]).optional(),
      notes: z.string().optional(),
      estimated_cost: z.number().optional(),
      vendor_name: z.string().optional(),
    },
    async ({ name, quantity, category, notes, estimated_cost, vendor_name }) => handle(async () => {
      const result = await api.addShoppingItem({
        name, quantity, category, notes,
        estimatedCost: estimated_cost,
        vendorName: vendor_name,
      });
      return `Added "${result.name}" to shopping list (ID: ${result.id})`;
    }),
  );

  server.tool(
    "toggle_shopping_item",
    "Check or uncheck a shopping list item",
    { item_id: z.number().describe("Shopping list item ID") },
    async ({ item_id }) => handle(async () => {
      const result = await api.toggleShoppingItem(item_id);
      return `"${result.name}" is now ${result.isChecked ? "checked" : "unchecked"}`;
    }),
  );

  server.tool(
    "delete_shopping_item",
    "Remove an item from the shopping list",
    { item_id: z.number().describe("Shopping list item ID") },
    async ({ item_id }) => handle(async () => {
      await api.deleteShoppingItem(item_id);
      return `Shopping item ${item_id} deleted`;
    }),
  );

  server.tool(
    "add_journal_entry",
    "Add a journal entry for a plant, zone, or location",
    {
      plant_id: z.number().optional().describe("Plant instance ID"),
      zone_id: z.number().optional().describe("Zone ID"),
      location_id: z.number().optional().describe("Location ID"),
      entry_type: z.enum(["observation", "status_check", "care_log", "milestone", "identification"]),
      title: z.string().optional(),
      body: z.string().optional().describe("Journal entry content"),
    },
    async ({ plant_id, zone_id, location_id, entry_type, title, body }) => handle(async () => {
      const result = await api.createJournalEntry({
        plantInstanceId: plant_id,
        zoneId: zone_id,
        locationId: location_id,
        entryType: entry_type,
        title,
        body,
      });
      return `Journal entry ${result.id} created`;
    }),
  );

  server.tool(
    "create_care_task",
    "Create a new care task for a plant, zone, or location",
    {
      plant_id: z.number().optional().describe("Plant instance ID"),
      zone_id: z.number().optional().describe("Zone ID (for zone-level tasks like mulching)"),
      location_id: z.number().optional().describe("Location ID (for location-level tasks)"),
      task_type: z.enum(["water", "fertilize", "prune", "mulch", "harvest", "protect", "move", "repot", "inspect", "status_check", "custom"]),
      title: z.string().describe("Task title"),
      description: z.string().optional(),
      due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
      is_recurring: z.boolean().optional().default(false),
      interval_days: z.number().optional().describe("Days between recurrences"),
    },
    async ({ plant_id, zone_id, location_id, task_type, title, description, due_date, is_recurring, interval_days }) => handle(async () => {
      const result = await api.createCareTask({
        plantInstanceId: plant_id,
        zoneId: zone_id,
        locationId: location_id,
        taskType: task_type,
        title,
        description,
        dueDate: due_date,
        isRecurring: is_recurring,
        intervalDays: interval_days,
      });
      return `Care task "${result.title}" created (ID: ${result.id})`;
    }),
  );

  server.tool(
    "update_care_task",
    "Update a care task (title, description, due date, recurrence)",
    {
      task_id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      due_date: z.string().optional().describe("YYYY-MM-DD"),
      is_recurring: z.boolean().optional(),
      interval_days: z.number().optional(),
    },
    async ({ task_id, title, description, due_date, is_recurring, interval_days }) => handle(async () => {
      const update: any = {};
      if (title !== undefined) update.title = title;
      if (description !== undefined) update.description = description;
      if (due_date !== undefined) update.dueDate = due_date;
      if (is_recurring !== undefined) update.isRecurring = is_recurring;
      if (interval_days !== undefined) update.intervalDays = interval_days;
      const result = await api.updateCareTask(task_id, update);
      return `Updated care task "${result.title}"`;
    }),
  );

  server.tool(
    "delete_care_task",
    "Delete a care task",
    { task_id: z.number() },
    async ({ task_id }) => handle(async () => {
      await api.deleteCareTask(task_id);
      return `Care task ${task_id} deleted`;
    }),
  );

  server.tool(
    "bulk_log_care_tasks",
    "Complete or skip multiple care tasks at once (e.g., finish all due waterings)",
    {
      task_ids: z.array(z.number()).min(1),
      action: z.enum(["completed", "skipped"]),
    },
    async ({ task_ids, action }) => handle(async () => {
      const result = await api.bulkLogCareTasks({ ids: task_ids, action });
      return `${action} ${result.count ?? task_ids.length} tasks`;
    }),
  );

  server.tool(
    "generate_default_care_tasks",
    "Auto-generate default care tasks for a plant based on its reference data",
    { plant_id: z.number() },
    async ({ plant_id }) => handle(async () => {
      const result = await api.generateCareTasks(plant_id);
      return `Generated ${result.generated?.length ?? 0} default care tasks for plant ${plant_id}`;
    }),
  );

  server.tool(
    "delete_plant",
    "Delete a plant instance (use update_plant with status='removed' for soft delete)",
    { plant_id: z.number() },
    async ({ plant_id }) => handle(async () => {
      await api.deletePlant(plant_id);
      return `Plant ${plant_id} deleted`;
    }),
  );

  server.tool(
    "import_perenual_plant",
    "Import a plant from Perenual API into the local plant reference database",
    { perenual_id: z.number().describe("Perenual species ID") },
    async ({ perenual_id }) => handle(async () => {
      const result = await api.importPerenualPlant(perenual_id);
      return `Imported: ${result.commonName} (reference ID: ${result.id})`;
    }),
  );

  server.tool(
    "delete_plant_photo",
    "Delete a photo from a plant",
    { photo_id: z.number() },
    async ({ photo_id }) => handle(async () => {
      await api.deletePhoto(photo_id);
      return `Photo ${photo_id} deleted`;
    }),
  );

  server.tool(
    "add_structure",
    "Add a structure (shed, greenhouse, pergola, gazebo, etc.) to a location",
    {
      location_id: z.number(),
      name: z.string().describe("Structure name (e.g., 'Shed', 'Greenhouse')"),
      width: z.number().positive().describe("Width in feet"),
      depth: z.number().positive().describe("Depth in feet"),
      height: z.number().positive().optional().default(10).describe("Height in feet"),
      stories: z.number().int().positive().optional().default(1),
      roof_type: z.enum(["flat", "gable", "hip", "shed", "gambrel", "pergola", "gazebo", "open", "canopy"]).optional().default("gable"),
      pos_x: z.number().optional().default(0).describe("X position on lot grid (feet)"),
      pos_y: z.number().optional().default(0).describe("Y position on lot grid (feet)"),
    },
    async ({ location_id, name, width, depth, height, stories, roof_type, pos_x, pos_y }) => handle(async () => {
      const result = await api.createStructure(location_id, {
        name, width, depth, height, stories,
        roofType: roof_type,
        posX: pos_x, posY: pos_y,
      });
      return `Created structure "${result.name}" (ID: ${result.id})`;
    }),
  );

  server.tool(
    "update_structure",
    "Update a structure's details",
    {
      structure_id: z.number(),
      name: z.string().optional(),
      width: z.number().positive().optional(),
      depth: z.number().positive().optional(),
      height: z.number().positive().optional(),
      stories: z.number().int().positive().optional(),
      roof_type: z.enum(["flat", "gable", "hip", "shed", "gambrel", "pergola", "gazebo", "open", "canopy"]).optional(),
      pos_x: z.number().optional(),
      pos_y: z.number().optional(),
    },
    async ({ structure_id, roof_type, pos_x, pos_y, ...rest }) => handle(async () => {
      const update: any = { ...rest };
      if (roof_type !== undefined) update.roofType = roof_type;
      if (pos_x !== undefined) update.posX = pos_x;
      if (pos_y !== undefined) update.posY = pos_y;
      const result = await api.updateStructure(structure_id, update);
      return `Updated structure "${result.name}"`;
    }),
  );

  server.tool(
    "delete_structure",
    "Delete a structure",
    { structure_id: z.number() },
    async ({ structure_id }) => handle(async () => {
      await api.deleteStructure(structure_id);
      return `Structure ${structure_id} deleted`;
    }),
  );

  server.tool(
    "create_zone",
    "Create a new garden zone/bed",
    {
      location_id: z.number(),
      name: z.string(),
      description: z.string().optional(),
      zone_type: z.enum(["bed", "container", "raised_bed", "lawn", "patio", "path", "indoor", "greenhouse"]).optional().default("bed"),
      sun_exposure: z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]).optional(),
      soil_type: z.enum(["clay", "sandy", "loamy", "silty", "peaty", "chalky", "mixed"]).optional(),
      moisture_level: z.enum(["dry", "moderate", "moist", "wet"]).optional(),
    },
    async ({ location_id, name, description, zone_type, sun_exposure, soil_type, moisture_level }) => handle(async () => {
      const result = await api.createZone({
        locationId: location_id,
        name, description,
        zoneType: zone_type,
        sunExposure: sun_exposure,
        soilType: soil_type,
        moistureLevel: moisture_level,
      });
      return `Created zone "${result.name}" (ID: ${result.id})`;
    }),
  );

  server.tool(
    "update_zone",
    "Update a zone's details",
    {
      zone_id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      zone_type: z.enum(["bed", "container", "raised_bed", "lawn", "patio", "path", "indoor", "greenhouse"]).optional(),
      sun_exposure: z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]).optional(),
      soil_type: z.enum(["clay", "sandy", "loamy", "silty", "peaty", "chalky", "mixed"]).optional(),
      moisture_level: z.enum(["dry", "moderate", "moist", "wet"]).optional(),
    },
    async ({ zone_id, zone_type, sun_exposure, soil_type, moisture_level, ...rest }) => handle(async () => {
      const update: any = { ...rest };
      if (zone_type !== undefined) update.zoneType = zone_type;
      if (sun_exposure !== undefined) update.sunExposure = sun_exposure;
      if (soil_type !== undefined) update.soilType = soil_type;
      if (moisture_level !== undefined) update.moistureLevel = moisture_level;
      const result = await api.updateZone(zone_id, update);
      return `Updated zone "${result.name}"`;
    }),
  );

  server.tool(
    "delete_zone",
    "Delete a zone (cascades to its plant instances)",
    { zone_id: z.number() },
    async ({ zone_id }) => handle(async () => {
      await api.deleteZone(zone_id);
      return `Zone ${zone_id} deleted`;
    }),
  );

  server.tool(
    "update_journal_entry",
    "Update a journal entry",
    {
      entry_id: z.number(),
      title: z.string().optional(),
      body: z.string().optional(),
    },
    async ({ entry_id, title, body }) => handle(async () => {
      const update: any = {};
      if (title !== undefined) update.title = title;
      if (body !== undefined) update.body = body;
      const result = await api.updateJournalEntry(entry_id, update);
      return `Updated journal entry ${result.id}`;
    }),
  );

  server.tool(
    "delete_journal_entry",
    "Delete a journal entry",
    { entry_id: z.number() },
    async ({ entry_id }) => handle(async () => {
      await api.deleteJournalEntry(entry_id);
      return `Journal entry ${entry_id} deleted`;
    }),
  );

  server.tool(
    "update_shopping_item",
    "Update a shopping list item",
    {
      item_id: z.number(),
      name: z.string().optional(),
      quantity: z.number().optional(),
      category: z.enum(["plant", "soil", "fertilizer", "tool", "container", "other"]).optional(),
      notes: z.string().optional(),
      estimated_cost: z.number().optional(),
      vendor_name: z.string().optional(),
    },
    async ({ item_id, estimated_cost, vendor_name, ...rest }) => handle(async () => {
      const update: any = { ...rest };
      if (estimated_cost !== undefined) update.estimatedCost = estimated_cost;
      if (vendor_name !== undefined) update.vendorName = vendor_name;
      const result = await api.updateShoppingItem(item_id, update);
      return `Updated "${result.name}"`;
    }),
  );

  server.tool(
    "clear_checked_shopping_items",
    "Remove all checked/completed items from the shopping list",
    {},
    async () => handle(async () => {
      await api.clearCheckedShoppingItems();
      return "Cleared all checked shopping items";
    }),
  );

  server.tool(
    "add_fertilizer",
    "Add a fertilizer to the inventory for a location",
    {
      location_id: z.number(),
      name: z.string(),
      type: z.enum([
        "liquid",
        "granular",
        "slow_release",
        "compost",
        "compost_tea",
        "fish_emulsion",
        "other",
      ]),
      npk_n: z.number().optional().describe("Nitrogen percentage"),
      npk_p: z.number().optional().describe("Phosphorus percentage"),
      npk_k: z.number().optional().describe("Potassium percentage"),
      organic: z.boolean().optional(),
      status: z.enum(["have_it", "running_low", "out"]).optional(),
      notes: z.string().optional(),
    },
    async ({ location_id, npk_n, npk_p, npk_k, ...rest }) => handle(async () => {
      const data: any = { ...rest };
      if (npk_n !== undefined) data.npkN = npk_n;
      if (npk_p !== undefined) data.npkP = npk_p;
      if (npk_k !== undefined) data.npkK = npk_k;
      const result = await api.createFertilizer(location_id, data);
      return `Added fertilizer "${result.name}" (ID: ${result.id})`;
    }),
  );

  server.tool(
    "update_fertilizer",
    "Update a fertilizer entry",
    {
      location_id: z.number(),
      fertilizer_id: z.number(),
      name: z.string().optional(),
      type: z.enum([
        "liquid",
        "granular",
        "slow_release",
        "compost",
        "compost_tea",
        "fish_emulsion",
        "other",
      ]).optional(),
      npk_n: z.number().optional(),
      npk_p: z.number().optional(),
      npk_k: z.number().optional(),
      organic: z.boolean().optional(),
      status: z.enum(["have_it", "running_low", "out"]).optional(),
      notes: z.string().optional(),
    },
    async ({ location_id, fertilizer_id, npk_n, npk_p, npk_k, ...rest }) => handle(async () => {
      const data: any = { ...rest };
      if (npk_n !== undefined) data.npkN = npk_n;
      if (npk_p !== undefined) data.npkP = npk_p;
      if (npk_k !== undefined) data.npkK = npk_k;
      const result = await api.updateFertilizer(location_id, fertilizer_id, data);
      return `Updated fertilizer "${result.name}"`;
    }),
  );

  server.tool(
    "delete_fertilizer",
    "Delete a fertilizer entry",
    {
      location_id: z.number(),
      fertilizer_id: z.number(),
    },
    async ({ location_id, fertilizer_id }) => handle(async () => {
      await api.deleteFertilizer(location_id, fertilizer_id);
      return `Fertilizer ${fertilizer_id} deleted`;
    }),
  );

  server.tool(
    "refresh_weather",
    "Force refresh weather data for a location (also updates plant moods)",
    { location_id: z.number() },
    async ({ location_id }) => handle(async () => {
      const result = await api.refreshWeather(location_id);
      return json(result);
    }),
  );
}
