import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline, PolylineDecodeError } from "./polyline";
import type { LngLat } from "./types";

// Reference example from Google's algorithm documentation.
const GOOGLE_EXAMPLE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
const GOOGLE_POINTS: LngLat[] = [
  [-120.2, 38.5],
  [-120.95, 40.7],
  [-126.453, 43.252],
];

describe("polyline", () => {
  it("encodes Google's reference example", () => {
    expect(encodePolyline(GOOGLE_POINTS)).toBe(GOOGLE_EXAMPLE);
  });

  it("decodes Google's reference example to [lng, lat]", () => {
    expect(decodePolyline(GOOGLE_EXAMPLE)).toEqual(GOOGLE_POINTS);
  });

  it("round-trips with precision 6", () => {
    const pts: LngLat[] = [
      [-87.668883, 41.872757],
      [-87.680556, 41.840025],
      [139.767125, 35.681236],
    ];
    expect(decodePolyline(encodePolyline(pts, 6), 6)).toEqual(pts);
  });

  it("handles empty input", () => {
    expect(encodePolyline([])).toBe("");
    expect(decodePolyline("  ")).toEqual([]);
  });

  it("rejects truncated input", () => {
    expect(() => decodePolyline("_p~iF~ps|U_ulL")).toThrow(PolylineDecodeError);
  });

  it("rejects invalid characters", () => {
    expect(() => decodePolyline("_p~iF ~ps|U")).toThrow(PolylineDecodeError);
  });
});
