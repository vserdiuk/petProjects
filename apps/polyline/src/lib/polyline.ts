import type { LngLat } from "./types";

/**
 * Google Encoded Polyline Algorithm.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * The encoded format stores lat first; we expose [lng, lat] (GeoJSON order).
 */

export type Precision = 5 | 6;

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(coords: LngLat[], precision: Precision = 5): string {
  const factor = 10 ** precision;
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const [lng, lat] of coords) {
    const iLat = Math.round(lat * factor);
    const iLng = Math.round(lng * factor);
    out += encodeValue(iLat - prevLat) + encodeValue(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return out;
}

export class PolylineDecodeError extends Error {}

export function decodePolyline(encoded: string, precision: Precision = 5): LngLat[] {
  const str = encoded.trim();
  const factor = 10 ** precision;
  const coords: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= str.length) throw new PolylineDecodeError("Encoded polyline ends unexpectedly");
      byte = str.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 0x3f) {
        throw new PolylineDecodeError(`Invalid character "${str[index - 1]}" at position ${index}`);
      }
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < str.length) {
    lat += readValue();
    lng += readValue();
    const point: LngLat = [lng / factor, lat / factor];
    if (Math.abs(point[1]) > 90 || Math.abs(point[0]) > 180) {
      throw new PolylineDecodeError(
        "Decoded coordinates are out of range. Check the precision (5 vs 6).",
      );
    }
    coords.push(point);
  }
  return coords;
}
