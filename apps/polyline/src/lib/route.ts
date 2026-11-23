import type { LngLat } from "./types";

/**
 * Driving route between two points through the public OSRM demo server
 * (OpenStreetMap data, no key). Light use only: results are cached and
 * callers debounce hover events.
 */
export const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

const cache = new Map<string, Promise<LngLat[]>>();

export function roadRoute(a: LngLat, b: LngLat, fetchFn: typeof fetch = (...x) => fetch(...x)): Promise<LngLat[]> {
  const key = `${a[0]},${a[1]};${b[0]},${b[1]}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetchFn(`${OSRM_URL}/${key}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = (await res.json()) as { code?: string; routes?: { geometry?: { coordinates?: LngLat[] } }[] };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (data.code !== "Ok" || !coords?.length) throw new Error(`OSRM: ${data.code ?? "no route"}`);
    // Join the snapped route to the exact pickup/dropoff points.
    return [a, ...coords, b];
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}
