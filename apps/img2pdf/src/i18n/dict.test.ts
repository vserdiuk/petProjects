import { describe, expect, it } from "vitest";
import { DICTS, guessLang } from "./dict";

describe("dictionaries", () => {
  it("every language has the same keys", () => {
    const keys = Object.keys(DICTS.uk).sort();
    for (const d of Object.values(DICTS)) expect(Object.keys(d).sort()).toEqual(keys);
  });
  it("uses the right plural forms", () => {
    expect(DICTS.uk.stats(1, "1 KB")).toBe("1 сторінка · ≈ 1 KB");
    expect(DICTS.uk.stats(3, "1 KB")).toBe("3 сторінки · ≈ 1 KB");
    expect(DICTS.uk.stats(11, "1 KB")).toBe("11 сторінок · ≈ 1 KB");
    expect(DICTS.en.stats(1, "1 KB")).toBe("1 page · ≈ 1 KB");
    expect(DICTS.en.stats(2, "1 KB")).toBe("2 pages · ≈ 1 KB");
  });
});

describe("guessLang", () => {
  it("picks the first supported browser language", () => {
    expect(guessLang(["uk-UA", "en"])).toBe("uk");
    expect(guessLang(["pl-PL", "en-US"])).toBe("en");
    expect(guessLang(["de"])).toBe("en");
  });
});
