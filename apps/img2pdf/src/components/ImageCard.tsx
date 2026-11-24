import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef } from "react";
import { useI18n } from "../i18n/I18n";
import type { Dict } from "../i18n/dict";
import { formatBytes, formatLabel, sizeKey, type Issue } from "../lib/analyze";
import type { ImageItem, Note } from "../lib/types";

type Props = {
  item: ImageItem;
  index: number;
  total: number;
  issues: Issue[];
  busy: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
  onReplace: (file: File) => void;
  onConvert: () => void;
  onFit: () => void;
  onMakeTarget: () => void;
  onOptimize: () => void;
  onOpen: () => void;
};

export function noteText(t: Dict, n: Note): string {
  if (n.kind === "convert") return t.noteConvert(n.from);
  if (n.kind === "resize") return t.noteResize(n.from, n.to);
  return t.noteCompress(formatBytes(n.from), formatBytes(n.to));
}

export function ImageCard({ item, index, total, issues, busy, ...on }: Props) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const fileRef = useRef<HTMLInputElement>(null);
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`card${isDragging ? " dragging" : ""}${issues.length ? " warn" : ""}`}>
      <div className="thumb" {...attributes} {...listeners} title={t.dragHint}>
        <span className="num">{index + 1}</span>
        <img src={item.url} alt={item.name} draggable={false} onClick={on.onOpen} />
      </div>

      <div className="meta">
        <div className="name" title={item.name}>{item.name}</div>
        <div className="facts">
          <span className={`fmt${item.mime === "image/png" ? "" : " bad"}`}>{formatLabel(item.mime)}</span>
          <span className={issues.some((i) => i.kind === "size") ? "bad" : ""}>{sizeKey(item)}</span>
          <span className={issues.some((i) => i.kind === "heavy") ? "bad" : ""}>{formatBytes(item.size)}</span>
        </div>
        {item.notes.length > 0 && <div className="notes">✓ {item.notes.map((n) => noteText(t, n)).join(", ")}</div>}
      </div>

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((is) => (
            <li key={is.kind}>
              {is.kind === "format" && (
                <>
                  <span>⚠ {t.issueFormat(is.label)}</span>
                  <button disabled={busy} onClick={on.onConvert}>{t.makePng}</button>
                </>
              )}
              {is.kind === "size" && (
                <>
                  <span>
                    ⚠ {t.issueSize(sizeKey(is.expected))}
                    {!is.sameRatio && ` ${t.otherRatio}`}
                  </span>
                  <button disabled={busy} onClick={on.onFit}>{t.fit}</button>
                  <button disabled={busy} className="link" onClick={on.onMakeTarget}>{t.makeMain}</button>
                </>
              )}
              {is.kind === "heavy" && (
                <>
                  <span>⚠ {t.issueHeavy(is.times)}</span>
                  <button disabled={busy} onClick={on.onOptimize}>{t.compress}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button aria-label={t.earlier} title={t.earlier} disabled={index === 0} onClick={() => on.onMove(index - 1)}>←</button>
        <button aria-label={t.later} title={t.later} disabled={index === total - 1} onClick={() => on.onMove(index + 1)}>→</button>
        <span className="spacer" />
        <button disabled={busy} onClick={() => fileRef.current?.click()}>{t.replace}</button>
        <button className="danger" onClick={on.onRemove} aria-label={t.remove} title={t.remove}>✕</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) on.onReplace(f);
            e.target.value = "";
          }}
        />
      </div>
    </li>
  );
}
