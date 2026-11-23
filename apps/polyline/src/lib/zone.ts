import { haversine } from "./geo";
import type { LngLat } from "./types";

/**
 * The polyline is a service zone: a closed area that orders may start and
 * end in. The ring is closed implicitly (last point connects to the first).
 */

export type Rng = () => number;

export class SamplingError extends Error {}

export type ZoneOptions = {
  /** Min straight-line distance between pickup and dropoff, metres. */
  minGapM: number;
};

const MAX_ATTEMPTS = 5000;

/** Even-odd point-in-polygon test (works for self-intersecting rings too). */
export function pointInZone([x, y]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The ring without a duplicated closing point. */
export function openRing(coords: LngLat[]): LngLat[] {
  const n = coords.length;
  if (n > 1 && coords[0][0] === coords[n - 1][0] && coords[0][1] === coords[n - 1][1]) return coords.slice(0, -1);
  return coords;
}

/** The ring with the closing point, for drawing. */
export function closedRing(coords: LngLat[]): LngLat[] {
  const ring = openRing(coords);
  return ring.length >= 3 ? [...ring, ring[0]] : ring;
}

function assertZone(coords: LngLat[]): LngLat[] {
  const ring = openRing(coords);
  if (ring.length < 3) throw new SamplingError("Draw or paste a zone with at least 3 points first");
  return ring;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function bbox(ring: LngLat[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Uniform random point inside the zone (rejection sampling over the bounding box). */
function randomInside(ring: LngLat[], rng: Rng, accept: (p: LngLat) => boolean = () => true): LngLat | null {
  const { minX, minY, maxX, maxY } = bbox(ring);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const p: LngLat = [round6(minX + rng() * (maxX - minX)), round6(minY + rng() * (maxY - minY))];
    if (pointInZone(p, ring) && accept(p)) return p;
  }
  return null;
}

export function samplePickupDropoff(
  coords: LngLat[],
  { minGapM }: ZoneOptions,
  rng: Rng = Math.random,
): { pickup: LngLat; dropoff: LngLat } {
  const ring = assertZone(coords);
  for (let i = 0; i < 50; i++) {
    const pickup = randomInside(ring, rng);
    if (!pickup) break;
    const dropoff = randomInside(ring, rng, (p) => haversine(pickup, p) >= minGapM);
    if (dropoff) return { pickup, dropoff };
  }
  throw new SamplingError(
    `Could not place a pickup and dropoff ${(minGapM / 1000).toFixed(2)} km apart inside the zone. Make the zone bigger or lower the minimum distance.`,
  );
}

/** New point for one end, at least the min gap away from the other end when it is known. */
export function sampleOneEnd(
  coords: LngLat[],
  other: LngLat | null,
  { minGapM }: ZoneOptions,
  rng: Rng = Math.random,
): LngLat {
  const ring = assertZone(coords);
  const p = randomInside(ring, rng, (q) => !other || haversine(other, q) >= minGapM);
  if (!p) {
    throw new SamplingError(
      `No spot inside the zone is ${(minGapM / 1000).toFixed(2)} km from the other end. Regenerate the other end or lower the minimum distance.`,
    );
  }
  return p;
}
