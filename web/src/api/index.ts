const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...init?.headers as Record<string, string> };
  // Only set Content-Type for requests that have a body
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = res.statusText;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) message = parsed.error;
    } catch {
      if (body) message = body;
    }
    throw new Error(`API ${res.status}: ${message}`);
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

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

function del<T = void>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------- Auth ----------

export type UserRole = "groundskeeper" | "gardener" | "helper";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  email: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface MeResponse {
  user: null;
  setupMode: true;
}

export async function getMe(): Promise<AuthUser | MeResponse> {
  return request<AuthUser | MeResponse>("/auth/me");
}

export function login(username: string, password: string): Promise<AuthUser> {
  return post<AuthUser>("/auth/login", { username, password });
}

export function logout(): Promise<void> {
  return post<void>("/auth/logout", {});
}

export function setup(data: { username: string; displayName: string; password: string }): Promise<AuthUser> {
  return post<AuthUser>("/auth/setup", data);
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return put<void>("/auth/password", { currentPassword, newPassword });
}

export function getInviteInfo(token: string): Promise<{ role: string; expiresAt: string }> {
  return request<{ role: string; expiresAt: string }>(`/auth/invites/${token}`);
}

export function claimInvite(token: string, data: { username: string; displayName: string; password: string }): Promise<AuthUser> {
  return post<AuthUser>(`/auth/invites/${token}/claim`, data);
}

// Admin APIs
export interface InviteRecord {
  id: number;
  token: string;
  role: UserRole;
  createdBy: number;
  claimedBy: number | null;
  expiresAt: string;
  createdAt: string;
}

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  email: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function getUsers(): Promise<UserRecord[]> {
  return request<UserRecord[]>("/users");
}

export function updateUserRole(id: number, role: UserRole): Promise<UserRecord> {
  return put<UserRecord>(`/users/${id}/role`, { role });
}

export function updateUserActive(id: number, isActive: boolean): Promise<UserRecord> {
  return put<UserRecord>(`/users/${id}/active`, { isActive });
}

export function getInvites(): Promise<InviteRecord[]> {
  return request<InviteRecord[]>("/auth/invites");
}

export function createInvite(role: "gardener" | "helper"): Promise<InviteRecord> {
  return post<InviteRecord>("/auth/invites", { role });
}

export function deleteInvite(id: number): Promise<void> {
  return del(`/auth/invites/${id}`);
}

// ---------- Types (shared from Drizzle schema) ----------

export type {
  Location,
  Structure,
  Zone,
  PlantReference,
  PlantPhoto,
  CareTaskLog,
  PlantType,
  SpriteType,
  PlantStatus,
  PlantMood,
  CareTaskType,
  SafetyLevel,
  PlantInstanceWithRelations as PlantInstance,
  CareTaskWithRelations as CareTask,
} from "server/types";

export type {
  NotificationChannel,
  NotificationPreference,
  WeatherCacheEntry as Weather,
  ShoppingListItem,
  Fertilizer,
} from "server/types";

import type { PlantType, SpriteType } from "server/types";
import type { ShoppingListItem } from "server/types";
import type {
  Location,
  Structure,
  Zone,
  PlantReference,
  PlantPhoto,
  CareTaskLog,
  PlantInstanceWithRelations as PlantInstance,
  CareTaskWithRelations as CareTask,
  NotificationChannel,
  NotificationPreference,
  WeatherCacheEntry as Weather,
  PlantStatus,
  Fertilizer,
} from "server/types";

/** Shopping item with optional joined plant reference */
export interface ShoppingItem extends ShoppingListItem {
  plantReference?: PlantReference;
}

