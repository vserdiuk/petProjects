import tzLookup from "@photostructure/tz-lookup";
import type { LngLat } from "./types";

/** IANA time zone at the given point, e.g. "Asia/Tokyo". */
export function timeZoneAt([lng, lat]: LngLat): string | null {
  try {
    return tzLookup(lat, lng);
  } catch {
    return null;
  }
}

/** Offset of `timeZone` at `date`, as "+09:00". */
export function offsetString(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  // "GMT+09:00", "GMT-05:00", or plain "GMT" for UTC.
  const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+00:00";
}

/** "2021-09-22T00:00:00+09:00": wall-clock time in `timeZone` with its offset. Seconds are dropped. */
export function formatIsoInZone(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00${offsetString(date, timeZone)}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
