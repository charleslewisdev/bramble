import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api } from "./api.js";

/** Wrap tool handlers to catch errors and return them as isError content */
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
async function handle(fn: () => Promise<string>): Promise<ToolResult> {
  try {
    const text = await fn();
    return { content: [{ type: "text" as const, text }] };
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
}