/** Map plant types that lack dedicated sprites to a fallback sprite type */
export function getSpriteType(plantType: string | null | undefined): PlantType {
  switch (plantType) {
    case "houseplant":
      return "flower";
    case "groundcover":
      return "grass";
    case "aquatic":
      return "fern";
    default: {
      const validTypes: PlantType[] = [
        "flower", "shrub", "tree", "herb", "fern", "succulent",
        "cactus", "vine", "grass", "bulb", "vegetable", "fruit",
        "houseplant", "groundcover", "aquatic",
      ];
      if (plantType && validTypes.includes(plantType as PlantType)) {
        return plantType as PlantType;
      }
      return "flower";
    }
  }
}

/** Resolve the sprite type for a plant instance, checking overrides first */
export function getInstanceSpriteType(
  instance: { spriteOverride?: SpriteType | null },
  reference?: { spriteType?: SpriteType | null; plantType?: string | null } | null,
): PlantType {
  if (instance.spriteOverride) return instance.spriteOverride as PlantType;
  if (reference?.spriteType) return reference.spriteType as PlantType;
  return getSpriteType(reference?.plantType);
}

// ---------- Locations ----------

export function getLocations() {
  return request<Location[]>("/locations");
}

export function getLocation(id: number) {
  return request<Location>(`/locations/${id}`);
}

export function createLocation(data: Partial<Location>) {
  return post<Location>("/locations", data);
}

export function updateLocation(id: number, data: Partial<Location>) {
  return put<Location>(`/locations/${id}`, data);
}

export function deleteLocation(id: number) {
  return del(`/locations/${id}`);
}

export function geocodeAddress(query: string) {
  return request<{ lat: number; lng: number; displayName: string }[]>(
    `/locations/geocode?q=${encodeURIComponent(query)}`
  );
}

export function lookupHardinessZone(lat: number, lng: number) {
  return request<{ zone: string; temperatureRange: string; zip?: string }>(
    `/locations/hardiness?lat=${lat}&lng=${lng}`
  );
}

// ---------- Structures ----------

export function getStructures(locationId: number) {
  return request<Structure[]>(`/locations/${locationId}/structures`);
}

export function createStructure(locationId: number, data: Partial<Structure>) {
  return post<Structure>(`/locations/${locationId}/structures`, data);
}

export function updateStructure(_locationId: number, id: number, data: Partial<Structure>) {
  return put<Structure>(`/locations/structures/${id}`, data);
}

export function deleteStructure(_locationId: number, id: number) {
  return del(`/locations/structures/${id}`);
}

// ---------- Zones ----------

export function getZones(locationId?: number) {
  const q = locationId ? `?locationId=${locationId}` : "";
  return request<Zone[]>(`/zones${q}`);
}

export function getZone(id: number) {
  return request<Zone>(`/zones/${id}`);
}

export function createZone(data: Partial<Zone>) {
  return post<Zone>("/zones", data);
}

export function updateZone(id: number, data: Partial<Zone>) {
  return put<Zone>(`/zones/${id}`, data);
}

export function deleteZone(id: number) {
  return del(`/zones/${id}`);
}

// ---------- Plant References ----------

export function getPlantReferences(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<PlantReference[]>(`/plants/references${q}`);
}

export function getPlantReference(id: number) {
  return request<PlantReference>(`/plants/references/${id}`);
}

export function createPlantReference(data: Partial<PlantReference>) {
  return post<PlantReference>("/plants/references", data);
}

export function updatePlantReference(id: number, data: Partial<PlantReference>) {
  return put<PlantReference>(`/plants/references/${id}`, data);
}

// ---------- Plant Search (local + Perenual API) ----------

export interface PlantSearchResult {
  source: "local" | "perenual";
  localId?: number;
  perenualId?: number;
  commonName: string;
  latinName?: string | null;
  plantType?: string | null;
  sunlight?: string[] | string;
  watering?: string;
  cycle?: string;
  imageUrl?: string | null;
}

export interface PlantSearchResponse {
  local: PlantSearchResult[];
  api: PlantSearchResult[];
  apiAvailable: boolean;
  apiTotal?: number;
}

