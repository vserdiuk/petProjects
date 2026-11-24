export type ImageItem = {
  id: string;
  name: string;
  blob: Blob;
  /** Object URL for thumbnails/preview. Revoke when the item is dropped. */
  url: string;
  /** MIME type, e.g. "image/png". */
  mime: string;
  width: number;
  height: number;
  /** File size in bytes. */
  size: number;
  /** Edits made in the app, shown on the card (translated at render time). */
  notes: Note[];
};

export type Note =
  | { kind: "convert"; from: string }
  | { kind: "resize"; from: string; to: string }
  | { kind: "compress"; from: number; to: number };

export type Size = { width: number; height: number };

/**
 * image   – every page has the size of its own picture;
 * uniform – every page has the same size (the target size), pictures are fitted in;
 * a4      – A4 pages (orientation follows the picture), pictures are fitted in.
 */
export type PageMode = "image" | "uniform" | "a4";

/** contain – whole picture visible; cover – page filled, edges cropped; stretch – distorted to fill. */
export type Fit = "contain" | "cover" | "stretch";

export type Settings = {
  pageMode: PageMode;
  fit: Fit;
  /** Margin around the picture, millimetres. */
  margin: number;
  /** Page background, "#rrggbb". */
  background: string;
  fileName: string;
};

export const DEFAULT_SETTINGS: Settings = {
  pageMode: "uniform",
  fit: "contain",
  margin: 0,
  background: "#ffffff",
  fileName: "comic",
};
