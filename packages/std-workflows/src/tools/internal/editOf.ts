import type { Edit, Finding } from "@keel/check";

/** The single edit a finding carries in `data` (`start`, `end`, `text`), or null when it has none. */
export function editOf(f: Finding): Edit[] | null {
  const { start, end, text } = f.data ?? {};
  return typeof start === "number" && typeof end === "number" && typeof text === "string"
    ? [{ start, end, text }]
    : null;
}
