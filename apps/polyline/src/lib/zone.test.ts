import { describe, expect, it } from "vitest";
import { closedRing, pointInZone, samplePickupDropoff, sampleOneEnd, SamplingError } from "./zone";
import { haversine } from "./geo";
import type { LngLat } from "./types";

function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

// The Chicago shape from the thread (closed: last ≈ first).
const CHICAGO: LngLat[] = [
  [-87.66888275135724, 41.87275672958214],
  [-87.68055572492351, 41.84002539799995],
  [-87.64866828918457, 41.83641219781257],
  [-87.63238191604616, 41.88325319522861],
  [-87.66853942860526, 41.87224543135467],
];

// L-shaped zone: the notch (top-right) is outside.
const L: LngLat[] = [[0, 0], [0.1, 0], [0.1, 0.05], [0.05, 0.05], [0.05, 0.1], [0, 0.1]];

describe("pointInZone", () => {
  it("handles concave zones", () => {
    expect(pointInZone([0.02, 0.02], L)).toBe(true);
    expect(pointInZone([0.08, 0.08], L)).toBe(false);
    expect(pointInZone([0.2, 0.02], L)).toBe(false);
  });
});

describe("samplePickupDropoff", () => {
  it("places both points inside the zone, at least the min gap apart", () => {
    const rng = seeded();
    for (let i = 0; i < 300; i++) {
      const { pickup, dropoff } = samplePickupDropoff(CHICAGO, { minGapM: 2000 }, rng);
      expect(pointInZone(pickup, CHICAGO)).toBe(true);
      expect(pointInZone(dropoff, CHICAGO)).toBe(true);
      expect(haversine(pickup, dropoff)).toBeGreaterThanOrEqual(2000);
    }
  });

  it("never uses the notch of a concave zone", () => {
    const rng = seeded(3);
    for (let i = 0; i < 300; i++) {
      const { pickup, dropoff } = samplePickupDropoff(L, { minGapM: 1000 }, rng);
      expect(pickup[0] > 0.05 && pickup[1] > 0.05).toBe(false);
      expect(dropoff[0] > 0.05 && dropoff[1] > 0.05).toBe(false);
    }
  });

  it("fails clearly for a too-small zone or too few points", () => {
    const tiny: LngLat[] = [[0, 0], [0.001, 0], [0.001, 0.001]];
    expect(() => samplePickupDropoff(tiny, { minGapM: 2000 })).toThrow(SamplingError);
    expect(() => samplePickupDropoff([[0, 0], [1, 1]], { minGapM: 0 })).toThrow(SamplingError);
  });
});

describe("sampleOneEnd", () => {
  it("keeps the gap to the other end", () => {
    const rng = seeded(9);
    const other: LngLat = [-87.66, 41.86];
    for (let i = 0; i < 200; i++) {
      const p = sampleOneEnd(CHICAGO, other, { minGapM: 1500 }, rng);
      expect(pointInZone(p, CHICAGO)).toBe(true);
      expect(haversine(p, other)).toBeGreaterThanOrEqual(1500);
    }
  });
});

describe("closedRing", () => {
  it("closes an open ring once", () => {
    expect(closedRing([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
    expect(closedRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
  });
});
