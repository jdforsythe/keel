import type { Diag } from "./Diag.ts";
import { seeOf } from "./seeOf.ts";

/**
 * A log `diag` record (docs/OUTPUT.md): compact `E1554 <message>` or one NDJSON object whose `see` is the section
 * owning the code (`seeOf`), with `frames` when the record is a throw's.
 */
export function diagLine(format: "compact" | "json", d: Diag): string {
  if (format !== "json") return `${d.code} ${d.message}`;
  const at = d.frames === undefined ? {} : { frames: d.frames };
  return JSON.stringify({ kind: "diag", code: d.code, message: d.message, see: seeOf(d.code), ...at });
}
