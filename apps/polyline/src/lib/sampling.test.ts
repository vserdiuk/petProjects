import { describe, expect, it } from "vitest";
import { cumulativeLengths, distanceToLine, samplePickupDropoff, sampleOneEnd, SamplingError } from "./sampling";
import type { LngLat } from "./types";

// Deterministic RNG.
function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

const CHICAGO: LngLat[] = [
  [-87.66888275135724, 41.87275672958214],
  [-87.68055572492351, 41.84002539799995],
  [-87.64866828918457, 41.83641219781257],
  [-87.63238191604616, 41.88325319522861],
  [-87.66853942860526, 41.87224543135467],
];

describe("samplePickupDropoff", () => {
  it("keeps points within the buffer and the dropoff ≥ min gap further along", () => {
    const rng = seeded();
    for (let i = 0; i < 500; i++) {
      const { pickup, dropoff } = samplePickupDropoff(CHICAGO, { bufferM: 10, minGapM: 2000 }, rng);
      expect(distanceToLine(pickup.point, CHICAGO).distance).toBeLessThanOrEqual(10.5);
      expect(distanceToLine(dropoff.point, CHICAGO).distance).toBeLessThanOrEqual(10.5);
      expect(dropoff.along - pickup.along).toBeGreaterThanOrEqual(2000);
    }
  });

  it("fails clearly when the line is shorter than the gap", () => {
    const short: LngLat[] = [[0, 0], [0.001, 0]];
    expect(() => samplePickupDropoff(short, { bufferM: 10, minGapM: 2000 })).toThrow(SamplingError);
    expect(() => samplePickupDropoff([[0, 0]], { bufferM: 10, minGapM: 0 })).toThrow(SamplingError);
  });
});

describe("sampleOneEnd", () => {
  it("places a new dropoff after the pickup with the gap", () => {
    const rng = seeded(7);
    const total = cumulativeLengths(CHICAGO).at(-1)!;
    for (let i = 0; i < 200; i++) {
      const d = sampleOneEnd(CHICAGO, "dropoff", 1000, { bufferM: 10, minGapM: 2000 }, rng);
      expect(d.along).toBeGreaterThanOrEqual(3000);
      expect(d.along).toBeLessThanOrEqual(total);
    }
  });

  it("fails when there is no room", () => {
    expect(() => sampleOneEnd(CHICAGO, "pickup", 500, { bufferM: 10, minGapM: 2000 })).toThrow(SamplingError);
  });
});
