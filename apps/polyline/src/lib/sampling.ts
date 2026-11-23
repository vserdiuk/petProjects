import { haversine } from "./geo";
import type { LngLat } from "./types";

export type Rng = () => number;

export class SamplingError extends Error {}

/** Cumulative distance in metres from the first vertex to each vertex. */
export function cumulativeLengths(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

/** Point at `distance` metres along the line, plus the bearing of that segment (radians, local planar). */
export function pointAlong(
  coords: LngLat[],
  cum: number[],
  distance: number,
): { point: LngLat; segment: number } {
  const total = cum[cum.length - 1];
  const d = Math.min(Math.max(distance, 0), total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const segLen = cum[i] - cum[i - 1];
  const t = segLen === 0 ? 0 : (d - cum[i - 1]) / segLen;
  const [x1, y1] = coords[i - 1];
  const [x2, y2] = coords[i];
  return { point: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], segment: i - 1 };
}

const METRES_PER_DEG_LAT = 111_320;

/** Move `point` sideways (perpendicular to the segment) by `offset` metres; positive = left. */
export function offsetPerpendicular(point: LngLat, a: LngLat, b: LngLat, offset: number): LngLat {
  const cosLat = Math.cos((point[1] * Math.PI) / 180);
  // Local planar metres.
  const dx = (b[0] - a[0]) * METRES_PER_DEG_LAT * cosLat;
  const dy = (b[1] - a[1]) * METRES_PER_DEG_LAT;
  const len = Math.hypot(dx, dy);
  if (len === 0 || offset === 0) return point;
  const nx = -dy / len;
  const ny = dx / len;
  return [
    point[0] + (nx * offset) / (METRES_PER_DEG_LAT * cosLat),
    point[1] + (ny * offset) / METRES_PER_DEG_LAT,
  ];
}

export type SampleOptions = {
  /** Max distance from the line, metres. */
  bufferM: number;
  /** Min distance between pickup and dropoff measured along the line, metres. */
  minGapM: number;
};

export type SampledPoint = {
  point: LngLat;
  /** Position along the line, metres from the start. */
  along: number;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function sampleAt(coords: LngLat[], cum: number[], along: number, bufferM: number, rng: Rng): SampledPoint {
  const { point, segment } = pointAlong(coords, cum, along);
  const offset = (rng() * 2 - 1) * bufferM;
  const p = offsetPerpendicular(point, coords[segment], coords[segment + 1], offset);
  return { point: [round6(p[0]), round6(p[1])], along };
}

export function lineTooShort(coords: LngLat[], minGapM: number): boolean {
  if (coords.length < 2) return true;
  const cum = cumulativeLengths(coords);
  return cum[cum.length - 1] < minGapM;
}

/**
 * Pickup and dropoff near the line: dropoff lies further along the line than
 * pickup, at least `minGapM` metres away (along the line).
 */
export function samplePickupDropoff(
  coords: LngLat[],
  { bufferM, minGapM }: SampleOptions,
  rng: Rng = Math.random,
): { pickup: SampledPoint; dropoff: SampledPoint } {
  if (coords.length < 2) throw new SamplingError("Draw or paste a polyline with at least 2 points first");
  const cum = cumulativeLengths(coords);
  const total = cum[cum.length - 1];
  if (total < minGapM) {
    throw new SamplingError(
      `The line is ${(total / 1000).toFixed(2)} km, shorter than the minimum pickup→dropoff distance (${(minGapM / 1000).toFixed(2)} km)`,
    );
  }
  const a = rng() * (total - minGapM);
  const b = a + minGapM + rng() * (total - minGapM - a);
  return {
    pickup: sampleAt(coords, cum, a, bufferM, rng),
    dropoff: sampleAt(coords, cum, b, bufferM, rng),
  };
}

/** Regenerate only one end, keeping the min gap to the other end where possible. */
export function sampleOneEnd(
  coords: LngLat[],
  end: "pickup" | "dropoff",
  otherAlong: number | null,
  { bufferM, minGapM }: SampleOptions,
  rng: Rng = Math.random,
): SampledPoint {
  if (coords.length < 2) throw new SamplingError("Draw or paste a polyline with at least 2 points first");
  const cum = cumulativeLengths(coords);
  const total = cum[cum.length - 1];
  let lo = 0;
  let hi = total;
  if (otherAlong != null) {
    if (end === "pickup") hi = otherAlong - minGapM;
    else lo = otherAlong + minGapM;
  }
  if (hi < lo) {
    throw new SamplingError(
      `No room for a ${end} at least ${(minGapM / 1000).toFixed(2)} km from the ${end === "pickup" ? "dropoff" : "pickup"}. Regenerate the other end or the whole row.`,
    );
  }
  return sampleAt(coords, cum, lo + rng() * (hi - lo), bufferM, rng);
}

/** Distance in metres from a point to the polyline (planar approximation, fine for short distances). */
export function distanceToLine(p: LngLat, coords: LngLat[]): { distance: number; along: number } {
  const cum = cumulativeLengths(coords);
  let best = { distance: Infinity, along: 0 };
  const cosLat = Math.cos((p[1] * Math.PI) / 180);
  const toXY = ([lng, lat]: LngLat) => [lng * METRES_PER_DEG_LAT * cosLat, lat * METRES_PER_DEG_LAT];
  const [px, py] = toXY(p);
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = toXY(coords[i - 1]);
    const [bx, by] = toXY(coords[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best.distance) best = { distance: d, along: cum[i - 1] + t * (cum[i] - cum[i - 1]) };
  }
  return best;
}
