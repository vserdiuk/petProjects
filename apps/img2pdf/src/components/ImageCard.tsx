import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef } from "react";
import { formatBytes, formatLabel, sizeKey, type Issue } from "../lib/analyze";
import type { ImageItem } from "../lib/types";

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

export function ImageCard({ item, index, total, issues, busy, ...on }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const fileRef = useRef<HTMLInputElement>(null);
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`card${isDragging ? " dragging" : ""}${issues.length ? " warn" : ""}`}>
      <div className="thumb" {...attributes} {...listeners} title="Перетягніть, щоб змінити порядок">
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
        {item.notes.length > 0 && <div className="notes">✓ {item.notes.join(", ")}</div>}
      </div>

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((is) => (
            <li key={is.kind}>
              {is.kind === "format" && (
                <>
                  <span>⚠ Формат {is.label}, а не PNG</span>
                  <button disabled={busy} onClick={on.onConvert}>Зробити PNG</button>
                </>
              )}
              {is.kind === "size" && (
                <>
                  <span>
                    ⚠ Розмір відрізняється від {sizeKey(is.expected)}
                    {!is.sameRatio && " (інші пропорції)"}
                  </span>
                  <button disabled={busy} onClick={on.onFit}>Підігнати</button>
                  <button disabled={busy} className="link" onClick={on.onMakeTarget}>Зробити основним</button>
                </>
              )}
              {is.kind === "heavy" && (
                <>
                  <span>⚠ Файл у {is.times}× важчий за інші</span>
                  <button disabled={busy} onClick={on.onOptimize}>Стиснути</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button aria-label="Перемістити раніше" title="Раніше" disabled={index === 0} onClick={() => on.onMove(index - 1)}>←</button>
        <button aria-label="Перемістити пізніше" title="Пізніше" disabled={index === total - 1} onClick={() => on.onMove(index + 1)}>→</button>
        <span className="spacer" />
        <button disabled={busy} onClick={() => fileRef.current?.click()}>Замінити</button>
        <button className="danger" onClick={on.onRemove} aria-label="Видалити" title="Видалити">✕</button>
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
