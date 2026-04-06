/** Thin HTTP client for the Bramble API */

const BRAMBLE_URL = process.env.BRAMBLE_URL ?? "http://10.0.0.4:3333";
const BRAMBLE_API_KEY = process.env.BRAMBLE_API_KEY ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BRAMBLE_API_KEY) {
    throw new Error("BRAMBLE_API_KEY environment variable is required for MCP API calls");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${BRAMBLE_API_KEY}`,
    ...init?.headers as Record<string, string>,
  };
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BRAMBLE_URL}/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bramble API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

function del<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// ─── API functions ──────────────────────────────────────────────────────────

export const api = {
  // Locations & Zones
  getLocations: () => request<any[]>("/locations"),
  getLocation: (id: number) => request<any>(`/locations/${id}`),
  getZones: (locationId?: number) => request<any[]>(`/zones${locationId ? `?locationId=${locationId}` : ""}`),
  getZone: (id: number) => request<any>(`/zones/${id}`),

  // Plants
  getPlants: (params?: { zoneId?: number; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.zoneId) sp.set("zoneId", String(params.zoneId));
    if (params?.status) sp.set("status", params.status);
    const q = sp.toString() ? `?${sp}` : "";
    return request<any[]>(`/plants/instances${q}`);
  },
  getPlant: (id: number) => request<any>(`/plants/instances/${id}`),
  createPlant: (data: any) => post<any>("/plants/instances", data),
  updatePlant: (id: number, data: any) => put<any>(`/plants/instances/${id}`, data),

  // Plant references
  searchPlantReferences: (search: string) =>
    request<any[]>(`/plants/references?search=${encodeURIComponent(search)}`),
  getPlantReference: (id: number) => request<any>(`/plants/references/${id}`),
  createPlantReference: (data: any) => post<any>("/plants/references", data),

  // Care tasks
  getCareTasks: (params?: { plantInstanceId?: number; upcoming?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.plantInstanceId) sp.set("plantInstanceId", String(params.plantInstanceId));
    if (params?.upcoming) sp.set("upcoming", "true");
    const q = sp.toString() ? `?${sp}` : "";
    return request<any[]>(`/care-tasks${q}`);
  },
  getCareTask: (id: number) => request<any>(`/care-tasks/${id}`),
  createCareTask: (data: any) => post<any>("/care-tasks", data),
  logCareTask: (id: number, action: string, notes?: string) =>
    post<any>(`/care-tasks/${id}/log`, { action, notes }),

  // Shopping list
  getShoppingList: () => request<any[]>("/shopping-list"),
  addShoppingItem: (data: any) => post<any>("/shopping-list", data),
  toggleShoppingItem: (id: number) =>
    request<any>(`/shopping-list/${id}/toggle`, { method: "PATCH" }),
  deleteShoppingItem: (id: number) => del(`/shopping-list/${id}`),

  // Journal
  getJournalEntries: (plantInstanceId?: number, zoneId?: number, locationId?: number) => {
    const sp = new URLSearchParams();
    if (plantInstanceId) sp.set("plantInstanceId", String(plantInstanceId));
    if (zoneId) sp.set("zoneId", String(zoneId));
    if (locationId) sp.set("locationId", String(locationId));
    return request<any[]>(`/journal?${sp}`);
  },
  createJournalEntry: (data: any) => post<any>("/journal", data),

  // Weather & Alerts
  getWeather: (locationId: number) => request<any>(`/weather/${locationId}`),
  getAlerts: (locationId: number) => request<any>(`/alerts/${locationId}`),

  // Dashboard
  getDashboard: (locationId: number) => request<any>(`/locations/${locationId}/dashboard`),

  // Photos
  uploadPhoto: (plantInstanceId: number, imageData: string, caption?: string) =>
    post<any>("/photos", { plantInstanceId, imageData, caption }),
};