export function searchPlants(query: string, page?: number) {
  const sp = new URLSearchParams({ q: query });
  if (page) sp.set("page", String(page));
  return request<PlantSearchResponse>(`/plants/search?${sp}`);
}

export function importPlantFromPerenual(perenualId: number) {
  return post<PlantReference>(`/plants/import/${perenualId}`, {});
}

// ---------- Plant Instances ----------

export function getPlantInstances(params?: {
  locationId?: number;
  zoneId?: number;
  status?: PlantStatus;
}) {
  const sp = new URLSearchParams();
  if (params?.locationId) sp.set("locationId", String(params.locationId));
  if (params?.zoneId) sp.set("zoneId", String(params.zoneId));
  if (params?.status) sp.set("status", params.status);
  const q = sp.toString() ? `?${sp}` : "";
  return request<PlantInstance[]>(`/plants/instances${q}`);
}

export function getPlantInstance(id: number) {
  return request<PlantInstance>(`/plants/instances/${id}`);
}

export function createPlantInstance(data: Partial<PlantInstance>) {
  return post<PlantInstance>("/plants/instances", data);
}

export function updatePlantInstance(id: number, data: Partial<PlantInstance>) {
  return put<PlantInstance>(`/plants/instances/${id}`, data);
}

export function deletePlantInstance(id: number) {
  return del(`/plants/instances/${id}`);
}

export function bulkUpdatePlantInstances(ids: number[], data: Partial<PlantInstance>) {
  return put<{ count: number }>("/plants/instances/bulk", { ids, data });
}

// ---------- Plant Photos ----------

export function uploadPhoto(plantInstanceId: number, imageData: string, caption?: string) {
  return post<{ id: number; filename: string }>("/photos", { plantInstanceId, imageData, caption });
}

export function deletePhoto(id: number) {
  return del(`/photos/${id}`);
}

// ---------- Care Tasks ----------

export function getCareTasks(params?: {
  plantInstanceId?: number;
  zoneId?: number;
  upcoming?: boolean;
}) {
  const sp = new URLSearchParams();
  if (params?.plantInstanceId) sp.set("plantInstanceId", String(params.plantInstanceId));
  if (params?.zoneId) sp.set("zoneId", String(params.zoneId));
  if (params?.upcoming) sp.set("upcoming", "true");
  const q = sp.toString() ? `?${sp}` : "";
  return request<CareTask[]>(`/care-tasks${q}`);
}

export function getCareTask(id: number) {
  return request<CareTask>(`/care-tasks/${id}`);
}

export function createCareTask(data: Partial<CareTask>) {
  return post<CareTask>("/care-tasks", data);
}

export function updateCareTask(id: number, data: Partial<CareTask>) {
  return put<CareTask>(`/care-tasks/${id}`, data);
}

export function deleteCareTask(id: number) {
  return del(`/care-tasks/${id}`);
}

export function logCareTask(id: number, action: "completed" | "skipped" | "deferred", notes?: string, photoId?: number) {
  return post<CareTaskLog>(`/care-tasks/${id}/log`, { action, notes, photoId });
}

export function generatePlantTasks(plantInstanceId: number) {
  return post<CareTask[]>(`/care-tasks/generate/${plantInstanceId}`, {});
}

export function bulkLogCareTasks(data: { ids: number[]; action: "completed" | "skipped" }): Promise<{ count: number }> {
  return post<{ count: number }>("/care-tasks/bulk/log", data);
}

export function bulkDeleteCareTasks(ids: number[]): Promise<{ count: number }> {
  return del<{ count: number }>("/care-tasks/bulk", { ids });
}

// ---------- Shopping List ----------

export function getShoppingList() {
  return request<ShoppingItem[]>("/shopping-list");
}

export function createShoppingItem(data: Partial<ShoppingItem>) {
  return post<ShoppingItem>("/shopping-list", data);
}

export function updateShoppingItem(id: number, data: Partial<ShoppingItem>) {
  return put<ShoppingItem>(`/shopping-list/${id}`, data);
}

