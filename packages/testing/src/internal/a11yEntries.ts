import type { A11yEntry } from "@keel/compiler";

const NAMES: readonly string[] = ["label", "alt", "text", "aria", "none"];
const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;
const isName = (v: unknown): v is A11yEntry["name"] => typeof v === "string" && NAMES.includes(v);

/** The entries of `.keel/a11y.json` as the compiler writes it (`{ data, hash }`); entries of another shape are left out. */
export function a11yEntries(raw: unknown): Record<string, A11yEntry> {
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : {};
  const out: Record<string, A11yEntry> = {};
  for (const [id, e] of Object.entries(data))
    if (isRecord(e) && isName(e.name) && (typeof e.role === "string" || e.role === null) && typeof e.tag === "string")
      out[id] = { name: e.name, role: e.role, tag: e.tag };
  return out;
}
