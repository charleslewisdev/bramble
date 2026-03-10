interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "5",
    countrycodes: "us",
  });

  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Bramble Garden App/1.0 (self-hosted garden management)",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Nominatim API error: ${response.status} ${response.statusText}`,
    );
  }

  const results = (await response.json()) as NominatimResult[];

  return results.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name,
  }));
}
