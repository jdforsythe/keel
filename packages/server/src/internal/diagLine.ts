import type { Diag } from "./Diag.ts";

/** A dev log `diag` record (docs/OUTPUT.md): compact `E1554 <message>` or one NDJSON object. */
export function diagLine(format: "compact" | "json", d: Diag): string {
  return format === "json"
    ? JSON.stringify({ kind: "diag", code: d.code, message: d.message, see: "k.server" })
    : `${d.code} ${d.message}`;
}
