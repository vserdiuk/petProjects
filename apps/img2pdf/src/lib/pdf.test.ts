import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";
import { DEFAULT_SETTINGS } from "./types";

// 1×1 PNG
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("buildPdf", () => {
  it("creates one page per picture, in order, with the expected sizes", async () => {
    const imgs = [
      { mime: "image/png" as const, bytes: PNG, width: 400, height: 600 },
      { mime: "image/png" as const, bytes: PNG, width: 800, height: 400 },
    ];
    const bytes = await buildPdf(imgs, { ...DEFAULT_SETTINGS, pageMode: "image" }, null);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 450 });
    expect(doc.getPage(1).getSize()).toEqual({ width: 600, height: 300 });
  });

  it("uniform mode gives every page the target size", async () => {
    const imgs = [
      { mime: "image/png" as const, bytes: PNG, width: 400, height: 600 },
      { mime: "image/png" as const, bytes: PNG, width: 800, height: 400 },
    ];
    const bytes = await buildPdf(imgs, { ...DEFAULT_SETTINGS, background: "#000000" }, { width: 400, height: 600 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().map((p) => p.getSize())).toEqual([
      { width: 300, height: 450 },
      { width: 300, height: 450 },
    ]);
  });
});
