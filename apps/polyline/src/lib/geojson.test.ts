import { describe, expect, it } from "vitest";
import { CoordinatesParseError, formatCoordinates, parseCoordinates } from "./geojson";

const COORDS = [
  [-87.66888275135724, 41.87275672958214],
  [-87.68055572492351, 41.84002539799995],
];

describe("parseCoordinates", () => {
  it("accepts a bare coordinates array", () => {
    expect(parseCoordinates(JSON.stringify(COORDS))).toEqual(COORDS);
  });
  it("accepts a LineString", () => {
    expect(parseCoordinates(JSON.stringify({ type: "LineString", coordinates: COORDS }))).toEqual(COORDS);
  });
  it("accepts a Feature", () => {
    const f = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: COORDS } };
    expect(parseCoordinates(JSON.stringify(f))).toEqual(COORDS);
  });
  it("drops altitude", () => {
    expect(parseCoordinates("[[10, 20, 300]]")).toEqual([[10, 20]]);
  });
  it("rejects swapped order that goes out of range", () => {
    expect(() => parseCoordinates("[[41.8, -97.6]]")).toThrow(CoordinatesParseError);
  });
  it("rejects invalid JSON and wrong shapes", () => {
    expect(() => parseCoordinates("[[1,")).toThrow(CoordinatesParseError);
    expect(() => parseCoordinates('{"type":"Point","coordinates":[1,2]}')).toThrow(CoordinatesParseError);
    expect(() => parseCoordinates('[["a", 1]]')).toThrow(CoordinatesParseError);
  });
});

describe("formatCoordinates", () => {
  it("rounds to 6 decimals", () => {
    expect(formatCoordinates([[-87.66888275135724, 41.87275672958214]])).toBe("[[-87.668883,41.872757]]");
  });
});
