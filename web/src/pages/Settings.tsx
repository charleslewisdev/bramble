import { useState } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  Plus,
  Trash2,
  Edit3,
  TestTube,
  Moon,
  Thermometer,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PlantSprite from "../components/sprites/PlantSprite";
import { useToast } from "../components/ui/Toast";
import {
  useNotificationChannels,
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
  useNotificationPreferences,
  useUpdateNotificationPreference,
  useSendDigest,
  useSettings,
  useUpdateSetting,
} from "../api/hooks";
import type { NotificationChannel, CareTaskType } from "../api";
import { taskTypes, taskTypeIcons } from "../utils/constants";

const channelTypes = [
  { value: "slack", label: "Slack", icon: "📡" },
  { value: "discord", label: "Discord", icon: "💬" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "pushover", label: "Pushover", icon: "📱" },
  { value: "ntfy", label: "Ntfy", icon: "🔔" },
  { value: "homeassistant", label: "Home Assistant", icon: "🏠" },
] as const;

type ChannelType = (typeof channelTypes)[number]["value"];

function getConfigFields(type: ChannelType): { key: string; label: string; placeholder: string }[] {
  switch (type) {
    case "slack":
      return [{ key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/..." }];
    case "discord":
      return [{ key: "webhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/..." }];
    case "email":
      return [
        { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com" },
        { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
        { key: "username", label: "Username", placeholder: "you@gmail.com" },
        { key: "password", label: "Password", placeholder: "app password" },
        { key: "to", label: "To Address", placeholder: "you@example.com" },
      ];
    case "pushover":
      return [
        { key: "userKey", label: "User Key", placeholder: "your user key" },
        { key: "appToken", label: "App Token", placeholder: "your app token" },
      ];
    case "ntfy":
      return [
        { key: "serverUrl", label: "Server URL", placeholder: "https://ntfy.sh" },
        { key: "topic", label: "Topic", placeholder: "bramble-garden" },
      ];
    case "homeassistant":
      return [
        { key: "url", label: "HA URL", placeholder: "http://homeassistant.local:8123" },
        { key: "token", label: "Long-Lived Token", placeholder: "your HA token" },
      ];
    default:
      return [];
  }
}

export default function Settings() {
  const { data: channels, isLoading } = useNotificationChannels();
  const createChannel = useCreateNotificationChannel();
  const updateChannel = useUpdateNotificationChannel();
  const deleteChannel = useDeleteNotificationChannel();
  const testChannel = useTestNotificationChannel();
  const { data: settings } = useSettings();
  const updateSetting = useUpdateSetting();
  const { data: notifPrefs, isLoading: prefsLoading } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const sendDigestMut = useSendDigest();
  const { showToast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [confirmDeleteChannel, setConfirmDeleteChannel] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "ntfy" as ChannelType,
    config: {} as Record<string, string>,
    enabled: true,
    quietHoursStart: "",
    quietHoursEnd: "",
  });
  const tempUnit = (settings?.temperatureUnit as string) ?? "F";
  const [testingId, setTestingId] = useState<number | null>(null);

  function handleTempUnitChange(unit: string) {
    updateSetting.mutate(
      { key: "temperatureUnit", value: unit },
      {
        onSuccess: () => showToast(`Temperature unit set to °${unit}`, "success"),
        onError: (err) => showToast(`Failed to save: ${(err as Error).message}`, "error"),
      }
    );
  }

  function resetForm() {
    setForm({
      name: "",
      type: "ntfy",
      config: {},
      enabled: true,
      quietHoursStart: "",
      quietHoursEnd: "",
    });
    setEditingChannel(null);
  }

  function openEdit(ch: NotificationChannel) {
    setForm({
      name: ch.name,
      type: ch.type,
      config: { ...ch.config },
      enabled: ch.enabled,
      quietHoursStart: ch.quietHoursStart ?? "",
      quietHoursEnd: ch.quietHoursEnd ?? "",
    });
    setEditingChannel(ch);
    setShowAdd(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      type: form.type,
      config: form.config,
      enabled: form.enabled,
      quietHoursStart: form.quietHoursStart || undefined,
      quietHoursEnd: form.quietHoursEnd || undefined,
    };
    if (editingChannel) {
      updateChannel.mutate(
        { id: editingChannel.id, data },
        {
          onSuccess: () => { setShowAdd(false); resetForm(); showToast("Channel updated!", "success"); },
          onError: (err) => showToast(`Failed to update: ${(err as Error).message}`, "error"),
        }
      );
    } else {
      createChannel.mutate(data, {
        onSuccess: () => { setShowAdd(false); resetForm(); showToast("Channel added!", "success"); },
        onError: (err) => showToast(`Failed to create: ${(err as Error).message}`, "error"),
      });
    }
  }

  function handleTest(id: number) {
    setTestingId(id);
    testChannel.mutate(id, {
      onSuccess: () => showToast("Test notification sent!", "success"),
      onError: (err) => showToast(`Test failed: ${(err as Error).message}`, "error"),
      onSettled: () => setTestingId(null),
    });
  }

  const configFields = getConfigFields(form.type);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100">
          Settings
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Configure your Bramble experience
        </p>
      </div>

      {/* Preferences */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-4">
          Preferences
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Thermometer size={14} className="text-stone-500" />
              <span className="text-sm text-stone-400 font-display">Temperature Unit</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTempUnitChange("F")}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                  tempUnit === "F"
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-800 text-stone-400 hover:bg-stone-700"
                }`}
              >
                °F
              </button>
              <button
                onClick={() => handleTempUnitChange("C")}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                  tempUnit === "C"
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-800 text-stone-400 hover:bg-stone-700"
                }`}
              >
                °C
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Moon size={14} className="text-stone-500" />
              <span className="text-sm text-stone-400 font-display">Theme</span>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-display bg-emerald-600 text-white"
              >
                Dark
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-display bg-stone-800 text-stone-500 cursor-not-allowed"
                disabled
              >
                Light (coming soon)
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Care Reminders */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-stone-300 uppercase tracking-wider mb-1">
          Care Reminders
        </h2>
        <p className="text-xs text-stone-500 mb-4">
          These are your default notification settings. You can override them per zone or per plant.
        </p>

        {prefsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-stone-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {(taskTypes.filter((t) => t !== "custom") as CareTaskType[]).map((tt) => {
                // Preferences come as a Record<taskType, {enabled, frequency}> from the API
                const prefsMap = notifPrefs as unknown as Record<string, { enabled: boolean; frequency: string }> | undefined;
                const pref = prefsMap?.[tt];
                const enabled = pref?.enabled ?? true;
                const frequency = pref?.frequency ?? "daily_digest";
                return (
                  <div key={tt} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-stone-800/50">
                    <span className="text-base w-6 text-center">{taskTypeIcons[tt]}</span>
                    <span className="text-sm text-stone-200 font-display flex-1 capitalize">
                      {tt.replace("_", " ")}
                    </span>
                    <button
                      onClick={() =>
                        updatePref.mutate(
                          { taskType: tt, data: { enabled: !enabled } },
                          {
                            onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                          }
                        )
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        enabled ? "bg-emerald-600" : "bg-stone-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                          enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <select
                      value={frequency}
                      onChange={(e) =>
                        updatePref.mutate(
                          { taskType: tt, data: { frequency: e.target.value } },
                          {
                            onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                          }
                        )
                      }
                      className="bg-stone-800 border border-stone-700 rounded-lg text-xs text-stone-300 px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily_digest">Daily digest</option>
                      <option value="weekly_digest">Weekly digest</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs text-stone-400 font-display mb-1">
                  Digest Time
                </label>
                <input
                  type="time"
                  defaultValue={(notifPrefs as Record<string, { enabled: boolean; frequency: string; digestTime?: string }> | undefined)?.water?.digestTime ?? "08:00"}
                  onChange={(e) => {
                    // Update digest time for all preferences
                    const time = e.target.value;
                    (taskTypes.filter((t) => t !== "custom") as CareTaskType[]).forEach((tt) => {
                      updatePref.mutate(
                        { taskType: tt, data: { digestTime: time } },
                        {
                          onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
                        }
                      );
                    });
                  }}
                  className="bg-stone-800 border border-stone-700 rounded-lg text-sm text-stone-300 px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  sendDigestMut.mutate(undefined, {
                    onSuccess: (result) => showToast(`Digest sent! ${result.sent} notifications sent, ${result.skipped} skipped.`, "success"),
                    onError: (err) => showToast(`Failed to send digest: ${(err as Error).message}`, "error"),
                  })
                }
                disabled={sendDigestMut.isPending}
              >
                <Bell size={14} /> {sendDigestMut.isPending ? "Sending..." : "Send Test Digest"}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Notification Channels */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold font-display text-stone-200">
            Notification Channels
          </h2>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus size={14} /> Add Channel
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <div className="h-12 bg-stone-800 rounded animate-pulse" />
              </Card>
            ))}
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="space-y-2">
            {channels.map((ch) => {
              const typeInfo = channelTypes.find((t) => t.value === ch.type);
              return (
                <Card key={ch.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{typeInfo?.icon ?? "🔔"}</span>
                      <div>
                        <p className="text-sm font-medium text-stone-200 font-display">
                          {ch.name}
                        </p>
                        <p className="text-xs text-stone-500 font-mono">
                          {typeInfo?.label ?? ch.type}
                          {!ch.enabled && " · disabled"}
                          {ch.quietHoursStart && ch.quietHoursEnd && ` · quiet ${ch.quietHoursStart}-${ch.quietHoursEnd}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTest(ch.id)}
                        disabled={testingId === ch.id}
                      >
                        <TestTube size={14} />
                      </Button>
                      <button
                        onClick={() => openEdit(ch)}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteChannel(ch.id)}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-8">
            <Bell className="mx-auto text-stone-600 mb-2" size={32} />
            <p className="text-stone-400 text-sm font-display">
              No notification channels configured. Add one to get care reminders!
            </p>
          </Card>
        )}
      </div>

      {/* Add/Edit Channel Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetForm(); }}
        title={editingChannel ? "Edit Channel" : "Add Notification Channel"}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., My Phone"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label="Channel Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ChannelType, config: {} })}
          >
            {channelTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </Select>

          {configFields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              value={form.config[field.key] ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  config: { ...form.config, [field.key]: e.target.value },
                })
              }
            />
          ))}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded border-stone-600 bg-stone-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-sm text-stone-300 font-display">Enabled</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quiet Hours Start"
              type="time"
              value={form.quietHoursStart}
              onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
            />
            <Input
              label="Quiet Hours End"
              type="time"
              value={form.quietHoursEnd}
              onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAdd(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={createChannel.isPending || updateChannel.isPending}>
              {editingChannel ? "Save" : "Add Channel"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Channel */}
      <ConfirmModal
        open={confirmDeleteChannel !== null}
        onClose={() => setConfirmDeleteChannel(null)}
        onConfirm={() => {
          if (confirmDeleteChannel !== null) {
            deleteChannel.mutate(confirmDeleteChannel, {
              onSuccess: () => showToast("Channel deleted", "success"),
              onError: (err) => showToast(`Failed: ${(err as Error).message}`, "error"),
            });
          }
        }}
        title="Delete Channel"
        message="Are you sure you want to delete this notification channel? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
