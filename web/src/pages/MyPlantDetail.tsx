import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  CalendarCheck,
  MapPin,
  ExternalLink,
  Camera,
  Trash2,
  Plus,
  X,
  Pencil,
  Sparkles,
  Upload,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Textarea, Select } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PlantSprite, {
  getMoodMessage,
} from "../components/sprites/PlantSprite";
import JournalTimeline from "../components/journal/JournalTimeline";
import StatusBadge from "../components/ui/StatusBadge";
import SafetyBadge from "../components/ui/SafetyBadge";
import { useToast } from "../components/ui/Toast";
import {
  usePlantInstance,
  usePlantInstances,
  useUpdatePlantInstance,
  useDeletePlantInstance,
  useCareTasks,
  useLogCareTask,
  useCreateCareTask,
  useUpdateCareTask,
  useDeleteCareTask,
  useUploadPhoto,
  useDeletePhoto,
  usePhotos,
  useGeneratePlantTasks,
  useZones,
  useUpdatePlantReference,
} from "../api/hooks";
import type { PlantType, PlantStatus, PlantMood, CareTaskType, CareTask, SpriteType } from "../api";
import { getInstanceSpriteType } from "../api";
import { statusOptions, taskTypes, taskTypeIcons, monthNames } from "../utils/constants";

