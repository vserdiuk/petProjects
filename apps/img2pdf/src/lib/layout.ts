import type { Fit, Settings, Size } from "./types";

/** CSS pixel → PDF point (96 dpi → 72 dpi). */
export const PX_TO_PT = 0.75;
export const MM_TO_PT = 72 / 25.4;
export const A4: Size = { width: 595.28, height: 841.89 };

export type Rect = { x: number; y: number; width: number; height: number };

/** Everything in PDF points, origin at the TOP-left corner of the page. */
export type PageLayout = {
  page: Size;
  /** Area inside the margins; the picture is clipped to it. */
  box: Rect;
  /** Where the picture is drawn (may extend past `box` with fit = cover). */
  image: Rect;
};

export function fitInto(box: Rect, img: Size, fit: Fit): Rect {
  if (fit === "stretch") return { ...box };
  const sx = box.width / img.width;
  const sy = box.height / img.height;
  const scale = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  const width = img.width * scale;
  const height = img.height * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

export function pageLayout(img: Size, settings: Pick<Settings, "pageMode" | "fit" | "margin">, target: Size | null): PageLayout {
  const m = Math.max(0, settings.margin) * MM_TO_PT;
  let page: Size;
  if (settings.pageMode === "a4") {
    const landscape = img.width > img.height;
    page = landscape ? { width: A4.height, height: A4.width } : { ...A4 };
  } else {
    const base = settings.pageMode === "uniform" && target ? target : img;
    page = { width: base.width * PX_TO_PT + 2 * m, height: base.height * PX_TO_PT + 2 * m };
  }
  const box: Rect = { x: m, y: m, width: Math.max(1, page.width - 2 * m), height: Math.max(1, page.height - 2 * m) };
  // In "image" mode the box already has the picture's proportions, any fit gives the same result.
  return { page, box, image: fitInto(box, img, settings.fit) };
}

export function ptToMm(pt: number): number {
  return Math.round(pt / MM_TO_PT);
}
