import type { PlantInstance, PlantReference, WeatherCacheEntry } from "../db/schema.js";

export interface WeatherAlert {
  type: "frost_warning" | "heat_warning" | "rain_skip" | "wind_warning";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  affectedPlants: number[];
}

export interface PlantInstanceWithRef extends PlantInstance {
  plantReference?: PlantReference | null;
}

export function checkWeatherAlerts(
  _locationId: number,
  weather: WeatherCacheEntry,
  plants: PlantInstanceWithRef[],
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  // Only consider outdoor, living plants
  const outdoorPlants = plants.filter(
    (p) =>
      p.status !== "dead" &&
      p.status !== "removed" &&
      p.status !== "planned",
  );

  // ── Frost warning ─────────────────────────────────────────────────────────
  const forecastMinTemp = weather.temperatureLow;
  if (forecastMinTemp != null && forecastMinTemp < 35) {
    const affected = outdoorPlants.filter((p) => {
      const minTemp = p.plantReference?.minTempF;
      return minTemp != null && minTemp > forecastMinTemp;
    });

    if (affected.length > 0) {
      alerts.push({
        type: "frost_warning",
        severity: "critical",
        title: "Frost Warning",
        message: `Tonight's low is ${Math.round(forecastMinTemp)}°F. ${affected.length} plant${affected.length > 1 ? "s" : ""} may need frost protection.`,
        affectedPlants: affected.map((p) => p.id),
      });
    }
  }

  // ── Heat warning ──────────────────────────────────────────────────────────
  const forecastMaxTemp = weather.temperatureHigh;
  if (forecastMaxTemp != null && forecastMaxTemp > 95) {
    const affected = outdoorPlants.filter((p) => {
      const maxTemp = p.plantReference?.maxTempF;
      return maxTemp != null && maxTemp < forecastMaxTemp;
    });

    if (affected.length > 0) {
      alerts.push({
        type: "heat_warning",
        severity: "warning",
        title: "Heat Warning",
        message: `Today's high is ${Math.round(forecastMaxTemp)}°F. ${affected.length} plant${affected.length > 1 ? "s" : ""} may need extra water or shade.`,
        affectedPlants: affected.map((p) => p.id),
      });
    }
  }

  // ── Rain skip ─────────────────────────────────────────────────────────────
  const precipitation = weather.precipitation;
  if (precipitation != null && precipitation > 0.1) {
    alerts.push({
      type: "rain_skip",
      severity: "info",
      title: "Rain Today",
      message: `${precipitation.toFixed(2)} inches of precipitation recorded — you can skip watering outdoor plants today.`,
      affectedPlants: outdoorPlants.map((p) => p.id),
    });
  }

  // ── Wind warning ──────────────────────────────────────────────────────────
  const windGust = weather.windGust;
  if (windGust != null && windGust > 40) {
    // Tall or delicate plants: trees, vines, flowers, and tall grasses
    const delicateTypes = new Set(["tree", "vine", "flower", "grass"]);
    const affected = outdoorPlants.filter((p) => {
      const plantType = p.plantReference?.plantType;
      return plantType != null && delicateTypes.has(plantType);
    });

    if (affected.length > 0) {
      alerts.push({
        type: "wind_warning",
        severity: "warning",
        title: "High Wind Warning",
        message: `Wind gusts up to ${Math.round(windGust)} mph. ${affected.length} tall or delicate plant${affected.length > 1 ? "s" : ""} may need support or shelter.`,
        affectedPlants: affected.map((p) => p.id),
      });
    }
  }

  return alerts;
}