export default function MyPlantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const plantId = id ? Number(id) : undefined;
  const { data: plant, isLoading } = usePlantInstance(plantId);
  const updatePlant = useUpdatePlantInstance();
  const deletePlantInstance = useDeletePlantInstance();
  const { data: tasks } = useCareTasks(
    plantId ? { plantInstanceId: plantId } : undefined
  );
  const logTask = useLogCareTask();
  const createTask = useCreateCareTask();
  const updateTask = useUpdateCareTask();
  const deleteTask = useDeleteCareTask();
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const { data: photos } = usePhotos(plantId);
  const generateTasks = useGeneratePlantTasks();
  const updateRef = useUpdatePlantReference();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const healthCheckFileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  // Fetch zones for zone-move dropdown (needs locationId from plant.zone)
  const { data: allZones } = useZones();
  // Fetch all instances to count how many share this plant reference
  const { data: allInstances } = usePlantInstances();

  const [showEditNickname, setShowEditNickname] = useState(false);
  const [showEditNotes, setShowEditNotes] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState<number | null>(null);
  const [confirmDeletePlant, setConfirmDeletePlant] = useState(false);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<number | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [nickname, setNickname] = useState("");
  const [notes, setNotes] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [showEditContainer, setShowEditContainer] = useState(false);
  const [containerForm, setContainerForm] = useState({
    size: "",
    shape: "",
    material: "",
    description: "",
    outdoorCandidate: false,
  });
  const [healthCheckTask, setHealthCheckTask] = useState<CareTask | null>(null);
  const [healthCheckNotes, setHealthCheckNotes] = useState("");
  const [healthCheckPhoto, setHealthCheckPhoto] = useState<string | null>(null);
  const [healthCheckSubmitting, setHealthCheckSubmitting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSpritePicker, setShowSpritePicker] = useState(false);
  const [showMoveZone, setShowMoveZone] = useState(false);
  const [moveTargetZone, setMoveTargetZone] = useState("");
  const [showEditPlantInfo, setShowEditPlantInfo] = useState(false);
  const [plantInfoForm, setPlantInfoForm] = useState({
    commonName: "",
    latinName: "",
    cultivar: "",
    sunRequirement: "",
    waterNeeds: "",
    matureHeight: "",
    matureSpread: "",
    minTempF: "",
    maxTempF: "",
  });
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    taskType: "water" as CareTaskType,
    dueDate: "",
    description: "",
    plantMessage: "",
    isRecurring: false,
    intervalDays: "7",
    sendNotification: true,
  });

  // Close status menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    if (showStatusMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStatusMenu]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-800 rounded animate-pulse" />
        <div className="h-60 bg-stone-900 border border-stone-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-400">Plant not found</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate("/my-plants")}
        >
          <ArrowLeft size={16} /> Back to My Plants
        </Button>
      </div>
    );
  }

  const ref = plant.plantReference;
  const upcomingTasks = tasks ?? [];

  // Combine photos from the instance query and the dedicated photos query
  const allPhotos = photos ?? plant.photos ?? [];

  function handleStatusChange(status: PlantStatus) {
    if (!plantId) return;
    updatePlant.mutate(
      { id: plantId, data: { status } },
      {
        onError: (err) => showToast(`Failed to update status: ${(err as Error).message}`, "error"),
      }
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !plantId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      uploadPhoto.mutate(
        {
          plantInstanceId: plantId,
          imageData: base64,
          caption: photoCaption || undefined,
        },
        {
          onSuccess: () => showToast("Photo uploaded!", "success"),
          onError: (err) => showToast(`Failed to upload photo: ${(err as Error).message}`, "error"),
        }
      );
      setPhotoCaption("");
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!plantId) return;
    createTask.mutate(
      {
        title: taskForm.title,
        taskType: taskForm.taskType,
        dueDate: taskForm.dueDate || undefined,
        plantInstanceId: plantId,
        description: taskForm.description || undefined,
        plantMessage: taskForm.plantMessage || undefined,
        isRecurring: taskForm.isRecurring,
        intervalDays: taskForm.isRecurring ? Number(taskForm.intervalDays) : undefined,
        sendNotification: taskForm.sendNotification,
      },
      {
        onSuccess: () => {
          setShowAddTask(false);
          setTaskForm({
            title: "",
            taskType: "water",
            dueDate: "",
            description: "",
            plantMessage: "",
            isRecurring: false,
            intervalDays: "7",
            sendNotification: true,
          });
          showToast("Care task added!", "success");
        },
        onError: (err) => showToast(`Failed to add task: ${(err as Error).message}`, "error"),
      }
    );
  }

  function handleEditTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask) return;
    updateTask.mutate(
      {
        id: editingTask.id,
        data: {
          title: taskForm.title,
          taskType: taskForm.taskType,
          dueDate: taskForm.dueDate || undefined,
          description: taskForm.description || undefined,
          plantMessage: taskForm.plantMessage || undefined,
          isRecurring: taskForm.isRecurring,
          intervalDays: taskForm.isRecurring ? Number(taskForm.intervalDays) : undefined,
          sendNotification: taskForm.sendNotification,
        },
      },
      {
        onSuccess: () => {
          setEditingTask(null);
          setShowAddTask(false);
          showToast("Task updated!", "success");
        },
        onError: (err) => showToast(`Failed to update task: ${(err as Error).message}`, "error"),
      }
    );
  }

  function openEditTask(task: CareTask) {
    setTaskForm({
      title: task.title,
      taskType: task.taskType,
      dueDate: task.dueDate ?? "",
      description: task.description ?? "",
      plantMessage: task.plantMessage ?? "",
      isRecurring: task.isRecurring,
      intervalDays: String(task.intervalDays ?? 7),
      sendNotification: task.sendNotification,
    });
    setEditingTask(task);
    setShowAddTask(true);
  }

  const viewingPhoto = showPhotoModal != null ? allPhotos.find((p) => p.id === showPhotoModal) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/my-plants")}
          className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 font-display mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back to My Plants
        </button>
      </div>

      {/* Hero */}
      <Card className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <button
          className="shrink-0 relative group cursor-pointer rounded-xl p-1 hover:bg-stone-800/50 transition-colors"
          onClick={() => setShowSpritePicker(true)}
          title="Change sprite"
        >
          <PlantSprite
            type={getInstanceSpriteType(plant, ref) as PlantType}
            mood={plant.mood}
            size={96}
          />
          <span className="absolute bottom-0 right-0 p-1 rounded-full bg-stone-800 border border-stone-700 text-stone-400 group-hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100">
            <Pencil size={10} />
          </span>
        </button>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h1 className="text-2xl font-bold font-display text-stone-100">
              {plant.nickname ?? ref?.commonName ?? "Plant"}
            </h1>
            <button
              onClick={() => {
                setNickname(plant.nickname ?? "");
                setShowEditNickname(true);
              }}
              className="p-1 rounded text-stone-500 hover:text-stone-300 transition-colors"
            >
              <Edit3 size={14} />
            </button>
          </div>
          {ref?.commonName && plant.nickname && (
            <p className="text-stone-400 text-sm">
              {ref.commonName}
            </p>
          )}
          {ref?.latinName && (
            <p className="text-stone-500 text-sm italic font-mono">
              {ref.latinName}
            </p>
          )}
          {ref?.cultivar && (
            <p className="text-stone-400 text-sm">
              <span className="text-stone-500 font-display">Cultivar:</span> '{ref.cultivar}'
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start flex-wrap">
            <div className="relative" ref={statusMenuRef}>
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                title="Change status"
              >
                <StatusBadge status={plant.status} />
                <ChevronDown size={12} className="text-stone-500" />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-stone-800 border border-stone-700 rounded-lg p-1.5 shadow-xl min-w-[140px]">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        handleStatusChange(s);
                        setShowStatusMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium font-display transition-colors ${
                        plant.status === s
                          ? "bg-emerald-600 text-white"
                          : "text-stone-400 hover:text-stone-200 hover:bg-stone-700"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {plant.zone ? (
              <Link
                to={`/zones/${plant.zoneId}`}
                className="flex items-center gap-1 text-xs text-stone-400 hover:text-emerald-400 transition-colors"
              >
                <MapPin size={12} />
                <span className="text-stone-500 font-display">Zone:</span> {plant.zone.name}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-xs text-stone-500">
                <MapPin size={12} />
                No zone assigned
              </span>
            )}
            <button
              onClick={() => {
                setMoveTargetZone(plant.zoneId ? String(plant.zoneId) : "");
                setShowMoveZone(true);
              }}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-400 transition-colors"
              title="Move to another zone"
            >
              <ArrowRightLeft size={12} />
              Move
            </button>
            {plant.isContainer && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                <span className="font-display">Type:</span> Container
              </span>
            )}
            {!plant.isContainer && (
              <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                <span className="font-display">Type:</span> In-ground
              </span>
            )}
            {plant.datePlanted && (
              <span className="text-xs text-stone-500">
                <span className="font-display">Planted:</span>{" "}
                <span className="font-mono">
                  {new Date(plant.datePlanted + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </span>
            )}
          </div>

          {/* Mood message */}
          <div className="mt-4 p-3 rounded-lg bg-stone-800/50 border border-stone-800">
            <p className="text-sm text-stone-200 italic font-mono">
              "{getMoodMessage(plant.mood, plant.nickname ?? undefined)}"
            </p>
          </div>

        </div>
      </Card>

      {/* Care Profile */}
      {ref && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
              Care Profile
            </h2>
            <button
              onClick={() => {
                setPlantInfoForm({
                  commonName: ref.commonName ?? "",
                  latinName: ref.latinName ?? "",
                  cultivar: ref.cultivar ?? "",
                  sunRequirement: ref.sunRequirement ?? "",
                  waterNeeds: ref.waterNeeds ?? "",
                  matureHeight: ref.matureHeight ?? "",
                  matureSpread: ref.matureSpread ?? "",
                  minTempF: ref.minTempF != null ? String(ref.minTempF) : "",
                  maxTempF: ref.maxTempF != null ? String(ref.maxTempF) : "",
                });
                setShowEditPlantInfo(true);
              }}
              className="p-1 text-stone-500 hover:text-stone-300 transition-colors"
              title="Edit plant info"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ref.sunRequirement && (
              <div>
                <p className="text-xs text-stone-500 font-display">Sun</p>
                <p className="text-sm text-stone-200 font-mono">{ref.sunRequirement.replace(/_/g, " ")}</p>
              </div>
            )}
            {ref.waterNeeds && (
              <div>
                <p className="text-xs text-stone-500 font-display">Water</p>
                <p className="text-sm text-stone-200 font-mono">{ref.waterNeeds}</p>
              </div>
            )}
            {ref.soilPreference && (
              <div>
                <p className="text-xs text-stone-500 font-display">Soil</p>
                <p className="text-sm text-stone-200 font-mono">{ref.soilPreference}</p>
              </div>
            )}
            {ref.hardinessZoneMin != null && (
              <div>
                <p className="text-xs text-stone-500 font-display">Hardiness</p>
                <p className="text-sm text-stone-200 font-mono">Zone {ref.hardinessZoneMin}{ref.hardinessZoneMax ? `-${ref.hardinessZoneMax}` : ""}</p>
              </div>
            )}
            {ref.matureHeight && (
              <div>
                <p className="text-xs text-stone-500 font-display">Height</p>
                <p className="text-sm text-stone-200 font-mono">{ref.matureHeight}</p>
              </div>
            )}
            {ref.matureSpread && (
              <div>
                <p className="text-xs text-stone-500 font-display">Spread</p>
                <p className="text-sm text-stone-200 font-mono">{ref.matureSpread}</p>
              </div>
            )}
            {ref.bloomTime && (
              <div>
                <p className="text-xs text-stone-500 font-display">Bloom</p>
                <p className="text-sm text-stone-200 font-mono">{ref.bloomTime}{ref.bloomColor ? ` (${ref.bloomColor})` : ""}</p>
              </div>
            )}
            {ref.growthRate && (
              <div>
                <p className="text-xs text-stone-500 font-display">Growth</p>
                <p className="text-sm text-stone-200 font-mono">{ref.growthRate}</p>
              </div>
            )}
            {ref.lifecycle && (
              <div>
                <p className="text-xs text-stone-500 font-display">Lifecycle</p>
                <p className="text-sm text-stone-200 font-mono">{ref.lifecycle.replace(/_/g, " ")}</p>
              </div>
            )}
            {ref.minTempF != null && (
              <div>
                <p className="text-xs text-stone-500 font-display">Temp Range</p>
                <p className="text-sm text-stone-200 font-mono">{ref.minTempF}°F{ref.maxTempF != null ? ` – ${ref.maxTempF}°F` : "+"}</p>
              </div>
            )}
          </div>
          <Link
            to={`/plants/${ref.id}`}
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-4 transition-colors font-display"
          >
            View full reference data <ExternalLink size={12} />
          </Link>
        </Card>
      )}

      {/* Container Details (UX-012) */}
      {plant.isContainer && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
              Container
            </h2>
            <button
              onClick={() => {
                setContainerForm({
                  size: plant.containerSize ?? "",
                  shape: plant.containerShape ?? "",
                  material: plant.containerMaterial ?? "",
                  description: plant.containerDescription ?? "",
                  outdoorCandidate: plant.outdoorCandidate ?? false,
                });
                setShowEditContainer(true);
              }}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            >
              <Edit3 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {plant.containerSize && (
              <div>
                <p className="text-xs text-stone-500 font-display">Size</p>
                <p className="text-sm text-stone-200 font-mono">{plant.containerSize}</p>
              </div>
            )}
            {plant.containerShape && (
              <div>
                <p className="text-xs text-stone-500 font-display">Shape</p>
                <p className="text-sm text-stone-200 font-mono capitalize">{plant.containerShape.replace(/_/g, " ")}</p>
              </div>
            )}
            {plant.containerMaterial && (
              <div>
                <p className="text-xs text-stone-500 font-display">Material</p>
                <p className="text-sm text-stone-200 font-mono capitalize">{plant.containerMaterial}</p>
              </div>
            )}
            {plant.outdoorCandidate && (
              <div>
                <p className="text-xs text-stone-500 font-display">Preference</p>
                <p className="text-sm text-emerald-400 font-mono">Outdoors when safe</p>
              </div>
            )}
          </div>
          {plant.containerDescription && (
            <p className="text-sm text-stone-400 mt-3">{plant.containerDescription}</p>
          )}
          {!plant.containerSize && !plant.containerShape && !plant.containerMaterial && !plant.containerDescription && (
            <p className="text-stone-500 italic text-sm">No container details yet. Click edit to add.</p>
          )}
        </Card>
      )}

      {/* Date Removed (UX-012) */}
      {plant.status === "removed" && plant.dateRemoved && (
        <Card>
          <p className="text-sm text-stone-400">
            <span className="text-stone-500 font-display">Removed:</span>{" "}
            <span className="font-mono">
              {new Date(plant.dateRemoved + "T00:00:00").toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </span>
          </p>
        </Card>
      )}

      {/* Safety */}
      {ref &&
        (ref.toxicityDogs || ref.toxicityCats || ref.toxicityChildren) && (
          <Card>
            <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-3">
              Safety
            </h2>
            <div className="flex flex-wrap gap-2">
              {ref.toxicityDogs && (
                <SafetyBadge level={ref.toxicityDogs} for="dogs" />
              )}
              {ref.toxicityCats && (
                <SafetyBadge level={ref.toxicityCats} for="cats" />
              )}
              {ref.toxicityChildren && (
                <SafetyBadge level={ref.toxicityChildren} for="children" />
              )}
            </div>
            {ref.toxicityNotes && (
              <p className="text-xs text-stone-400 mt-2 italic">{ref.toxicityNotes}</p>
            )}
          </Card>
        )}

      {/* Photo Gallery */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
            Photos {allPhotos.length > 0 && <span className="text-stone-500">({allPhotos.length})</span>}
          </h2>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Caption (optional)"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="text-xs w-40"
            />
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Camera size={14} /> Add Photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
        {allPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-stone-800 border border-stone-700 hover:border-stone-600 transition-colors"
                onClick={() => setShowPhotoModal(photo.id)}
              >
                <img
                  src={`/api/photos/file/${(photo as any).thumbnailFilename || photo.filename}`}
                  alt={photo.caption ?? "Plant photo"}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption && (
                    <p className="text-xs text-white truncate">{photo.caption}</p>
                  )}
                  <p className="text-[10px] text-stone-300 font-mono">
                    {new Date(photo.takenAt ?? photo.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeletePhoto(photo.id);
                  }}
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 text-stone-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Camera className="mx-auto text-stone-600 mb-2" size={24} />
            <p className="text-stone-500 text-sm font-display">
              No photos yet. Snap a pic of your plant!
            </p>
          </div>
        )}
      </Card>

      {/* Journal Timeline */}
      {plantId && <JournalTimeline plantInstanceId={plantId} />}

      {/* Photo View Modal */}
      <Modal
        open={showPhotoModal !== null}
        onClose={() => setShowPhotoModal(null)}
        title={viewingPhoto?.caption ?? "Photo"}
      >
        {viewingPhoto && (
          <div className="space-y-3">
            <img
              src={`/api/photos/file/${viewingPhoto.filename}`}
              alt={viewingPhoto.caption ?? "Plant photo"}
              className="w-full rounded-lg"
            />
            {viewingPhoto.caption && (
              <p className="text-sm text-stone-300">{viewingPhoto.caption}</p>
            )}
            <p className="text-xs text-stone-500 font-mono">
              {new Date(viewingPhoto.takenAt ?? viewingPhoto.createdAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmDeletePhoto(viewingPhoto.id);
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
              <Button size="sm" onClick={() => setShowPhotoModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notes */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
            Notes
          </h2>
          <button
            onClick={() => {
              setNotes(plant.notes ?? "");
              setShowEditNotes(true);
            }}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <Edit3 size={14} />
          </button>
        </div>
        <p className="text-sm text-stone-300">
          {plant.notes || (
            <span className="text-stone-500 italic">
              No notes yet. Click edit to add some!
            </span>
          )}
        </p>
      </Card>

      {/* Care Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-display text-stone-200">
            Care Tasks
          </h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!plantId) return;
                generateTasks.mutate(plantId, {
                  onSuccess: (result) => showToast(`Generated ${result.length} care tasks based on plant profile!`, "success"),
                  onError: (err) => showToast(`Failed to generate tasks: ${(err as Error).message}`, "error"),
                });
              }}
              disabled={generateTasks.isPending || plant.status === "dead" || plant.status === "removed"}
            >
              <Sparkles size={14} /> {generateTasks.isPending ? "Generating..." : "Generate Smart Tasks"}
            </Button>
            <Button size="sm" onClick={() => {
              setEditingTask(null);
              setTaskForm({
                title: "",
                taskType: "water",
                dueDate: "",
                description: "",
                plantMessage: "",
                isRecurring: false,
                intervalDays: "7",
                sendNotification: true,
              });
              setShowAddTask(true);
            }}>
              <Plus size={14} /> Add Task
            </Button>
          </div>
        </div>
        {(() => {
          const today = new Date().toISOString().split("T")[0]!;
          const overdueTasks = upcomingTasks.filter(t => t.dueDate && t.dueDate < today);
          const todayTasks = upcomingTasks.filter(t => t.dueDate === today);
          const futureTasks = upcomingTasks.filter(t => !t.dueDate || t.dueDate > today);

          const renderTask = (task: CareTask) => (
            <Card key={task.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-base">
                    {taskTypeIcons[task.taskType] ?? "\u{1f4cb}"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-stone-200 font-display">
                      {task.title}
                    </p>
                    <p className="text-xs text-stone-500 font-mono">
                      {task.dueDate ? `Due: ${task.dueDate}` : "No due date"}
                      {task.isRecurring && ` \u{00b7} every ${task.intervalDays ?? "?"}d`}
                    </p>
                    {task.plantMessage && (
                      <p className="text-xs text-stone-400 italic mt-0.5">"{task.plantMessage}"</p>
                    )}
                    {task.activeMonths && task.activeMonths.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {task.activeMonths.map((m) => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-mono">
                            {monthNames[m - 1]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (task.taskType === "inspect") {
                        setHealthCheckTask(task);
                        setHealthCheckNotes("");
                        setHealthCheckPhoto(null);
                      } else {
                        logTask.mutate(
                          { id: task.id, action: "completed" },
                          {
                            onSuccess: () => showToast("Task completed!", "success"),
                            onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                          }
                        );
                      }
                    }}
                  >
                    {task.taskType === "inspect" ? "Check" : "Done"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      logTask.mutate({
                        id: task.id,
                        action: "skipped",
                      })
                    }
                  >
                    Skip
                  </Button>
                  <button
                    onClick={() => openEditTask(task)}
                    className="p-1.5 rounded-lg text-stone-600 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    title="Edit task"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteTask(task.id)}
                    className="p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );

          const visibleFuture = showAllUpcoming ? futureTasks : futureTasks.slice(0, 3);
          const hiddenCount = futureTasks.length - 3;

          return upcomingTasks.length > 0 ? (
            <div className="space-y-4">
              {overdueTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold font-display text-stone-400 uppercase tracking-wider">Overdue</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400">{overdueTasks.length}</span>
                  </div>
                  {overdueTasks.map(renderTask)}
                </div>
              )}
              {todayTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold font-display text-stone-400 uppercase tracking-wider">Today</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{todayTasks.length}</span>
                  </div>
                  {todayTasks.map(renderTask)}
                </div>
              )}
              {futureTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold font-display text-stone-400 uppercase tracking-wider">Upcoming</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-700 text-stone-400">{futureTasks.length}</span>
                  </div>
                  {visibleFuture.map(renderTask)}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                      className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 font-display transition-colors px-2 py-1"
                    >
                      {showAllUpcoming ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {showAllUpcoming ? "Show less" : `Show ${hiddenCount} more`}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Card className="text-center py-6">
              <CalendarCheck
                className="mx-auto text-stone-600 mb-2"
                size={24}
              />
              <p className="text-stone-400 text-sm font-display">
                No upcoming care tasks
              </p>
            </Card>
          );
        })()}
      </div>

      {/* Notifications */}
      <Card>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showNotifications ? <ChevronDown size={14} className="text-stone-500" /> : <ChevronRight size={14} className="text-stone-500" />}
          <Bell size={14} className="text-stone-500" />
          <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider">
            Notifications
          </h2>
        </button>
        {showNotifications && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-stone-500 mb-3">
              Override notification settings for just this plant.
            </p>
            {(taskTypes.filter((t) => t !== "custom") as CareTaskType[]).map((tt) => {
              // We store overrides as a JSON string in the plant notes for now
              // In practice this would use dedicated fields on the plant instance
              return (
                <div key={tt} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-stone-800/50">
                  <span className="text-sm w-5 text-center">{taskTypeIcons[tt]}</span>
                  <span className="text-xs text-stone-200 font-display flex-1 capitalize">
                    {tt.replace("_", " ")}
                  </span>
                  <select
                    defaultValue="default"
                    onChange={(e) => {
                      // Placeholder: would save to plant instance notification override fields
                      showToast(`${tt} notifications set to: ${e.target.value}`, "success");
                    }}
                    className="bg-stone-800 border border-stone-700 rounded-lg text-xs text-stone-300 px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  >
                    <option value="default">Use zone/global default</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="border border-red-900/30">
        <h2 className="text-sm font-semibold font-display text-red-400 uppercase tracking-wider mb-3">
          Danger Zone
        </h2>
        <p className="text-sm text-stone-400 mb-3">
          Remove this plant from your garden. This action cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmDeletePlant(true)}
        >
          <Trash2 size={14} /> Remove from Garden
        </Button>
      </Card>

      {/* Edit Nickname Modal */}
      <Modal
        open={showEditNickname}
        onClose={() => setShowEditNickname(false)}
        title="Edit Nickname"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!plantId) return;
            updatePlant.mutate(
              { id: plantId, data: { nickname: nickname || undefined } },
              {
                onSuccess: () => setShowEditNickname(false),
                onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
              }
            );
          }}
          className="space-y-4"
        >
          <Input
            label="Nickname"
            placeholder="Give your plant a name!"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowEditNickname(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updatePlant.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Notes Modal */}
      <Modal
        open={showEditNotes}
        onClose={() => setShowEditNotes(false)}
        title="Edit Notes"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!plantId) return;
            updatePlant.mutate(
              { id: plantId, data: { notes: notes || undefined } },
              { onSuccess: () => setShowEditNotes(false) }
            );
          }}
          className="space-y-4"
        >
          <Textarea
            label="Notes"
            placeholder="Add notes about this plant..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowEditNotes(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updatePlant.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Task Modal */}
      <Modal
        open={showAddTask}
        onClose={() => { setShowAddTask(false); setEditingTask(null); }}
        title={editingTask ? "Edit Care Task" : "Add Care Task"}
      >
        <form onSubmit={editingTask ? handleEditTask : handleAddTask} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g., Water this plant"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            required
          />
          <Select
            label="Task Type"
            value={taskForm.taskType}
            onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value as CareTaskType })}
          >
            {taskTypes.map((t) => (
              <option key={t} value={t}>{taskTypeIcons[t]} {t}</option>
            ))}
          </Select>
          <Input
            label="Due Date"
            type="date"
            value={taskForm.dueDate}
            onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
          />
          <Textarea
            label="Description"
            value={taskForm.description}
            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
          />
          <Input
            label="Plant Message"
            placeholder='"I could use a trim!"'
            value={taskForm.plantMessage}
            onChange={(e) => setTaskForm({ ...taskForm, plantMessage: e.target.value })}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={taskForm.isRecurring}
              onChange={(e) => setTaskForm({ ...taskForm, isRecurring: e.target.checked })}
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-display">Recurring</span>
          </label>
          {taskForm.isRecurring && (
            <Input
              label="Interval (days)"
              type="number"
              value={taskForm.intervalDays}
              onChange={(e) => setTaskForm({ ...taskForm, intervalDays: e.target.value })}
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={taskForm.sendNotification}
              onChange={(e) => setTaskForm({ ...taskForm, sendNotification: e.target.checked })}
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-display">Send notification when due</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddTask(false); setEditingTask(null); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {editingTask
                ? (updateTask.isPending ? "Saving..." : "Save Task")
                : (createTask.isPending ? "Adding..." : "Add Task")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Plant */}
      <ConfirmModal
        open={confirmDeletePlant}
        onClose={() => setConfirmDeletePlant(false)}
        onConfirm={() => {
          if (!plantId) return;
          deletePlantInstance.mutate(plantId, {
            onSuccess: () => {
              showToast("Plant removed from garden", "success");
              navigate("/my-plants");
            },
            onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
          });
        }}
        title="Remove Plant"
        message={`Are you sure you want to remove "${plant.nickname ?? ref?.commonName ?? "this plant"}" from your garden? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
      />

      {/* Confirm Delete Photo */}
      <ConfirmModal
        open={confirmDeletePhoto !== null}
        onClose={() => setConfirmDeletePhoto(null)}
        onConfirm={() => {
          if (confirmDeletePhoto !== null) {
            deletePhoto.mutate(confirmDeletePhoto);
            if (showPhotoModal === confirmDeletePhoto) {
              setShowPhotoModal(null);
            }
          }
        }}
        title="Delete Photo"
        message="Are you sure you want to delete this photo?"
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Confirm Delete Task */}
      <ConfirmModal
        open={confirmDeleteTask !== null}
        onClose={() => setConfirmDeleteTask(null)}
        onConfirm={() => {
          if (confirmDeleteTask !== null) {
            deleteTask.mutate(confirmDeleteTask, {
              onSuccess: () => showToast("Task deleted", "success"),
              onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
            });
          }
        }}
        title="Delete Task"
        message="Are you sure you want to delete this care task?"
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Health Check Modal */}
      <Modal
        open={healthCheckTask !== null}
        onClose={() => setHealthCheckTask(null)}
        title="Health Check Complete"
      >
        <div className="space-y-4">
          <Textarea
            label="Notes"
            placeholder="How does this plant look? Any issues?"
            value={healthCheckNotes}
            onChange={(e) => setHealthCheckNotes(e.target.value)}
            rows={3}
          />
          <div>
            <label className="block text-xs text-stone-400 font-display mb-1">
              Photo (optional)
            </label>
            {healthCheckPhoto ? (
              <div className="relative inline-block">
                <img
                  src={healthCheckPhoto}
                  alt="Health check"
                  className="h-32 rounded-lg border border-stone-700"
                />
                <button
                  onClick={() => setHealthCheckPhoto(null)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-stone-800 text-stone-400 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => healthCheckFileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300 transition-colors text-sm w-full justify-center"
              >
                <Upload size={16} /> Upload a photo
              </button>
            )}
            <input
              ref={healthCheckFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setHealthCheckPhoto(reader.result as string);
                reader.readAsDataURL(file);
                if (healthCheckFileRef.current) healthCheckFileRef.current.value = "";
              }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setHealthCheckTask(null)}>
              Cancel
            </Button>
            <Button
              disabled={healthCheckSubmitting}
              onClick={async () => {
                if (!healthCheckTask || !plantId) return;
                setHealthCheckSubmitting(true);
                try {
                  let photoId: number | undefined;
                  if (healthCheckPhoto) {
                    const result = await uploadPhoto.mutateAsync({
                      plantInstanceId: plantId,
                      imageData: healthCheckPhoto,
                      caption: "Health check",
                    });
                    photoId = result.id;
                  }
                  await logTask.mutateAsync({
                    id: healthCheckTask.id,
                    action: "completed",
                    notes: healthCheckNotes || undefined,
                    photoId,
                  });
                  showToast("Health check recorded!", "success");
                  setHealthCheckTask(null);
                  setHealthCheckNotes("");
                  setHealthCheckPhoto(null);
                } catch (err) {
                  showToast(`Failed: ${(err as Error).message}`, "error");
                } finally {
                  setHealthCheckSubmitting(false);
                }
              }}
            >
              {healthCheckSubmitting ? "Saving..." : "Save Check"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sprite Picker Modal */}
      <Modal
        open={showSpritePicker}
        onClose={() => setShowSpritePicker(false)}
        title="Choose Sprite"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-500">
            Pick a pixel art sprite for this plant, or reset to auto-detect from plant type.
          </p>
          <div className="grid grid-cols-4 gap-3">
            {(["flower", "shrub", "tree", "herb", "fern", "succulent", "cactus", "vine", "grass", "bulb", "vegetable", "fruit"] as const).map((spriteType) => {
              const isActive = plant.spriteOverride
                ? plant.spriteOverride === spriteType
                : getInstanceSpriteType(plant, ref) === spriteType && !plant.spriteOverride;
              return (
                <button
                  key={spriteType}
                  onClick={() => {
                    if (!plantId) return;
                    updatePlant.mutate(
                      { id: plantId, data: { spriteOverride: spriteType as SpriteType } },
                      {
                        onSuccess: () => {
                          setShowSpritePicker(false);
                          showToast(`Sprite set to ${spriteType}!`, "success");
                        },
                        onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                      }
                    );
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-stone-700 bg-stone-800/50 hover:border-stone-600 hover:bg-stone-800"
                  }`}
                >
                  <PlantSprite type={spriteType as PlantType} mood="happy" size={48} showOverlay={false} />
                  <span className="text-[10px] text-stone-400 font-mono capitalize">
                    {spriteType}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!plantId) return;
                updatePlant.mutate(
                  { id: plantId, data: { spriteOverride: null } },
                  {
                    onSuccess: () => {
                      setShowSpritePicker(false);
                      showToast("Sprite reset to auto-detect", "success");
                    },
                    onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                  }
                );
              }}
              disabled={!plant.spriteOverride}
            >
              Reset to auto
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSpritePicker(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Plant Info Modal */}
      <Modal
        open={showEditPlantInfo}
        onClose={() => setShowEditPlantInfo(false)}
        title="Edit Plant Info"
        wide
      >
        {(() => {
          const sharedCount = allInstances?.filter(p => p.plantReferenceId === ref?.id).length ?? 0;
          return sharedCount > 1 ? (
            <p className="text-xs text-amber-400 mb-4">
              {sharedCount} plants share this reference — changes will affect all of them.
            </p>
          ) : null;
        })()}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ref) return;
            updateRef.mutate(
              {
                id: ref.id,
                data: {
                  commonName: plantInfoForm.commonName || undefined,
                  latinName: plantInfoForm.latinName || null,
                  cultivar: plantInfoForm.cultivar || null,
                  sunRequirement: plantInfoForm.sunRequirement
                    ? (plantInfoForm.sunRequirement as "full_sun" | "partial_sun" | "partial_shade" | "full_shade")
                    : undefined,
                  waterNeeds: plantInfoForm.waterNeeds
                    ? (plantInfoForm.waterNeeds as "low" | "moderate" | "high" | "aquatic")
                    : undefined,
                  matureHeight: plantInfoForm.matureHeight || null,
                  matureSpread: plantInfoForm.matureSpread || null,
                  minTempF: plantInfoForm.minTempF ? Number(plantInfoForm.minTempF) : null,
                  maxTempF: plantInfoForm.maxTempF ? Number(plantInfoForm.maxTempF) : null,
                },
              },
              {
                onSuccess: () => {
                  setShowEditPlantInfo(false);
                  showToast("Plant info updated!", "success");
                },
                onError: (err) =>
                  showToast(`Failed: ${(err as Error).message}`, "error"),
              },
            );
          }}
          className="space-y-4"
        >
          <Input
            label="Common Name"
            value={plantInfoForm.commonName}
            onChange={(e) =>
              setPlantInfoForm({ ...plantInfoForm, commonName: e.target.value })
            }
            required
          />
          <Input
            label="Latin Name"
            value={plantInfoForm.latinName}
            onChange={(e) =>
              setPlantInfoForm({ ...plantInfoForm, latinName: e.target.value })
            }
          />
          <Input
            label="Cultivar / Variety"
            value={plantInfoForm.cultivar}
            onChange={(e) =>
              setPlantInfoForm({ ...plantInfoForm, cultivar: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Sun Requirement"
              value={plantInfoForm.sunRequirement}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  sunRequirement: e.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="full_sun">Full sun</option>
              <option value="partial_sun">Partial sun</option>
              <option value="partial_shade">Partial shade</option>
              <option value="full_shade">Full shade</option>
            </Select>
            <Select
              label="Water Needs"
              value={plantInfoForm.waterNeeds}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  waterNeeds: e.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="aquatic">Aquatic</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Mature Height"
              placeholder="e.g. 2-4 ft"
              value={plantInfoForm.matureHeight}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  matureHeight: e.target.value,
                })
              }
            />
            <Input
              label="Mature Spread"
              placeholder="e.g. 3-5 ft"
              value={plantInfoForm.matureSpread}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  matureSpread: e.target.value,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Temp (&deg;F)"
              type="number"
              value={plantInfoForm.minTempF}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  minTempF: e.target.value,
                })
              }
            />
            <Input
              label="Max Temp (&deg;F)"
              type="number"
              value={plantInfoForm.maxTempF}
              onChange={(e) =>
                setPlantInfoForm({
                  ...plantInfoForm,
                  maxTempF: e.target.value,
                })
              }
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowEditPlantInfo(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRef.isPending}>
              {updateRef.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move Zone Modal */}
      <Modal
        open={showMoveZone}
        onClose={() => setShowMoveZone(false)}
        title="Move to Zone"
      >
        <div className="space-y-4">
          <p className="text-xs text-stone-500">
            Move this plant to a different zone, or remove it from its current zone.
          </p>
          <Select
            label="Zone"
            value={moveTargetZone}
            onChange={(e) => setMoveTargetZone(e.target.value)}
          >
            <option value="">No zone (unassigned)</option>
            {allZones?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowMoveZone(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={updatePlant.isPending || moveTargetZone === String(plant.zoneId ?? "")}
              onClick={() => {
                if (!plantId) return;
                const newZoneId = moveTargetZone ? Number(moveTargetZone) : null;
                updatePlant.mutate(
                  { id: plantId, data: { zoneId: newZoneId } },
                  {
                    onSuccess: () => {
                      setShowMoveZone(false);
                      showToast(
                        newZoneId
                          ? `Moved to ${allZones?.find((z) => z.id === newZoneId)?.name ?? "zone"}!`
                          : "Removed from zone.",
                        "success",
                      );
                    },
                    onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                  },
                );
              }}
            >
              {updatePlant.isPending ? "Moving..." : "Move Plant"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Container Modal */}
      <Modal
        open={showEditContainer}
        onClose={() => setShowEditContainer(false)}
        title="Edit Container"
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!plantId) return;
          updatePlant.mutate({
            id: plantId,
            data: {
              containerSize: containerForm.size || null,
              containerShape: containerForm.shape
                ? (containerForm.shape as "round" | "square" | "rectangular" | "oval" | "hanging" | "window_box" | "other")
                : undefined,
              containerMaterial: containerForm.material
                ? (containerForm.material as "terracotta" | "ceramic" | "plastic" | "fabric" | "metal" | "wood" | "concrete" | "fiberglass" | "stone")
                : undefined,
              containerDescription: containerForm.description || null,
              outdoorCandidate: containerForm.outdoorCandidate,
            },
          }, {
            onSuccess: () => {
              setShowEditContainer(false);
              showToast("Container details updated!", "success");
            },
            onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
          });
        }} className="space-y-4">
          <Input
            label="Size"
            placeholder="e.g. 12 inch, 5 gallon"
            value={containerForm.size}
            onChange={(e) => setContainerForm({...containerForm, size: e.target.value})}
          />
          <Select
            label="Shape"
            value={containerForm.shape}
            onChange={(e) => setContainerForm({...containerForm, shape: e.target.value})}
          >
            <option value="">Not specified</option>
            <option value="round">Round</option>
            <option value="square">Square</option>
            <option value="rectangular">Rectangular</option>
            <option value="oval">Oval</option>
            <option value="hanging">Hanging</option>
            <option value="window_box">Window Box</option>
            <option value="other">Other</option>
          </Select>
          <Select
            label="Material"
            value={containerForm.material}
            onChange={(e) => setContainerForm({...containerForm, material: e.target.value})}
          >
            <option value="">Not specified</option>
            <option value="terracotta">Terracotta</option>
            <option value="ceramic">Ceramic</option>
            <option value="plastic">Plastic</option>
            <option value="fabric">Fabric</option>
            <option value="metal">Metal</option>
            <option value="wood">Wood</option>
            <option value="concrete">Concrete</option>
            <option value="fiberglass">Fiberglass</option>
            <option value="stone">Stone</option>
          </Select>
          <Textarea
            label="Notes"
            placeholder="Any notes about this container..."
            value={containerForm.description}
            onChange={(e) => setContainerForm({...containerForm, description: e.target.value})}
            rows={3}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={containerForm.outdoorCandidate}
              onChange={(e) => setContainerForm({...containerForm, outdoorCandidate: e.target.checked})}
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-display">Move outdoors when weather allows</span>
          </label>
          <p className="text-xs text-stone-500">When enabled, care tasks will remind you to move this plant outdoors during safe weather and back indoors before cold nights.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowEditContainer(false)}>Cancel</Button>
            <Button type="submit" disabled={updatePlant.isPending}>{updatePlant.isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
