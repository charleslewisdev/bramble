import { useState } from "react";
import {
  CalendarCheck,
  Plus,
  Check,
  SkipForward,
  Pencil,
  Trash2,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PlantSprite from "../components/sprites/PlantSprite";
import { useToast } from "../components/ui/Toast";
import {
  useCareTasks,
  useCreateCareTask,
  useUpdateCareTask,
  useDeleteCareTask,
  useLogCareTask,
  usePlantInstances,
  useZones,
} from "../api/hooks";
import type { CareTaskType, PlantType, CareTask } from "../api";
import { taskTypes, taskTypeIcons, monthNames } from "../utils/constants";
import { formatDate } from "../utils/format";

export default function CareTasks() {
  const { data: tasks, isLoading } = useCareTasks();
  const createTask = useCreateCareTask();
  const updateTask = useUpdateCareTask();
  const deleteTask = useDeleteCareTask();
  const logTask = useLogCareTask();
  const { data: plantInstances } = usePlantInstances();
  const { data: zones } = useZones();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<CareTask | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    taskType: "water" as CareTaskType,
    dueDate: "",
    plantInstanceId: "",
    zoneId: "",
    description: "",
    isRecurring: false,
    intervalDays: "7",
    activeMonths: [] as number[],
    plantMessage: "",
    sendNotification: true,
  });

  const upcoming = tasks ?? [];

  // Group upcoming by date
  const grouped = upcoming.reduce<Record<string, typeof upcoming>>(
    (acc, task) => {
      const date = task.dueDate ?? "unscheduled";
      if (!acc[date]) acc[date] = [];
      acc[date]!.push(task);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(grouped).sort();

  function resetForm() {
    setForm({
      title: "",
      taskType: "water",
      dueDate: "",
      plantInstanceId: "",
      zoneId: "",
      description: "",
      isRecurring: false,
      intervalDays: "7",
      activeMonths: [],
      plantMessage: "",
      sendNotification: true,
    });
    setEditingTask(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      title: form.title,
      taskType: form.taskType,
      dueDate: form.dueDate || undefined,
      plantInstanceId: form.plantInstanceId
        ? Number(form.plantInstanceId)
        : undefined,
      zoneId: form.zoneId ? Number(form.zoneId) : undefined,
      description: form.description || undefined,
      isRecurring: form.isRecurring,
      intervalDays: form.isRecurring
        ? Number(form.intervalDays)
        : undefined,
      activeMonths: form.activeMonths.length > 0 ? form.activeMonths : undefined,
      plantMessage: form.plantMessage || undefined,
      sendNotification: form.sendNotification,
    };

    if (editingTask) {
      updateTask.mutate(
        { id: editingTask.id, data },
        {
          onSuccess: () => {
            setShowAdd(false);
            resetForm();
            showToast("Task updated!", "success");
          },
          onError: (err) => showToast(`Failed to update task: ${(err as Error).message}`, "error"),
        }
      );
    } else {
      createTask.mutate(data, {
        onSuccess: () => {
          setShowAdd(false);
          resetForm();
          showToast("Task created!", "success");
        },
        onError: (err) => showToast(`Failed to create task: ${(err as Error).message}`, "error"),
      });
    }
  }

  function openEditTask(task: CareTask) {
    setForm({
      title: task.title,
      taskType: task.taskType,
      dueDate: task.dueDate ?? "",
      plantInstanceId: task.plantInstanceId ? String(task.plantInstanceId) : "",
      zoneId: task.zoneId ? String(task.zoneId) : "",
      description: task.description ?? "",
      isRecurring: task.isRecurring,
      intervalDays: String(task.intervalDays ?? 7),
      activeMonths: task.activeMonths ?? [],
      plantMessage: task.plantMessage ?? "",
      sendNotification: task.sendNotification,
    });
    setEditingTask(task);
    setShowAdd(true);
  }

  function toggleMonth(month: number) {
    setForm((f) => ({
      ...f,
      activeMonths: f.activeMonths.includes(month)
        ? f.activeMonths.filter((m) => m !== month)
        : [...f.activeMonths, month],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-stone-100">
            Care Tasks
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {upcoming.length} task{upcoming.length !== 1 ? "s" : ""} to do
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus size={16} /> Add Task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-stone-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-stone-800 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-stone-800 rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : upcoming.length > 0 ? (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold font-[family-name:var(--font-mono)] text-stone-400 mb-2">
                {date === "unscheduled" ? "Unscheduled" : formatDate(date)}
              </h3>
              <div className="space-y-2">
                {grouped[date]!.map((task) => (
                  <Card key={task.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {taskTypeIcons[task.taskType] ?? "\u{1f4cb}"}
                        </span>
                        {task.plantInstance?.plantReference && (
                          <PlantSprite
                            type={
                              task.plantInstance.plantReference
                                .plantType as PlantType
                            }
                            mood={task.plantInstance.mood}
                            size={28}
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-stone-200 font-[family-name:var(--font-display)]">
                            {task.title}
                          </p>
                          <p className="text-xs text-stone-500 font-[family-name:var(--font-mono)]">
                            {task.taskType.replace("_", " ")}
                            {task.plantInstance &&
                              ` \u{00b7} ${task.plantInstance.nickname ?? task.plantInstance.plantReference?.commonName ?? ""}`}
                            {task.isRecurring && ` \u{00b7} every ${task.intervalDays ?? "?"}d`}
                          </p>
                          {task.plantMessage && (
                            <p className="text-xs text-stone-400 mt-1 italic">
                              "{task.plantMessage}"
                            </p>
                          )}
                          {task.description && (
                            <p className="text-xs text-stone-400 mt-1">
                              {task.description}
                            </p>
                          )}
                          {task.activeMonths && task.activeMonths.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {task.activeMonths.map((m) => (
                                <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-[family-name:var(--font-mono)]">
                                  {monthNames[m - 1]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() =>
                            logTask.mutate(
                              { id: task.id, action: "completed" },
                              {
                                onSuccess: () => showToast("Task completed!", "success"),
                                onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                              }
                            )
                          }
                        >
                          <Check size={14} />
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
                          <SkipForward size={14} />
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
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <PlantSprite type="herb" mood="happy" size={64} className="mx-auto" />
          <p className="text-lg font-semibold text-stone-200 font-[family-name:var(--font-display)] mt-4">
            Nothing to do! Your plants are taking care of themselves... or are they?
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Create a care task to stay on top of your garden.
          </p>
          <Button className="mt-4" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus size={16} /> Add a Task
          </Button>
        </Card>
      )}

      {/* Add/Edit Task Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetForm(); }}
        title={editingTask ? "Edit Care Task" : "Add Care Task"}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g., Water the ferns"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Select
            label="Task Type"
            value={form.taskType}
            onChange={(e) =>
              setForm({
                ...form,
                taskType: e.target.value as CareTaskType,
              })
            }
          >
            {taskTypes.map((t) => (
              <option key={t} value={t}>
                {taskTypeIcons[t]} {t.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(e) =>
              setForm({ ...form, dueDate: e.target.value })
            }
          />
          <Select
            label="Plant (optional)"
            value={form.plantInstanceId}
            onChange={(e) =>
              setForm({ ...form, plantInstanceId: e.target.value })
            }
          >
            <option value="">No specific plant</option>
            {plantInstances?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname ??
                  p.plantReference?.commonName ??
                  `Plant #${p.id}`}
              </option>
            ))}
          </Select>
          <Select
            label="Zone (optional)"
            value={form.zoneId}
            onChange={(e) =>
              setForm({ ...form, zoneId: e.target.value })
            }
          >
            <option value="">No specific zone</option>
            {zones?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Description"
            placeholder="Any extra details..."
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
          <Input
            label="Plant Message (tamagotchi notification)"
            placeholder='e.g., "I could use a trim!"'
            value={form.plantMessage}
            onChange={(e) => setForm({ ...form, plantMessage: e.target.value })}
          />
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) =>
                  setForm({ ...form, isRecurring: e.target.checked })
                }
                className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span className="text-sm text-stone-300 font-[family-name:var(--font-display)]">
                Recurring
              </span>
            </label>
            {form.isRecurring && (
              <>
                <Input
                  label="Interval (days)"
                  type="number"
                  value={form.intervalDays}
                  onChange={(e) =>
                    setForm({ ...form, intervalDays: e.target.value })
                  }
                />
                <div>
                  <p className="text-sm text-stone-400 font-[family-name:var(--font-display)] mb-2">Active Months</p>
                  <div className="flex flex-wrap gap-2">
                    {monthNames.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleMonth(i + 1)}
                        className={`px-2.5 py-1 rounded text-xs font-[family-name:var(--font-mono)] transition-colors ${
                          form.activeMonths.includes(i + 1)
                            ? "bg-emerald-600 text-white"
                            : "bg-stone-800 text-stone-400 hover:bg-stone-700"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendNotification}
              onChange={(e) =>
                setForm({ ...form, sendNotification: e.target.checked })
              }
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-[family-name:var(--font-display)]">
              Send notification when due
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setShowAdd(false); resetForm(); }}
            >
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
        message="Are you sure you want to delete this care task? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
