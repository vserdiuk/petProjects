import { describe, expect, it } from "vitest";
import { formatIsoInZone, timeZoneAt } from "./time";

describe("time", () => {
  it("finds the zone by coordinates", () => {
    expect(timeZoneAt([139.7671, 35.6812])).toBe("Asia/Tokyo");
    expect(timeZoneAt([-87.6689, 41.8728])).toBe("America/Chicago");
  });

  it("formats wall-clock time with offset", () => {
    const d = new Date("2021-09-21T15:00:30Z");
    expect(formatIsoInZone(d, "Asia/Tokyo")).toBe("2021-09-22T00:00:00+09:00");
    expect(formatIsoInZone(d, "UTC")).toBe("2021-09-21T15:00:00+00:00");
  });

  it("follows daylight saving time", () => {
    expect(formatIsoInZone(new Date("2021-07-01T12:00:00Z"), "America/Chicago")).toBe("2021-07-01T07:00:00-05:00");
    expect(formatIsoInZone(new Date("2021-12-01T12:00:00Z"), "America/Chicago")).toBe("2021-12-01T06:00:00-06:00");
  });
});
