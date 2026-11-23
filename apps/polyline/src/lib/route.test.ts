import { describe, expect, it } from "vitest";
import { roadRoute } from "./route";

describe("roadRoute", () => {
  it("returns the OSRM geometry joined to the exact points and caches it", async () => {
    let calls = 0;
    const fetchFn = (async (url: string) => {
      calls++;
      expect(url).toContain("/driving/1,2;3,4?overview=full&geometries=geojson");
      return new Response(JSON.stringify({ code: "Ok", routes: [{ geometry: { coordinates: [[1.1, 2.1], [2.9, 3.9]] } }] }));
    }) as unknown as typeof fetch;
    expect(await roadRoute([1, 2], [3, 4], fetchFn)).toEqual([[1, 2], [1.1, 2.1], [2.9, 3.9], [3, 4]]);
    await roadRoute([1, 2], [3, 4], fetchFn);
    expect(calls).toBe(1);
  });

  it("rejects when there is no route", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ code: "NoRoute", routes: [] }))) as unknown as typeof fetch;
    await expect(roadRoute([5, 6], [7, 8], fetchFn)).rejects.toThrow("NoRoute");
  });
});
