import { samplePickupDropoff, sampleOneEnd, type Rng, type ZoneOptions } from "./zone";
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
};

export type GenerateSettings = ZoneOptions & {
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
    "pickup.lng": String(pickup[0]),
    "pickup.lat": String(pickup[1]),
    "dropoff.lng": String(dropoff[0]),
    "dropoff.lat": String(dropoff[1]),
  });
  return { key: newKey(), values, manual: [] };
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
  const p = sampleOneEnd(coords, readPoint(order, other), settings, rng);
  const [lngCol, latCol, enCol, localCol] = endColumns(end);
  return assign(order, {
    [lngCol]: String(p[0]),
    [latCol]: String(p[1]),
    [enCol]: "",
    [localCol]: "",
  });
}

/** Apply a manual cell edit. Clearing a cell hands it back to the generator. */
export function editCell(order: Order, column: string, value: string): Order {
  const manual = order.manual.filter((c) => c !== column);
  if (value !== "") manual.push(column);
  return { ...order, values: { ...order.values, [column]: value }, manual };
}

export function nextId(orders: Order[]): number {
  return orders.reduce((max, o) => Math.max(max, parseInt(o.values.id, 10) || 0), 0) + 1;
}

export type AddressJob = { key: string; end: End; point: LngLat };

/** Ends whose address cells are empty (and not pinned by hand) and whose coordinates are valid. */
export function addressJobs(orders: Order[]): AddressJob[] {
  const jobs: AddressJob[] = [];
  for (const o of orders) {
    for (const end of ["pickup", "dropoff"] as End[]) {
      const [, , enCol, localCol] = endColumns(end);
      const wants = [enCol, localCol].some((c) => (o.values[c] ?? "") === "" && !o.manual.includes(c));
      const point = readPoint(o, end);
      if (wants && point) jobs.push({ key: o.key, end, point });
    }
  }
  return jobs;
}

/** Fill empty, non-manual address cells, only if the end has not moved since the lookup started. */
export function applyAddress(order: Order, end: End, point: LngLat, address: { en: string; local: string }): Order {
  const current = readPoint(order, end);
  if (!current || current[0] !== point[0] || current[1] !== point[1]) return order;
  const [, , enCol, localCol] = endColumns(end);
  const generated: Record<string, string> = {};
  if ((order.values[enCol] ?? "") === "") generated[enCol] = address.en;
  if ((order.values[localCol] ?? "") === "") generated[localCol] = address.local;
  return assign(order, generated);
}

/** Put a generated value into a cell (e.g. a picked name); the cell stays generator-owned. */
export function setGenerated(order: Order, column: string, value: string): Order {
  return { ...order, values: { ...order.values, [column]: value }, manual: order.manual.filter((c) => c !== column) };
}

export function renameColumnInOrders(orders: Order[], from: string, to: string): Order[] {
  return orders.map((o) => {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.values)) values[k === from ? to : k] = v;
    return { ...o, values, manual: o.manual.map((c) => (c === from ? to : c)) };
  });
}

export function dropColumnFromOrders(orders: Order[], column: string): Order[] {
  return orders.map((o) => {
    const { [column]: _dropped, ...values } = o.values;
    void _dropped;
    return { ...o, values, manual: o.manual.filter((c) => c !== column) };
  });
}

export const isDefaultColumn = (c: string) => (DEFAULT_COLUMNS as readonly string[]).includes(c);
