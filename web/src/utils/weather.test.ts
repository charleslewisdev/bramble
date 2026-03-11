import { describe, it, expect } from "vitest";
import { getWeatherEmoji, formatTemperature, formatTempShort } from "./weather";

describe("getWeatherEmoji", () => {
  it("returns rain emoji for rain conditions", () => {
    expect(getWeatherEmoji("light rain")).toBe("\u{1f327}");
    expect(getWeatherEmoji("Heavy Rain")).toBe("\u{1f327}");
    expect(getWeatherEmoji("drizzle")).toBe("\u{1f327}");
  });

  it("returns snowflake for snow conditions", () => {
    expect(getWeatherEmoji("light snow")).toBe("\u{2744}\u{fe0f}");
  });

  it("returns thunder emoji for storms", () => {
    expect(getWeatherEmoji("thunderstorm")).toBe("\u{26c8}");
    expect(getWeatherEmoji("Severe Storm")).toBe("\u{26c8}");
  });

  it("returns cloud emoji for cloudy/overcast", () => {
    expect(getWeatherEmoji("cloudy")).toBe("\u{2601}\u{fe0f}");
    expect(getWeatherEmoji("Overcast")).toBe("\u{2601}\u{fe0f}");
  });

  it("returns fog emoji for fog/mist", () => {
    expect(getWeatherEmoji("fog")).toBe("\u{1f32b}");
    expect(getWeatherEmoji("light mist")).toBe("\u{1f32b}");
  });

  it("returns sun emoji for clear/sunny", () => {
    expect(getWeatherEmoji("clear")).toBe("\u{2600}\u{fe0f}");
    expect(getWeatherEmoji("Sunny")).toBe("\u{2600}\u{fe0f}");
  });

  it("returns cloud emoji for 'partly cloudy' (cloud match takes precedence)", () => {
    expect(getWeatherEmoji("Partly Cloudy")).toBe("\u{2601}\u{fe0f}");
  });

  it("returns sun emoji for 'partly sunny' (sunny match takes precedence)", () => {
    expect(getWeatherEmoji("Partly Sunny")).toBe("\u{2600}\u{fe0f}");
  });

  it("returns partly emoji when no other keyword matches", () => {
    expect(getWeatherEmoji("Partly")).toBe("\u{26c5}");
  });

  it("returns default emoji for null/undefined", () => {
    expect(getWeatherEmoji(null)).toBe("\u{1f324}");
    expect(getWeatherEmoji(undefined)).toBe("\u{1f324}");
  });

  it("returns default emoji for unknown conditions", () => {
    expect(getWeatherEmoji("something weird")).toBe("\u{1f324}");
  });

  it("is case-insensitive", () => {
    expect(getWeatherEmoji("RAIN")).toBe("\u{1f327}");
    expect(getWeatherEmoji("Clear SKY")).toBe("\u{2600}\u{fe0f}");
  });
});

describe("formatTemperature", () => {
  it("formats Fahrenheit with degree symbol", () => {
    expect(formatTemperature(72, "F")).toBe("72\u{00b0}F");
  });

  it("converts to Celsius correctly", () => {
    expect(formatTemperature(32, "C")).toBe("0\u{00b0}C");
    expect(formatTemperature(212, "C")).toBe("100\u{00b0}C");
    expect(formatTemperature(72, "C")).toBe("22\u{00b0}C");
  });

  it("rounds Fahrenheit values", () => {
    expect(formatTemperature(72.6, "F")).toBe("73\u{00b0}F");
    expect(formatTemperature(72.4, "F")).toBe("72\u{00b0}F");
  });

  it("rounds Celsius conversions", () => {
    expect(formatTemperature(100, "C")).toBe("38\u{00b0}C");
  });
});

describe("formatTempShort", () => {
  it("formats Fahrenheit with degree symbol only", () => {
    expect(formatTempShort(72, "F")).toBe("72\u{00b0}");
  });

  it("converts to Celsius and shows degree only", () => {
    expect(formatTempShort(32, "C")).toBe("0\u{00b0}");
  });

  it("rounds values", () => {
    expect(formatTempShort(72.6, "F")).toBe("73\u{00b0}");
  });
});
