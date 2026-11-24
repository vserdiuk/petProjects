import { describe, expect, it } from "vitest";
import { A4, MM_TO_PT, fitInto, pageLayout } from "./layout";

const box = { x: 0, y: 0, width: 100, height: 100 };

describe("fitInto", () => {
  it("contain keeps the whole picture and centres it", () => {
    expect(fitInto(box, { width: 200, height: 100 }, "contain")).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });
  it("cover fills the box", () => {
    expect(fitInto(box, { width: 200, height: 100 }, "cover")).toEqual({ x: -50, y: 0, width: 200, height: 100 });
  });
  it("stretch uses the box as is", () => {
    expect(fitInto(box, { width: 200, height: 100 }, "stretch")).toEqual(box);
  });
});

describe("pageLayout", () => {
  const img = { width: 800, height: 1200 };

  it("image mode: page follows the picture (px → pt)", () => {
    const l = pageLayout(img, { pageMode: "image", fit: "contain", margin: 0 }, null);
    expect(l.page).toEqual({ width: 600, height: 900 });
    expect(l.image).toEqual({ x: 0, y: 0, width: 600, height: 900 });
  });

  it("uniform mode: page follows the target, picture is fitted", () => {
    const l = pageLayout({ width: 1000, height: 1000 }, { pageMode: "uniform", fit: "contain", margin: 0 }, img);
    expect(l.page).toEqual({ width: 600, height: 900 });
    expect(l.image).toEqual({ x: 0, y: 150, width: 600, height: 600 });
  });

  it("adds margins around the picture", () => {
    const l = pageLayout(img, { pageMode: "image", fit: "contain", margin: 10 }, null);
    const m = 10 * MM_TO_PT;
    expect(l.page.width).toBeCloseTo(600 + 2 * m);
    expect(l.box).toEqual({ x: m, y: m, width: 600, height: 900 });
  });

  it("a4 mode turns the page for landscape pictures", () => {
    expect(pageLayout(img, { pageMode: "a4", fit: "contain", margin: 0 }, null).page).toEqual(A4);
    expect(pageLayout({ width: 300, height: 200 }, { pageMode: "a4", fit: "contain", margin: 0 }, null).page).toEqual({
      width: A4.height,
      height: A4.width,
    });
  });
});
