import { describe, expect, it } from "vitest";
import { createOrder, DEFAULT_COLUMNS, editCell, regenerateEnd, type GenerateSettings } from "./orders";
import { toCsv } from "./csv";
import type { LngLat } from "./types";

const LINE: LngLat[] = [[139.70, 35.68], [139.80, 35.68]]; // ~9 km in Tokyo
const SETTINGS: GenerateSettings = { bufferM: 10, minGapM: 2000, windowHours: 8, timeZone: "Asia/Tokyo" };
const NOW = new Date("2021-09-21T15:00:00Z");

describe("orders", () => {
  it("creates a row with all default columns and +8h windows", () => {
    const o = createOrder(1, [...DEFAULT_COLUMNS], LINE, SETTINGS, NOW);
    expect(Object.keys(o.values)).toEqual([...DEFAULT_COLUMNS]);
    expect(o.values.id).toBe("1");
    expect(o.values.pickup_window_start).toBe("2021-09-22T00:00:00+09:00");
    expect(o.values.pickup_window_end).toBe("2021-09-22T08:00:00+09:00");
    expect(o.values.dropoff_window_start).toBe(o.values.pickup_window_start);
    expect(o.values.dropoff_window_end).toBe(o.values.pickup_window_end);
    expect(o.values.capacity).toBe("");
    expect(parseFloat(o.values["pickup.lng"])).toBeLessThan(parseFloat(o.values["dropoff.lng"]));
  });

  it("regeneration keeps cells edited by hand", () => {
    let o = createOrder(1, [...DEFAULT_COLUMNS], LINE, SETTINGS, NOW);
    o = { ...o, values: { ...o.values, "pickup.address_en": "auto" } };
    o = editCell(o, "pickup.address_local", "東京");
    const before = o.values["pickup.lng"];
    const r = regenerateEnd(o, "pickup", LINE, SETTINGS);
    expect(r.values["pickup.lng"]).not.toBe(before);
    expect(r.values["pickup.address_en"]).toBe("");
    expect(r.values["pickup.address_local"]).toBe("東京");
  });

  it("does not move an end whose coordinates were set by hand", () => {
    let o = createOrder(1, [...DEFAULT_COLUMNS], LINE, SETTINGS, NOW);
    o = editCell(o, "dropoff.lat", "35.6801");
    expect(regenerateEnd(o, "dropoff", LINE, SETTINGS)).toBe(o);
  });

  it("clearing a cell gives it back to the generator", () => {
    let o = createOrder(1, [...DEFAULT_COLUMNS], LINE, SETTINGS, NOW);
    o = editCell(o, "memo", "hi");
    expect(o.manual).toContain("memo");
    o = editCell(o, "memo", "");
    expect(o.manual).not.toContain("memo");
  });
});

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [["1,2", 'say "hi"'], ["x\ny", "z"]])).toBe(
      'a,b\r\n"1,2","say ""hi"""\r\n"x\ny",z\r\n',
    );
  });
});
