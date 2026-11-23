/** Lower-case and drop separators: "Contact_Name" and "contact.name" both become "contactname". */
export function normalizeColumn(name: string): string {
  return name.toLowerCase().replace(/[\s._\-/]+/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Similar = same after normalisation, or 1–2 edits apart (1 for short names). */
export function areSimilar(a: string, b: string): boolean {
  const na = normalizeColumn(a);
  const nb = normalizeColumn(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const maxEdits = Math.min(na.length, nb.length) < 6 ? 1 : 2;
  return levenshtein(na, nb) <= maxEdits;
}

export type ColumnCheck =
  | { kind: "ok" }
  | { kind: "empty" }
  | { kind: "duplicate"; of: string }
  | { kind: "similar"; to: string[] };

/** Check a column name against the other columns. Duplicates are exact matches, ignoring case and outer spaces. */
export function checkColumnName(name: string, others: readonly string[]): ColumnCheck {
  const trimmed = name.trim();
  if (!trimmed) return { kind: "empty" };
  const dup = others.find((o) => o.trim().toLowerCase() === trimmed.toLowerCase());
  if (dup) return { kind: "duplicate", of: dup };
  const similar = others.filter((o) => areSimilar(o, trimmed));
  return similar.length ? { kind: "similar", to: similar } : { kind: "ok" };
}
