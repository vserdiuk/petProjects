import { PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb } from "pdf-lib";
import { pageLayout } from "./layout";
import type { Settings, Size } from "./types";

export type PdfImage = Size & { mime: "image/png" | "image/jpeg"; bytes: Uint8Array | ArrayBuffer };

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildPdf(images: PdfImage[], settings: Settings, target: Size | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(settings.fileName || "images");
  doc.setCreator("Pet projects · Images → PDF");
  const isWhite = /^#?f{6}$/i.test(settings.background.trim());

  for (const img of images) {
    const embedded = img.mime === "image/png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const { page: size, box, image } = pageLayout(img, settings, target);
    const page = doc.addPage([size.width, size.height]);
    const H = size.height; // pdf-lib uses a bottom-left origin
    if (!isWhite) page.drawRectangle({ x: 0, y: 0, width: size.width, height: H, color: hexToRgb(settings.background) });
    page.pushOperators(pushGraphicsState(), rectangle(box.x, H - box.y - box.height, box.width, box.height), clip(), endPath());
    page.drawImage(embedded, { x: image.x, y: H - image.y - image.height, width: image.width, height: image.height });
    page.pushOperators(popGraphicsState());
  }
  return doc.save();
}
