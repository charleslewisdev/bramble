import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "./index";
import type {
  Location,
  Structure,
  Zone,
  PlantReference,
  PlantInstance,
  PlantPhoto,
  PlantStatus,
  CareTask,
  CareTaskLog,
  ShoppingItem,
  Weather,
  NotificationChannel,
  NotificationPreference,
  SunData,
  SunPosition,
  SunArcPoint,
  ShadowPolygon,
  WildlifeResponse,
  PlantSearchResponse,
  AlertsResponse,
  DashboardData,
  Fertilizer,
} from "./index";

// ---------- Locations ----------

export function useLocations() {
  return useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: api.getLocations,
  });
}

export function useLocation(id: number | undefined) {
  return useQuery<Location>({
    queryKey: ["locations", id],
    queryFn: () => api.getLocation(id!),
    enabled: id !== undefined,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Location>) => api.createLocation(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Location> }) =>
      api.updateLocation(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["locations", v.id] });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteLocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

export function useGeocode() {
  return useMutation({
    mutationFn: (query: string) => api.geocodeAddress(query),
  });
}

export function useHardinessLookup() {
  return useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) =>
      api.lookupHardinessZone(lat, lng),
  });
}

// ---------- Structures ----------

export function useStructures(locationId: number | undefined) {
  return useQuery<Structure[]>({
    queryKey: ["structures", locationId],
    queryFn: () => api.getStructures(locationId!),
    enabled: locationId !== undefined,
  });
}

export function useCreateStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, data }: { locationId: number; data: Partial<Structure> }) =>
      api.createStructure(locationId, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["structures", v.locationId] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

export function useUpdateStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      locationId,
      id,
      data,
    }: {
      locationId: number;
      id: number;
      data: Partial<Structure>;
    }) => api.updateStructure(locationId, id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["structures", v.locationId] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

export function useDeleteStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, id }: { locationId: number; id: number }) =>
      api.deleteStructure(locationId, id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["structures", v.locationId] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

// ---------- Zones ----------

export function useZones(locationId?: number) {
  return useQuery<Zone[]>({
    queryKey: ["zones", { locationId }],
    queryFn: () => api.getZones(locationId),
  });
}

export function useZone(id: number | undefined) {
  return useQuery<Zone>({
    queryKey: ["zones", id],
    queryFn: () => api.getZone(id!),
    enabled: id !== undefined,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Zone>) => api.createZone(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Zone> }) =>
      api.updateZone(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      qc.invalidateQueries({ queryKey: ["zones", v.id] });
    },
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

// ---------- Plant References ----------

export function usePlantReferences(search?: string) {
  return useQuery<PlantReference[]>({
    queryKey: ["plantReferences", search],
    queryFn: () => api.getPlantReferences(search),
  });
}

export function usePlantReference(id: number | undefined) {
  return useQuery<PlantReference>({
    queryKey: ["plantReferences", id],
    queryFn: () => api.getPlantReference(id!),
    enabled: id !== undefined,
  });
}

export function useCreatePlantReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlantReference>) => api.createPlantReference(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantReferences"] }),
  });
}

// ---------- Plant Search ----------

export function usePlantSearch(query: string, page?: number) {
  return useQuery<PlantSearchResponse>({
    queryKey: ["plantSearch", query, page],
    queryFn: () => api.searchPlants(query, page),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useImportPlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (perenualId: number) => api.importPlantFromPerenual(perenualId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantReferences"] });
      qc.invalidateQueries({ queryKey: ["plantSearch"] });
    },
  });
}

// ---------- Plant Instances ----------

export function usePlantInstances(params?: {
  locationId?: number;
  zoneId?: number;
  status?: PlantStatus;
}) {
  return useQuery<PlantInstance[]>({
    queryKey: ["plantInstances", params],
    queryFn: () => api.getPlantInstances(params),
  });
}

export function usePlantInstance(id: number | undefined) {
  return useQuery<PlantInstance>({
    queryKey: ["plantInstances", id],
    queryFn: () => api.getPlantInstance(id!),
    enabled: id !== undefined,
  });
}

