import type { Edit, Finding } from "@keel/check";

/** The edit a finding carries in `data` (see `findingsOf`); `null` when it has none. */
export function editOf(f: Finding): Edit[] | null {
  const start = f.data?.start;
  const end = f.data?.end;
  const text = f.data?.text;
  return typeof start === "number" && typeof end === "number" && typeof text === "string"
    ? [{ start, end, text }]
    : null;
}
