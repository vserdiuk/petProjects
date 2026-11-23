import { describe, expect, it } from "vitest";
import { areSimilar, checkColumnName } from "./columns";
import { fillTemplate, memoOptions, nameOptions } from "./names";

const DEFAULTS = ["id", "contact_name", "contact_phone", "pickup.lng", "memo"];

describe("column names", () => {
  it("flags similar names", () => {
    expect(areSimilar("contact_name", "contactname")).toBe(true);
    expect(areSimilar("contact_name", "Contact.Name")).toBe(true);
    expect(areSimilar("contact_name", "contact_nme")).toBe(true);
    expect(areSimilar("memo", "memos")).toBe(true);
    expect(areSimilar("memo", "note")).toBe(false);
    expect(areSimilar("contact_name", "contact_phone")).toBe(false);
  });

  it("blocks exact duplicates, warns on similar, accepts others", () => {
    expect(checkColumnName("memo", DEFAULTS)).toEqual({ kind: "duplicate", of: "memo" });
    expect(checkColumnName(" MEMO ", DEFAULTS).kind).toBe("duplicate");
    expect(checkColumnName("contactname", DEFAULTS)).toEqual({ kind: "similar", to: ["contact_name"] });
    expect(checkColumnName("priority", DEFAULTS)).toEqual({ kind: "ok" });
    expect(checkColumnName("  ", DEFAULTS)).toEqual({ kind: "empty" });
  });
});

describe("names and memo", () => {
  it("gives distinct English names", () => {
    const names = nameOptions(5);
    expect(new Set(names).size).toBe(5);
    names.forEach((n) => expect(n).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/));
  });

  it("fills memo templates from the row", () => {
    const values = {
      contact_name: "Emma Brown",
      "pickup.address_en": "Tokyo Station",
      pickup_window_start: "2021-09-22T00:00:00+09:00",
      pickup_window_end: "2021-09-22T08:00:00+09:00",
    };
    expect(memoOptions(values)[0]).toBe(
      "I'm Emma Brown, I will be waiting for you at Tokyo Station between 2021-09-22T00:00:00+09:00 and 2021-09-22T08:00:00+09:00.",
    );
    expect(fillTemplate("{contact_name} at {x}", {})).toBe("{contact_name} at {x}");
  });
});