export function toggleShoppingItem(id: number) {
  return patch<ShoppingItem>(`/shopping-list/${id}/toggle`, {});
}

export function deleteShoppingItem(id: number) {
  return del(`/shopping-list/${id}`);
}

export function clearCheckedItems() {
  return del("/shopping-list/clear-checked");
}

// ---------- Fertilizers (Shed) ----------

export function getFertilizers(locationId: number) {
  return request<Fertilizer[]>(`/locations/${locationId}/fertilizers`);
}

export function createFertilizer(locationId: number, data: Partial<Fertilizer>) {
  return post<Fertilizer>(`/locations/${locationId}/fertilizers`, data);
}

export function updateFertilizer(locationId: number, id: number, data: Partial<Fertilizer>) {
  return put<Fertilizer>(`/locations/${locationId}/fertilizers/${id}`, data);
}

export function deleteFertilizer(locationId: number, id: number) {
  return del(`/locations/${locationId}/fertilizers/${id}`);
}

// ---------- Weather ----------

export function getWeather(locationId: number) {
  return request<Weather>(`/weather/${locationId}`);
}

export function refreshWeather(locationId: number) {
  return post<Weather>(`/weather/${locationId}/refresh`, {});
}

// ---------- Sun Data ----------

export interface SunData {
  locationId: number;
  date: string;
  sunrise: string;
  sunset: string;
  solarNoon: string;
  dayLength: string;
  dayLengthMinutes: number;
  goldenHour: {
    start: string;
    end: string;
  };
}

export interface SunPosition {
  locationId: number;
  timestamp: string;
  azimuth: number;
  altitude: number;
}

export interface SunArcPoint {
  hour: number;
  azimuth: number;
  altitude: number;
  time: string;
}

export interface ShadowPolygon {
  structureId: number;
  structureName: string;
  polygon: { x: number; y: number }[];
}

export function fetchSunData(locationId: number, date?: string) {
  const params = date ? `?date=${date}` : "";
  return request<SunData>(`/sun/${locationId}${params}`);
}

export function fetchSunPosition(locationId: number) {
  return request<SunPosition>(`/sun/${locationId}/position`);
}

export async function getSunDayArc(locationId: number, date?: string): Promise<SunArcPoint[]> {
  const params = date ? `?date=${date}` : "";
  const res = await request<{ positions: { time: string; azimuth: number; altitude: number }[] }>(`/sun/${locationId}/day-arc${params}`);
  return res.positions.map((p) => ({
    time: p.time,
    azimuth: p.azimuth,
    altitude: p.altitude,
    hour: new Date(p.time).getHours() + new Date(p.time).getMinutes() / 60,
  }));
}

export async function getSunShadows(locationId: number, date?: string, time?: string): Promise<ShadowPolygon[]> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (time) params.set("time", time);
  const qs = params.toString();
  const res = await request<{ shadows: ShadowPolygon[] }>(`/sun/${locationId}/shadows${qs ? `?${qs}` : ""}`);
  return res.shadows;
}

export const getSunData = fetchSunData;
export const getSunPosition = fetchSunPosition;

// ---------- Wildlife ----------

export interface WildlifeEntry {
  name: string;
  category: "pollinator" | "bird" | "beneficial_insect" | "amphibian" | "reptile" | "mammal";
  activeMonths: number[];
  regions: string[];
  description: string;
  funFact: string;
}

export interface WildlifeResponse {
  locationId: number;
  month: number;
  hardinessZone: string | null;
  wildlife: WildlifeEntry[];
  totalSpecies: number;
}

export function getWildlife(locationId: number) {
  return request<WildlifeResponse>(`/wildlife/${locationId}`);
}

// ---------- Photos (GET) ----------

export function getPhotos(plantInstanceId: number) {
  return request<PlantPhoto[]>(`/photos?plantInstanceId=${plantInstanceId}`);
}

// ---------- Journal ----------

