import type { Diag } from "./Diag.ts";
import { seeOf } from "./seeOf.ts";

/** A dev log `diag` record (docs/OUTPUT.md): compact `E1554 <message>` or one NDJSON object whose `see` is the section owning the code (`seeOf`). */
export function diagLine(format: "compact" | "json", d: Diag): string {
  return format === "json"
    ? JSON.stringify({ kind: "diag", code: d.code, message: d.message, see: seeOf(d.code) })
    : `${d.code} ${d.message}`;
}
