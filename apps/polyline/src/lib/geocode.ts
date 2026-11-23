import type { LngLat } from "./types";

/**
 * Reverse geocoding through Nominatim (OpenStreetMap).
 * Usage policy: max 1 request per second, cache results, no heavy bulk use.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

export type Address = { en: string; local: string };

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** Main language per country (ISO 3166-1 alpha-2 → BCP 47), for the "local" address. */
const COUNTRY_LANGUAGE: Record<string, string> = {
  jp: "ja", kr: "ko", cn: "zh", tw: "zh-TW", hk: "zh-HK", th: "th", vn: "vi", id: "id", my: "ms",
  ph: "fil", in: "hi", ua: "uk", pl: "pl", de: "de", at: "de", ch: "de", fr: "fr", be: "fr",
  es: "es", mx: "es", ar: "es", co: "es", cl: "es", pe: "es", it: "it", pt: "pt", br: "pt",
  nl: "nl", cz: "cs", sk: "sk", hu: "hu", ro: "ro", bg: "bg", gr: "el", tr: "tr", il: "he",
  sa: "ar", ae: "ar", eg: "ar", ma: "ar", ru: "ru", by: "be", kz: "kk", ge: "ka", am: "hy",
  az: "az", lt: "lt", lv: "lv", ee: "et", fi: "fi", se: "sv", no: "nb", dk: "da", is: "is",
  rs: "sr", hr: "hr", si: "sl", ba: "bs", mk: "mk", al: "sq", md: "ro", ir: "fa", pk: "ur",
  bd: "bn", lk: "si", np: "ne", mm: "my", kh: "km", la: "lo", mn: "mn",
  us: "en", gb: "en", ie: "en", ca: "en", au: "en", nz: "en", za: "en", sg: "en",
};

/**
 * Accept-Language for the local name. For a country not in the table, a
 * language that has no names in OSM makes Nominatim fall back to the plain
 * `name` tags, which hold the local spelling.
 */
export function localLanguage(countryCode: string | undefined): string {
  return (countryCode && COUNTRY_LANGUAGE[countryCode.toLowerCase()]) || "und";
}

type NominatimResponse = {
  display_name?: string;
  address?: { country_code?: string };
  error?: string;
};

type Fetch = typeof fetch;
type Sleep = (ms: number) => Promise<void>;

export type GeocoderOptions = {
  fetch?: Fetch;
  sleep?: Sleep;
  now?: () => number;
  /** Minimum gap between requests, ms. */
  intervalMs?: number;
  cache?: Map<string, Address>;
};

/** Cache key: ~1 m precision. */
export const cacheKey = ([lng, lat]: LngLat) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export class Geocoder {
  private fetchFn: Fetch;
  private sleep: Sleep;
  private now: () => number;
  private intervalMs: number;
  readonly cache: Map<string, Address>;
  private inflight = new Map<string, Promise<Address>>();
  private chain: Promise<unknown> = Promise.resolve();
  private last = 0;
  private generation = 0;
  pending = 0;
  onChange: () => void = () => {};

  constructor(opts: GeocoderOptions = {}) {
    this.fetchFn = opts.fetch ?? ((...a) => fetch(...a));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
    this.intervalMs = opts.intervalMs ?? 1100;
    this.cache = opts.cache ?? new Map();
  }

  /** Drop everything still queued; queued calls reject with CancelledError. */
  cancel(): void {
    this.generation++;
  }

  reverse(point: LngLat): Promise<Address> {
    const key = cacheKey(point);
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const running = this.inflight.get(key);
    if (running) return running;

    const gen = this.generation;
    this.pending++;
    this.onChange();
    const p = (async () => {
      try {
        const en = await this.request(point, "en", gen);
        const local = en.address?.country_code
          ? await this.request(point, localLanguage(en.address.country_code), gen)
          : en;
        const result: Address = { en: en.display_name ?? "", local: local.display_name ?? "" };
        this.cache.set(key, result);
        return result;
      } finally {
        this.inflight.delete(key);
        this.pending--;
        this.onChange();
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  /** Serialised, rate-limited request with retry on 429/5xx. */
  private request(point: LngLat, lang: string, gen: number): Promise<NominatimResponse> {
    const run = async (): Promise<NominatimResponse> => {
      for (let attempt = 0; ; attempt++) {
        if (gen !== this.generation) throw new CancelledError();
        const wait = this.last + this.intervalMs - this.now();
        if (wait > 0) await this.sleep(wait);
        if (gen !== this.generation) throw new CancelledError();
        this.last = this.now();
        const url =
          `${NOMINATIM_URL}?format=jsonv2&zoom=18&addressdetails=1` +
          `&lat=${point[1]}&lon=${point[0]}&accept-language=${encodeURIComponent(lang)}`;
        const res = await this.fetchFn(url, { headers: { Accept: "application/json" } });
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          await this.sleep(2000 * (attempt + 1));
          continue;
        }
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = (await res.json()) as NominatimResponse;
        // "Unable to geocode" (e.g. open sea) is a normal empty result.
        return data.error ? {} : data;
      }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }
}

export class CancelledError extends Error {
  constructor() {
    super("Geocoding cancelled");
  }
}
