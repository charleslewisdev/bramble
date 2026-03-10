import type { NotificationChannel } from "../db/schema.js";

// ─── Config types per channel ────────────────────────────────────────────────

interface SlackConfig {
  webhookUrl: string;
}

interface DiscordConfig {
  webhookUrl: string;
}

interface NtfyConfig {
  topic: string;
  serverUrl?: string;
}

interface PushoverConfig {
  appToken: string;
  userKey: string;
}

interface EmailConfig {
  to: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
}

interface HomeAssistantConfig {
  baseUrl: string;
  token: string;
  service?: string;
}

// ─── Quiet hours check ──────────────────────────────────────────────────────

function isInQuietHours(
  quietHoursStart: string | null | undefined,
  quietHoursEnd: string | null | undefined,
): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = quietHoursStart.split(":").map(Number);
  const [endH, endM] = quietHoursEnd.split(":").map(Number);

  if (startH === undefined || startM === undefined) return false;
  if (endH === undefined || endM === undefined) return false;

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ─── Channel senders ────────────────────────────────────────────────────────

async function sendSlack(config: SlackConfig, title: string, message: string): Promise<boolean> {
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*${title}*\n${message}` }),
  });
  return response.ok;
}

async function sendDiscord(config: DiscordConfig, title: string, message: string): Promise<boolean> {
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `**${title}**\n${message}` }),
  });
  return response.ok;
}

async function sendNtfy(config: NtfyConfig, title: string, message: string): Promise<boolean> {
  const serverUrl = config.serverUrl ?? "https://ntfy.sh";
  const url = `${serverUrl.replace(/\/$/, "")}/${config.topic}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Title: title },
    body: message,
  });
  return response.ok;
}

async function sendPushover(config: PushoverConfig, title: string, message: string): Promise<boolean> {
  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: config.appToken,
      user: config.userKey,
      title,
      message,
    }),
  });
  return response.ok;
}

async function sendEmail(_config: EmailConfig, title: string, message: string): Promise<boolean> {
  // TODO: Implement with nodemailer when dependency is added.
  // For now, log to console as a placeholder.
  console.log(`[Email Notification] To: ${_config.to}`);
  console.log(`  Subject: ${title}`);
  console.log(`  Body: ${message}`);
  return true;
}

async function sendHomeAssistant(config: HomeAssistantConfig, title: string, message: string): Promise<boolean> {
  const service = config.service ?? "notify";
  const url = `${config.baseUrl.replace(/\/$/, "")}/api/services/notify/${service}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ message, title }),
  });
  return response.ok;
}

// ─── Main send function ─────────────────────────────────────────────────────

export async function sendNotification(
  channel: NotificationChannel,
  title: string,
  message: string,
): Promise<boolean> {
  // Check quiet hours
  if (isInQuietHours(channel.quietHoursStart, channel.quietHoursEnd)) {
    console.log(`[Notification] Skipping "${channel.name}" — quiet hours active`);
    return true;
  }

  if (!channel.enabled) {
    console.log(`[Notification] Skipping "${channel.name}" — channel disabled`);
    return true;
  }

  const config = channel.config as Record<string, string>;

  try {
    switch (channel.type) {
      case "slack":
        return await sendSlack(config as unknown as SlackConfig, title, message);
      case "discord":
        return await sendDiscord(config as unknown as DiscordConfig, title, message);
      case "ntfy":
        return await sendNtfy(config as unknown as NtfyConfig, title, message);
      case "pushover":
        return await sendPushover(config as unknown as PushoverConfig, title, message);
      case "email":
        return await sendEmail(config as unknown as EmailConfig, title, message);
      case "homeassistant":
        return await sendHomeAssistant(config as unknown as HomeAssistantConfig, title, message);
      default:
        console.warn(`[Notification] Unknown channel type: ${channel.type}`);
        return false;
    }
  } catch (err) {
    console.error(`[Notification] Failed to send via ${channel.type}:`, err);
    return false;
  }
}
