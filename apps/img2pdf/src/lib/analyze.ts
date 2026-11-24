import type { Size } from "./types";

type Analyzable = Size & { id: string; mime: string; size: number };

export type Issue =
  | { kind: "format"; label: string }
  | { kind: "size"; expected: Size; sameRatio: boolean }
  | { kind: "heavy"; times: number };

const LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "image/bmp": "BMP",
  "image/avif": "AVIF",
  "image/svg+xml": "SVG",
  "image/heic": "HEIC",
  "image/tiff": "TIFF",
};

export function formatLabel(mime: string): string {
  return LABELS[mime] ?? (mime.replace(/^image\//, "").toUpperCase() || "?");
}

export function sizeKey(s: Size): string {
  return `${s.width}×${s.height}`;
}

/** Most common picture size; ties go to the size that appears first. */
export function dominantSize(items: Size[]): Size | null {
  const counts = new Map<string, { size: Size; count: number }>();
  for (const it of items) {
    const key = sizeKey(it);
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { size: { width: it.width, height: it.height }, count: 1 });
  }
  let best: { size: Size; count: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best?.size ?? null;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A file counts as "heavy" if it is this many times bigger than the median… */
export const HEAVY_FACTOR = 2.5;
/** …and at least this many bytes bigger (so tiny files never trigger it). */
export const HEAVY_MIN_EXTRA = 300 * 1024;

export function sameRatio(a: Size, b: Size): boolean {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.005;
}

export function findIssues(items: Analyzable[], target: Size | null): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  const med = median(items.map((i) => i.size));
  for (const it of items) {
    const list: Issue[] = [];
    if (it.mime !== "image/png") list.push({ kind: "format", label: formatLabel(it.mime) });
    if (target && (it.width !== target.width || it.height !== target.height)) {
      list.push({ kind: "size", expected: target, sameRatio: sameRatio(it, target) });
    }
    if (items.length >= 3 && it.size > med * HEAVY_FACTOR && it.size - med > HEAVY_MIN_EXTRA) {
      list.push({ kind: "heavy", times: Math.round((it.size / med) * 10) / 10 });
    }
    out.set(it.id, list);
  }
  return out;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
/** "page2.png" < "page10.png". */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
