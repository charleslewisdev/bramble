import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns 'Today' for today's date", () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(formatDate(todayStr)).toBe("Today");
  });

  it("returns 'Tomorrow' for tomorrow's date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    expect(formatDate(tomorrowStr)).toBe("Tomorrow");
  });

  it("returns formatted date string for other dates", () => {
    // A date far in the past won't match today or tomorrow
    const result = formatDate("2025-01-15");
    // Should contain "Jan" and "15" at minimum
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("includes weekday in formatted output", () => {
    const result = formatDate("2025-01-15"); // This was a Wednesday
    expect(result).toContain("Wed");
  });
});
