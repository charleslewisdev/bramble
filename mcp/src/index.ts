#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { api } from "./api.js";

const server = new McpServer({
  name: "bramble",
  version: "0.1.0",
});

// ─── Read tools ─────────────────────────────────────────────────────────────

server.tool(
  "get_dashboard",
  "Get a summary of the garden: plants, upcoming care tasks, weather, and alerts for a location",
  { location_id: z.number().optional().describe("Location ID (defaults to first location)") },
  async ({ location_id }) => {
    let locId = location_id;
    if (!locId) {
      const locs = await api.getLocations();
      locId = locs[0]?.id;
    }
    if (!locId) return { content: [{ type: "text", text: "No locations found" }] };
    const data = await api.getDashboard(locId);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "list_plants",
  "List all plants in the garden, optionally filtered by zone or status",
  {
    zone_id: z.number().optional().describe("Filter by zone ID"),
    status: z.enum(["planned", "planted", "established", "struggling", "dormant", "dead", "removed"]).optional().describe("Filter by plant status"),
  },
  async ({ zone_id, status }) => {
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
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  "get_plant",
  "Get detailed information about a specific plant including care history",
  { plant_id: z.number().describe("Plant instance ID") },
  async ({ plant_id }) => {
    const plant = await api.getPlant(plant_id);
    return { content: [{ type: "text", text: JSON.stringify(plant, null, 2) }] };
  },
);

server.tool(
  "list_zones",
  "List all garden zones/beds with their details",
  { location_id: z.number().optional().describe("Filter by location ID") },
  async ({ location_id }) => {
    const zones = await api.getZones(location_id);
    const summary = zones.map((z: any) => ({
      id: z.id,
      name: z.name,
      type: z.zoneType,
      sun: z.sunExposure,
      soil: z.soilType,
      moisture: z.moistureLevel,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  "list_care_tasks",
  "List care tasks, optionally filtered by plant or upcoming only",
  {
    plant_id: z.number().optional().describe("Filter by plant instance ID"),
    upcoming: z.boolean().optional().describe("Only show upcoming/due tasks"),
  },
  async ({ plant_id, upcoming }) => {
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
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  "get_weather",
  "Get current weather and forecast for a location",
  { location_id: z.number().optional().describe("Location ID (defaults to first location)") },
  async ({ location_id }) => {
    let locId = location_id;
    if (!locId) {
      const locs = await api.getLocations();
      locId = locs[0]?.id;
    }
    if (!locId) return { content: [{ type: "text", text: "No locations found" }] };
    const weather = await api.getWeather(locId);
    return { content: [{ type: "text", text: JSON.stringify(weather, null, 2) }] };
  },
);

server.tool(
  "get_shopping_list",
  "Get the current shopping list",
  {},
  async () => {
    const items = await api.getShoppingList();
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  },
);

server.tool(
  "search_plant_references",
  "Search the plant reference database by name",
  { query: z.string().describe("Search term (common name, latin name, or cultivar)") },
  async ({ query }) => {
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
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
);

server.tool(
  "get_journal",
  "Get journal entries for a plant",
  { plant_id: z.number().describe("Plant instance ID") },
  async ({ plant_id }) => {
    const entries = await api.getJournalEntries(plant_id);
    return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
  },
);

// ─── Write tools ────────────────────────────────────────────────────────────

server.tool(
  "complete_care_task",
  "Mark a care task as completed",
  {
    task_id: z.number().describe("Care task ID"),
    notes: z.string().optional().describe("Optional completion notes"),
  },
  async ({ task_id, notes }) => {
    const result = await api.completeCareTask(task_id, notes);
    return { content: [{ type: "text", text: `Task completed. Log ID: ${result.id}` }] };
  },
);

server.tool(
  "skip_care_task",
  "Skip a care task (e.g., watering skipped due to rain)",
  {
    task_id: z.number().describe("Care task ID"),
    notes: z.string().optional().describe("Reason for skipping"),
  },
  async ({ task_id, notes }) => {
    const result = await api.skipCareTask(task_id, notes);
    return { content: [{ type: "text", text: `Task skipped. Log ID: ${result.id}` }] };
  },
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
  },
  async ({ plant_id, status, nickname, notes, zone_id }) => {
    const update: any = {};
    if (status !== undefined) update.status = status;
    if (nickname !== undefined) update.nickname = nickname;
    if (notes !== undefined) update.notes = notes;
    if (zone_id !== undefined) update.zoneId = zone_id;
    const result = await api.updatePlant(plant_id, update);
    return { content: [{ type: "text", text: `Updated plant ${result.id}: ${result.nickname ?? "unnamed"}` }] };
  },
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
  async ({ plant_reference_id, zone_id, nickname, status, is_container, notes }) => {
    const result = await api.createPlant({
      plantReferenceId: plant_reference_id,
      zoneId: zone_id,
      nickname,
      status,
      isContainer: is_container,
      notes,
    });
    return { content: [{ type: "text", text: `Created plant ${result.id} in zone ${zone_id}` }] };
  },
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
  async ({ common_name, latin_name, cultivar, plant_type, sun_requirement, water_needs, description }) => {
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
    return { content: [{ type: "text", text: `Created reference ${result.id}: ${result.commonName}` }] };
  },
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
  async ({ name, quantity, category, notes, estimated_cost, vendor_name }) => {
    const result = await api.addShoppingItem({
      name, quantity, category, notes,
      estimatedCost: estimated_cost,
      vendorName: vendor_name,
    });
    return { content: [{ type: "text", text: `Added "${result.name}" to shopping list (ID: ${result.id})` }] };
  },
);

server.tool(
  "toggle_shopping_item",
  "Check or uncheck a shopping list item",
  { item_id: z.number().describe("Shopping list item ID") },
  async ({ item_id }) => {
    const result = await api.toggleShoppingItem(item_id);
    return { content: [{ type: "text", text: `"${result.name}" is now ${result.isChecked ? "checked" : "unchecked"}` }] };
  },
);

server.tool(
  "add_journal_entry",
  "Add a journal entry for a plant (observation, milestone, etc.)",
  {
    plant_id: z.number().describe("Plant instance ID"),
    entry_type: z.enum(["observation", "status_check", "care_log", "milestone", "identification"]),
    title: z.string().optional(),
    body: z.string().describe("Journal entry content"),
  },
  async ({ plant_id, entry_type, title, body }) => {
    const result = await api.createJournalEntry({
      plantInstanceId: plant_id,
      entryType: entry_type,
      title,
      body,
    });
    return { content: [{ type: "text", text: `Journal entry ${result.id} created` }] };
  },
);

server.tool(
  "create_care_task",
  "Create a new care task for a plant",
  {
    plant_id: z.number().describe("Plant instance ID"),
    task_type: z.enum(["water", "fertilize", "prune", "mulch", "harvest", "protect", "move", "repot", "inspect", "status_check", "custom"]),
    title: z.string().describe("Task title"),
    description: z.string().optional(),
    due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    is_recurring: z.boolean().optional().default(false),
    interval_days: z.number().optional().describe("Days between recurrences"),
  },
  async ({ plant_id, task_type, title, description, due_date, is_recurring, interval_days }) => {
    const result = await api.createCareTask({
      plantInstanceId: plant_id,
      taskType: task_type,
      title,
      description,
      dueDate: due_date,
      isRecurring: is_recurring,
      intervalDays: interval_days,
    });
    return { content: [{ type: "text", text: `Care task "${result.title}" created (ID: ${result.id})` }] };
  },
);

// ─── Start server ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
