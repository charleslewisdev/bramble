export function getWeatherEmoji(conditions?: string | null): string {
  if (!conditions) return "\u{1f324}";
  const c = conditions.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return "\u{1f327}";
  if (c.includes("snow")) return "\u{2744}\u{fe0f}";
  if (c.includes("thunder") || c.includes("storm")) return "\u{26c8}";
  if (c.includes("cloud") || c.includes("overcast")) return "\u{2601}\u{fe0f}";
  if (c.includes("fog") || c.includes("mist")) return "\u{1f32b}";
  if (c.includes("clear") || c.includes("sunny")) return "\u{2600}\u{fe0f}";
  if (c.includes("partly")) return "\u{26c5}";
  return "\u{1f324}";
}

export function formatTemperature(tempF: number, unit: string): string {
  if (unit === "C") {
    return `${Math.round((tempF - 32) * 5 / 9)}\u{00b0}C`;
  }
  return `${Math.round(tempF)}\u{00b0}F`;
}

export function formatTempShort(tempF: number, unit: string): string {
  if (unit === "C") {
    return `${Math.round((tempF - 32) * 5 / 9)}\u{00b0}`;
  }
  return `${Math.round(tempF)}\u{00b0}`;
}