export function useCreatePlantInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlantInstance>) => api.createPlantInstance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
    },
  });
}

export function useUpdatePlantInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PlantInstance> }) =>
      api.updatePlantInstance(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
      qc.invalidateQueries({ queryKey: ["plantInstances", v.id] });
      qc.invalidateQueries({ queryKey: ["zones"] });
    },
  });
}

export function useDeletePlantInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deletePlantInstance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
    },
  });
}

// ---------- Photos ----------

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantInstanceId, imageData, caption }: { plantInstanceId: number; imageData: string; caption?: string }) =>
      api.uploadPhoto(plantInstanceId, imageData, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deletePhoto(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

// ---------- Care Tasks ----------

export function useCareTasks(params?: {
  plantInstanceId?: number;
  zoneId?: number;
  upcoming?: boolean;
}) {
  return useQuery<CareTask[]>({
    queryKey: ["careTasks", params],
    queryFn: () => api.getCareTasks(params),
  });
}

export function useCareTask(id: number | undefined) {
  return useQuery<CareTask>({
    queryKey: ["careTasks", id],
    queryFn: () => api.getCareTask(id!),
    enabled: id !== undefined,
  });
}

export function useCreateCareTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CareTask>) => api.createCareTask(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careTasks"] }),
  });
}

export function useUpdateCareTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CareTask> }) =>
      api.updateCareTask(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["careTasks"] });
      qc.invalidateQueries({ queryKey: ["careTasks", v.id] });
    },
  });
}

export function useDeleteCareTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCareTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careTasks"] }),
  });
}

export function useLogCareTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, notes, photoId }: { id: number; action: "completed" | "skipped" | "deferred"; notes?: string; photoId?: number }) =>
      api.logCareTask(id, action, notes, photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["careTasks"] });
      qc.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

export function useBulkLogCareTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: number[]; action: "completed" | "skipped" }) =>
      api.bulkLogCareTasks(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["careTasks"] });
      qc.invalidateQueries({ queryKey: ["journal"] });
    },
  });
}

export function useBulkDeleteCareTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => api.bulkDeleteCareTasks(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careTasks"] }),
  });
}

// ---------- Shopping List ----------

export function useShoppingList() {
  return useQuery<ShoppingItem[]>({
    queryKey: ["shopping"],
    queryFn: api.getShoppingList,
  });
}

export function useCreateShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ShoppingItem>) => api.createShoppingItem(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useUpdateShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShoppingItem> }) =>
      api.updateShoppingItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.toggleShoppingItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteShoppingItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useClearCheckedItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearCheckedItems(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

// ---------- Fertilizers (Shed) ----------

export function useFertilizers(locationId: number | undefined) {
  return useQuery<Fertilizer[]>({
    queryKey: ["fertilizers", locationId],
    queryFn: () => api.getFertilizers(locationId!),
    enabled: locationId !== undefined,
  });
}

export function useCreateFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Fertilizer>) => api.createFertilizer(locationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}

export function useUpdateFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Fertilizer> }) =>
      api.updateFertilizer(locationId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}

export function useDeleteFertilizer(locationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteFertilizer(locationId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fertilizers", locationId] }),
  });
}

// ---------- Weather ----------

export function useWeather(locationId: number | undefined) {
  return useQuery<Weather>({
    queryKey: ["weather", locationId],
    queryFn: () => api.getWeather(locationId!),
    enabled: locationId !== undefined,
  });
}

export function useRefreshWeather() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locationId: number) => api.refreshWeather(locationId),
    onSuccess: (_d, locationId) =>
      qc.invalidateQueries({ queryKey: ["weather", locationId] }),
  });
}

// ---------- Sun Data ----------

