import type { Structure } from "../db/schema.js";

export interface ShadowPolygon {
  structureId: number;
  structureName: string;
  polygon: { x: number; y: number }[]; // shadow outline in lot coordinates (feet)
}

/**
 * Calculate shadow polygons for structures given sun position.
 *
 * @param structures - Array of structures on the lot
 * @param sunAzimuth - Sun azimuth in degrees from north (0 = N, 90 = E, 180 = S, 270 = W)
 * @param sunAltitude - Sun altitude in degrees above horizon
 * @param compassOrientation - Lot rotation from north in degrees
 * @returns Array of shadow polygons
 */
export function calculateShadows(
  structures: Structure[],
  sunAzimuth: number,
  sunAltitude: number,
  compassOrientation: number,
): ShadowPolygon[] {
  // No shadows when sun is at or below horizon
  if (sunAltitude <= 0) {
    return [];
  }

  const altitudeRad = (sunAltitude * Math.PI) / 180;

  // Shadow direction is opposite of sun azimuth
  // Preview is always north-up, so no compass rotation needed
  const shadowAzimuthDeg = (sunAzimuth + 180) % 360;
  const shadowAzimuthRad = (shadowAzimuthDeg * Math.PI) / 180;

  // Shadow offset in screen coordinates (x = east/right, y = south/down)
  const shadowDx = Math.sin(shadowAzimuthRad);
  const shadowDy = -Math.cos(shadowAzimuthRad); // negate: cos gives north component, screen Y is south

  return structures.map((structure) => {
    const shadowLength = structure.height / Math.tan(altitudeRad);

    // Structure corners (base rectangle)
    const corners = [
      { x: structure.posX, y: structure.posY },
      { x: structure.posX + structure.width, y: structure.posY },
      { x: structure.posX + structure.width, y: structure.posY + structure.depth },
      { x: structure.posX, y: structure.posY + structure.depth },
    ];

    // Project each corner along the shadow direction
    const projected = corners.map((c) => ({
      x: c.x + shadowDx * shadowLength,
      y: c.y + shadowDy * shadowLength,
    }));

    // The shadow polygon is the convex hull of base + projected points
    // For a simple rectangle, we can construct it as: base side facing sun + projected side away from sun
    // For simplicity, return all 8 points and let the client handle convex hull,
    // or compute a simple polygon by ordering: base corners + reversed projected corners
    const polygon = [...corners, ...projected.reverse()];

    return {
      structureId: structure.id,
      structureName: structure.name,
      polygon,
    };
  });
}
