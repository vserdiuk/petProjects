import type { LngLat } from "./types";

export class CoordinatesParseError extends Error {}

/**
 * Accepts any of:
 *  - [[lng, lat], ...]
 *  - {"type":"LineString","coordinates":[...]}
 *  - {"type":"Feature","geometry":{"type":"LineString",...}}
 *  - {"type":"FeatureCollection"} with exactly one LineString feature
 */
export function parseCoordinates(text: string): LngLat[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CoordinatesParseError("Not valid JSON");
  }
  return toCoordinates(data);
}

function toCoordinates(data: unknown): LngLat[] {
  if (Array.isArray(data)) return validate(data);
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.type === "LineString") return validate(obj.coordinates);
    if (obj.type === "Feature") return toCoordinates(obj.geometry);
    if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
      const lines = obj.features.filter(
        (f) => (f as { geometry?: { type?: string } })?.geometry?.type === "LineString",
      );
      if (lines.length === 1) return toCoordinates(lines[0]);
      throw new CoordinatesParseError(
        `FeatureCollection must contain exactly one LineString (found ${lines.length})`,
      );
    }
  }
  throw new CoordinatesParseError(
    "Expected [[lng, lat], ...] or a GeoJSON LineString",
  );
}

function validate(coords: unknown): LngLat[] {
  if (!Array.isArray(coords)) throw new CoordinatesParseError("coordinates must be an array");
  return coords.map((c, i) => {
    if (
      !Array.isArray(c) ||
      c.length < 2 ||
      typeof c[0] !== "number" ||
      typeof c[1] !== "number" ||
      !Number.isFinite(c[0]) ||
      !Number.isFinite(c[1])
    ) {
      throw new CoordinatesParseError(`Point #${i + 1} must be [lng, lat] numbers`);
    }
    const [lng, lat] = c as number[];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new CoordinatesParseError(
        `Point #${i + 1} is out of range. Order must be [lng, lat].`,
      );
    }
    return [lng, lat] as LngLat;
  });
}

export function formatCoordinates(coords: LngLat[], decimals = 6): string {
  const f = 10 ** decimals;
  const round = (n: number) => Math.round(n * f) / f;
  return JSON.stringify(coords.map(([lng, lat]) => [round(lng), round(lat)]));
}