export function useSunData(locationId: number | undefined) {
  return useQuery<SunData>({
    queryKey: ["sun", locationId],
    queryFn: () => api.getSunData(locationId!),
    enabled: locationId !== undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSunPosition(locationId: number | undefined) {
  return useQuery<SunPosition>({
    queryKey: ["sunPosition", locationId],
    queryFn: () => api.getSunPosition(locationId!),
    enabled: locationId !== undefined,
    refetchInterval: 60 * 1000, // every minute
  });
}

export function useSunDataForDate(locationId: number | undefined, date?: string) {
  return useQuery<SunData>({
    queryKey: ["sun", locationId, date],
    queryFn: () => api.fetchSunData(locationId!, date),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSunDayArc(locationId: number | undefined, date?: string) {
  return useQuery<SunArcPoint[]>({
    queryKey: ["sun-day-arc", locationId, date],
    queryFn: () => api.getSunDayArc(locationId!, date),
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSunShadows(locationId: number | undefined, date?: string, time?: string) {
  return useQuery<ShadowPolygon[]>({
    queryKey: ["sun-shadows", locationId, date, time],
    queryFn: () => api.getSunShadows(locationId!, date, time),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  });
}

// ---------- Wildlife ----------

export function useWildlife(locationId: number | undefined) {
  return useQuery<WildlifeResponse>({
    queryKey: ["wildlife", locationId],
    queryFn: () => api.getWildlife(locationId!),
    enabled: locationId !== undefined,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// ---------- Photos (GET) ----------

export function usePhotos(plantInstanceId: number | undefined) {
  return useQuery<PlantPhoto[]>({
    queryKey: ["photos", plantInstanceId],
    queryFn: () => api.getPhotos(plantInstanceId!),
    enabled: plantInstanceId !== undefined,
  });
}

// ---------- Journal ----------

export function useJournalEntries(plantInstanceId: number | undefined, limit?: number) {
  return useQuery<api.JournalEntry[]>({
    queryKey: ["journal", plantInstanceId, limit],
    queryFn: () => api.getJournalEntries(plantInstanceId!, limit),
    enabled: plantInstanceId !== undefined,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.createJournalEntry>[0]) =>
      api.createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["plantInstances"] });
    },
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateJournalEntry>[1] }) =>
      api.updateJournalEntry(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteJournalEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });
}

// ---------- Notifications ----------

export function useNotificationChannels() {
  return useQuery<NotificationChannel[]>({
    queryKey: ["notifications"],
    queryFn: api.getNotificationChannels,
  });
}

export function useCreateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationChannel>) => api.createNotificationChannel(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useUpdateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NotificationChannel> }) =>
      api.updateNotificationChannel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteNotificationChannel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useTestNotificationChannel() {
  return useMutation({
    mutationFn: (id: number) => api.testNotificationChannel(id),
  });
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreference[]>({
    queryKey: ["notificationPreferences"],
    queryFn: api.getNotificationPreferences,
  });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskType, data }: { taskType: string; data: { enabled?: boolean; frequency?: string; digestTime?: string } }) =>
      api.updateNotificationPreference(taskType, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificationPreferences"] }),
  });
}

export function useSendDigest() {
  return useMutation({
    mutationFn: () => api.sendDigest(),
  });
}

export function useGeneratePlantTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plantInstanceId: number) => api.generatePlantTasks(plantInstanceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["careTasks"] }),
  });
}

// ---------- Settings ----------

export function useSettings() {
  return useQuery<Record<string, unknown>>({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 60 * 1000,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.updateSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ---------- Alerts ----------

export function useAlerts(locationId: number | undefined) {
  return useQuery<AlertsResponse>({
    queryKey: ["alerts", locationId],
    queryFn: () => api.getAlerts(locationId!),
    enabled: locationId !== undefined,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

// ---------- Dashboard Aggregate ----------

export function useDashboardData(locationId: number | undefined) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard", locationId],
    queryFn: () => api.getDashboardData(locationId!),
    enabled: locationId !== undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ---------- Mood Refresh ----------

export function useRefreshPlantMoods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshPlantMoods(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plantInstances"] }),
  });
}
