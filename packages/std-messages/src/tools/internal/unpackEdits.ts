import type { Edit, Finding } from "@keel/check";

/** The edits `packEdits` stored on a finding; `null` when it carries none. */
export function unpackEdits(f: Finding): Edit[] | null {
  const out: Edit[] = [];
  for (let i = 0; ; i += 1) {
    const start = f.data?.[`s${i}`];
    const end = f.data?.[`e${i}`];
    const text = f.data?.[`t${i}`];
    if (typeof start !== "number" || typeof end !== "number" || typeof text !== "string") break;
    out.push({ start, end, text });
  }
  return out.length === 0 ? null : out;
}
