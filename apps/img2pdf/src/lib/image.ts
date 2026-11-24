// Browser-only helpers (canvas / Image).
import type { Fit, ImageItem, Note, Size } from "./types";
import { fitInto } from "./layout";

let seq = 0;
export const newId = () => `img-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

/** Some systems give no MIME type (or a wrong one) — sniff the first bytes. */
async function sniffMime(blob: Blob): Promise<string> {
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  if (String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return blob.type || "application/octet-stream";
}

export async function readImage(blob: Blob, name: string, notes: Note[] = []): Promise<ImageItem> {
  const url = URL.createObjectURL(blob);
  try {
    const [img, mime] = await Promise.all([decode(url), sniffMime(blob)]);
    return { id: newId(), name, blob, url, mime, width: img.naturalWidth, height: img.naturalHeight, size: blob.size, notes };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), mime, quality),
  );
}

type Render = { size?: Size; fit?: Fit; background?: string; mime: string; quality?: number };

/** Draw the picture onto a canvas (optionally at a new size) and encode it again. */
export async function render(item: ImageItem, opts: Render): Promise<Blob> {
  const img = await decode(item.url);
  const size = opts.size ?? { width: item.width, height: item.height };
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d")!;
  // JPG has no transparency; contain leaves empty bands — fill them.
  if (opts.background && (opts.mime === "image/jpeg" || opts.fit === "contain")) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  const r = fitInto({ x: 0, y: 0, ...size }, item, opts.fit ?? "stretch");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, r.x, r.y, r.width, r.height);
  return toBlob(canvas, opts.mime, opts.quality);
}

export function withExt(name: string, ext: string): string {
  return name.replace(/\.[^.]+$/, "") + "." + ext;
}
