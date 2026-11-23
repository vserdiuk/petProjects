import { samplePickupDropoff, sampleOneEnd, distanceToLine, type Rng, type SampleOptions } from "./sampling";
import { formatIsoInZone } from "./time";
import type { LngLat } from "./types";

/** Default CSV columns, in this order. */
export const DEFAULT_COLUMNS = [
  "id",
  "pickup_window_start",
  "pickup_window_end",
  "dropoff_window_start",
  "dropoff_window_end",
  "pickup.address_en",
  "pickup.address_local",
  "pickup.lng",
  "pickup.lat",
  "dropoff.address_en",
  "dropoff.lng",
  "dropoff.address_local",
  "dropoff.lat",
  "capacity",
  "contact_name",
  "contact_phone",
  "contact_email",
  "memo",
] as const;

export type End = "pickup" | "dropoff";

export type Order = {
  /** Stable internal key (not the CSV id). */
  key: string;
  values: Record<string, string>;
  /** Columns the user edited by hand; generation never overwrites them. */
  manual: string[];
  /** Position along the polyline in metres, when known. */
  along: { pickup: number | null; dropoff: number | null };
};

export type GenerateSettings = SampleOptions & {
  windowHours: number;
  timeZone: string;
};

const endColumns = (end: End) => [
  `${end}.lng`,
  `${end}.lat`,
  `${end}.address_en`,
  `${end}.address_local`,
];

let keySeq = 0;
const newKey = () => `o${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** Write generated values, skipping cells the user edited by hand. */
function assign(order: Order, generated: Record<string, string>): Order {
  const values = { ...order.values };
  for (const [k, v] of Object.entries(generated)) {
    if (!order.manual.includes(k)) values[k] = v;
  }
  return { ...order, values };
}

export function timeWindow(now: Date, { windowHours, timeZone }: GenerateSettings) {
  const start = formatIsoInZone(now, timeZone);
  const end = formatIsoInZone(new Date(now.getTime() + windowHours * 3_600_000), timeZone);
  return {
    pickup_window_start: start,
    pickup_window_end: end,
    dropoff_window_start: start,
    dropoff_window_end: end,
  };
}

export function createOrder(
  id: number,
  columns: string[],
  coords: LngLat[],
  settings: GenerateSettings,
  now = new Date(),
  rng: Rng = Math.random,
): Order {
  const { pickup, dropoff } = samplePickupDropoff(coords, settings, rng);
  const values: Record<string, string> = Object.fromEntries(columns.map((c) => [c, ""]));
  Object.assign(values, {
    id: String(id),
    ...timeWindow(now, settings),
    "pickup.lng": String(pickup.point[0]),
    "pickup.lat": String(pickup.point[1]),
    "dropoff.lng": String(dropoff.point[0]),
    "dropoff.lat": String(dropoff.point[1]),
  });
  return {
    key: newKey(),
    values,
    manual: [],
    along: { pickup: pickup.along, dropoff: dropoff.along },
  };
}

/** True when the user pinned this end's coordinates by hand. */
export function endIsManual(order: Order, end: End): boolean {
  return order.manual.includes(`${end}.lng`) || order.manual.includes(`${end}.lat`);
}

export function readPoint(order: Order, end: End): LngLat | null {
  const lng = parseFloat(order.values[`${end}.lng`]);
  const lat = parseFloat(order.values[`${end}.lat`]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

/** Along-line position of an end, recomputed from its coordinates when unknown. */
export function alongOf(order: Order, end: End, coords: LngLat[]): number | null {
  if (order.along[end] != null) return order.along[end];
  const p = readPoint(order, end);
  return p && coords.length >= 2 ? distanceToLine(p, coords).along : null;
}

/**
 * New coordinates for one end. Address cells for that end are cleared so the
 * geocoder can refill them. Cells edited by hand are kept; if the coordinates
 * themselves were edited by hand, the end is left untouched.
 */
export function regenerateEnd(
  order: Order,
  end: End,
  coords: LngLat[],
  settings: GenerateSettings,
  rng: Rng = Math.random,
): Order {
  if (endIsManual(order, end)) return order;
  const other: End = end === "pickup" ? "dropoff" : "pickup";
  const p = sampleOneEnd(coords, end, alongOf(order, other, coords), settings, rng);
  const [lngCol, latCol, enCol, localCol] = endColumns(end);
  const next = assign(order, {
    [lngCol]: String(p.point[0]),
    [latCol]: String(p.point[1]),
    [enCol]: "",
    [localCol]: "",
  });
  return { ...next, along: { ...order.along, [end]: p.along } };
}

/** Apply a manual cell edit. Clearing a cell hands it back to the generator. */
export function editCell(order: Order, column: string, value: string): Order {
  const manual = order.manual.filter((c) => c !== column);
  if (value !== "") manual.push(column);
  const along = { ...order.along };
  for (const end of ["pickup", "dropoff"] as End[]) {
    if (column === `${end}.lng` || column === `${end}.lat`) along[end] = null;
  }
  return { ...order, values: { ...order.values, [column]: value }, manual, along };
}

export function nextId(orders: Order[]): number {
  return orders.reduce((max, o) => Math.max(max, parseInt(o.values.id, 10) || 0), 0) + 1;
}
