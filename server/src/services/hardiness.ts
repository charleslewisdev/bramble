export interface HardinessZoneResult {
  zone: string;
  temperatureRange: string;
}

export async function getHardinessZone(
  zipCode: string,
): Promise<HardinessZoneResult | null> {
  try {
    const url = `https://phzmapi.org/${zipCode}.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      zone: string;
      temperature_range: string;
    };

    if (!data.zone) {
      return null;
    }

    return {
      zone: data.zone,
      temperatureRange: data.temperature_range,
    };
  } catch {
    return null;
  }
}

/**
 * Extract a US ZIP code from an address string.
 * Matches 5-digit ZIP codes, optionally with +4 extension.
 */
export function extractZipCode(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}

/**
 * Rough US timezone detection based on longitude ranges.
 * This is a simple heuristic — not accurate for all edge cases.
 */
export function detectTimezoneFromCoordinates(
  lat: number,
  lng: number,
): string {
  // Only attempt for continental US range
  if (lat < 24 || lat > 50 || lng < -125 || lng > -66) {
    // Hawaii
    if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) {
      return "Pacific/Honolulu";
    }
    // Alaska
    if (lat >= 51 && lat <= 72 && lng >= -180 && lng <= -129) {
      return "America/Anchorage";
    }
    return "America/New_York"; // fallback
  }

  if (lng <= -115) return "America/Los_Angeles"; // Pacific
  if (lng <= -102) return "America/Denver"; // Mountain
  if (lng <= -87) return "America/Chicago"; // Central
  return "America/New_York"; // Eastern
}