export interface JournalPhoto {
  id: number;
  journalEntryId: number;
  plantPhotoId: number;
  sortOrder: number;
  plantPhoto?: PlantPhoto;
}

export interface JournalEntry {
  id: number;
  plantInstanceId: number | null;
  zoneId: number | null;
  locationId: number | null;
  entryType: "observation" | "status_check" | "care_log" | "milestone" | "identification";
  title: string | null;
  body: string | null;
  careTaskLogId: number | null;
  photos?: JournalPhoto[];
  createdAt: string;
  updatedAt: string;
}

export function getJournalEntries(plantInstanceId: number, limit?: number, offset?: number) {
  const sp = new URLSearchParams({ plantInstanceId: String(plantInstanceId) });
  if (limit) sp.set("limit", String(limit));
  if (offset) sp.set("offset", String(offset));
  return request<JournalEntry[]>(`/journal?${sp}`);
}

export function getJournalEntry(id: number) {
  return request<JournalEntry>(`/journal/${id}`);
}

export function createJournalEntry(data: {
  plantInstanceId?: number | null;
  zoneId?: number | null;
  locationId?: number | null;
  entryType: string;
  title?: string | null;
  body?: string | null;
  photoIds?: number[];
}) {
  return post<JournalEntry>("/journal", data);
}

export function updateJournalEntry(id: number, data: {
  title?: string | null;
  body?: string | null;
  photoIds?: number[];
}) {
  return put<JournalEntry>(`/journal/${id}`, data);
}

export function deleteJournalEntry(id: number) {
  return del(`/journal/${id}`);
}

// ---------- Notifications ----------

export function getNotificationChannels() {
  return request<NotificationChannel[]>("/notifications");
}

export function createNotificationChannel(data: Partial<NotificationChannel>) {
  return post<NotificationChannel>("/notifications", data);
}

export function updateNotificationChannel(id: number, data: Partial<NotificationChannel>) {
  return put<NotificationChannel>(`/notifications/${id}`, data);
}

export function deleteNotificationChannel(id: number) {
  return del(`/notifications/${id}`);
}

export function testNotificationChannel(id: number) {
  return post<{ success: boolean }>(`/notifications/${id}/test`, {});
}

export function getNotificationPreferences() {
  return request<NotificationPreference[]>("/notifications/preferences");
}

export function updateNotificationPreference(
  taskType: string,
  data: { enabled?: boolean; frequency?: string; digestTime?: string },
) {
  return put<NotificationPreference>(`/notifications/preferences/${taskType}`, data);
}

export function sendDigest() {
  return post<{ sent: number; skipped: number }>("/notifications/send-digest", {});
}

// ---------- Alerts ----------

export interface WeatherAlert {
  type: "frost_warning" | "heat_warning" | "rain_skip" | "wind_warning";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  affectedPlants: number[];
}

export interface AlertsResponse {
  alerts: WeatherAlert[];
  message?: string;
}

export function getAlerts(locationId: number) {
  return request<AlertsResponse>(`/alerts/${locationId}`);
}

// ---------- Dashboard Aggregate ----------

export interface DashboardData {
  locations: Location[];
  plants: PlantInstance[];
  upcomingTasks: CareTask[];
  settings: Record<string, unknown>;
  perLocation: Record<number, {
    weather: Weather | null;
    sunData: SunData | null;
    sunPosition: SunPosition | null;
    alerts: AlertsResponse;
  }>;
}

export function getDashboardData(locationId: number) {
  return request<DashboardData>(`/locations/${locationId}/dashboard`);
}

// ---------- Mood Refresh ----------

export function refreshPlantMoods() {
  return post<{ updated: number; total: number }>("/plants/instances/refresh-moods", {});
}

// ---------- Settings ----------

export function getSettings() {
  return request<Record<string, unknown>>("/settings");
}

export function updateSetting(key: string, value: unknown) {
  return put<{ key: string; value: unknown }>(`/settings/${key}`, { value });
}
