import { useEffect, useRef, useState } from "react";
import { checkColumnName } from "../lib/columns";

type Props = {
  name: string;
  others: readonly string[];
  autoFocus?: boolean;
  onRename: (next: string) => void;
  onRemove: () => void;
};

/** Editable header of a custom column. Similar names are highlighted; exact duplicates cannot be saved. */
export function ColumnHeader({ name, others, autoFocus, onRename, onRemove }: Props) {
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);

  const check = checkColumnName(draft, others);
  const blocked = check.kind === "duplicate" || check.kind === "empty";
  const message =
    check.kind === "duplicate"
      ? `Column "${check.of}" already exists`
      : check.kind === "empty"
        ? "Column name cannot be empty"
        : check.kind === "similar"
          ? `Similar to: ${check.to.join(", ")}`
          : undefined;

  const commit = () => {
    if (blocked) setDraft(name);
    else if (draft.trim() !== name) onRename(draft.trim());
  };

  return (
    <th className={`custom ${check.kind === "similar" ? "warn" : ""} ${blocked ? "bad" : ""}`} title={message}>
      <div className="col-head">
        <input
          ref={ref}
          aria-label="Column name"
          aria-invalid={blocked}
          value={draft}
          size={Math.max(8, draft.length + 1)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(name);
              requestAnimationFrame(() => ref.current?.blur());
            }
          }}
        />
        <button type="button" title="Remove column" onClick={onRemove}>
          ✕
        </button>
      </div>
      {message && <div className={`col-msg ${blocked ? "bad" : "warn"}`}>{message}</div>}
    </th>
  );
}
