import { describe, expect, it } from "vitest";
import { CancelledError, Geocoder, localLanguage } from "./geocode";

function fakeNominatim(fail: number[] = []) {
  const calls: { url: string; at: number }[] = [];
  let clock = 0;
  let n = 0;
  const fetch = (async (url: string) => {
    calls.push({ url, at: clock });
    const i = n++;
    if (fail.includes(i)) return new Response("", { status: 429 });
    const lang = new URL(url).searchParams.get("accept-language");
    const body = {
      display_name: lang === "en" ? "Tokyo Station, Chiyoda, Japan" : "東京駅, 千代田区, 日本",
      address: { country_code: "jp" },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  const sleep = async (ms: number) => {
    clock += ms;
  };
  return { fetch, sleep, now: () => clock, calls };
}

describe("Geocoder", () => {
  it("returns English and local names, one request per second", async () => {
    const f = fakeNominatim();
    const g = new Geocoder({ ...f, intervalMs: 1000 });
    const [a, b] = await Promise.all([g.reverse([139.7671, 35.6812]), g.reverse([139.70, 35.69])]);
    expect(a).toEqual({ en: "Tokyo Station, Chiyoda, Japan", local: "東京駅, 千代田区, 日本" });
    expect(b.en).toContain("Tokyo");
    expect(f.calls.map((c) => new URL(c.url).searchParams.get("accept-language")).sort()).toEqual(["en", "en", "ja", "ja"]);
    const times = f.calls.map((c) => c.at);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(1000);
  });

  it("caches and de-duplicates", async () => {
    const f = fakeNominatim();
    const g = new Geocoder({ ...f, intervalMs: 1000 });
    await Promise.all([g.reverse([139.7671, 35.6812]), g.reverse([139.7671, 35.6812])]);
    await g.reverse([139.767100001, 35.6812]);
    expect(f.calls).toHaveLength(2);
  });

  it("retries on 429", async () => {
    const f = fakeNominatim([0]);
    const g = new Geocoder({ ...f, intervalMs: 1000 });
    expect((await g.reverse([1, 2])).en).toContain("Tokyo");
    expect(f.calls).toHaveLength(3);
  });

  it("cancel drops queued work", async () => {
    const f = fakeNominatim();
    const g = new Geocoder({ ...f, intervalMs: 1000 });
    const p = g.reverse([1, 2]);
    g.cancel();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
    expect(g.pending).toBe(0);
  });

  it("maps countries to local languages", () => {
    expect(localLanguage("JP")).toBe("ja");
    expect(localLanguage("ua")).toBe("uk");
    expect(localLanguage("zz")).toBe("und");
  });
});
