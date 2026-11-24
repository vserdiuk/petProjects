import { useState } from "react";
import { useI18n } from "../i18n/I18n";
import { pageLayout, ptToMm, type Rect } from "../lib/layout";
import type { ImageItem, Settings, Size } from "../lib/types";

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const rectStyle = (r: Rect, page: Size) => ({
  left: pct(r.x, page.width),
  top: pct(r.y, page.height),
  width: pct(r.width, page.width),
  height: pct(r.height, page.height),
});

/** Renders the pages exactly as they will be laid out in the PDF. */
export function Preview({ items, settings, target }: { items: ImageItem[]; settings: Settings; target: Size | null }) {
  const { t } = useI18n();
  const [width, setWidth] = useState(220);
  if (!items.length) return <p className="empty">{t.previewEmpty}</p>;
  return (
    <>
    <label className="zoom">
      {t.zoom}
      <input type="range" min={140} max={800} step={20} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      <small>{t.zoomHint}</small>
    </label>
    <ol className="pages" style={{ ["--page-w" as string]: `${width}px` }}>
      {items.map((it, i) => {
        const { page, box, image } = pageLayout(it, settings, target);
        // Position the picture relative to the clipping box.
        const inner = { ...image, x: image.x - box.x, y: image.y - box.y };
        return (
          <li key={it.id}>
            <div className="page" onClick={() => setWidth((w) => (w >= 600 ? 220 : 800))} style={{ aspectRatio: `${page.width} / ${page.height}`, background: settings.background }}>
              <div className="clip" style={rectStyle(box, page)}>
                <img src={it.url} alt="" style={rectStyle(inner, box)} />
              </div>
            </div>
            <div className="caption">
              {t.pageCaption(i + 1, ptToMm(page.width), ptToMm(page.height))} · <span title={it.name}>{it.name}</span>
            </div>
          </li>
        );
      })}
    </ol>
    </>
  );
}
