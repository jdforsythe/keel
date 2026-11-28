import type { Diag } from "./Diag.ts";
import { seeOf } from "./seeOf.ts";
import { written } from "./written.ts";

/**
 * A log `diag` record (docs/OUTPUT.md): compact `E1554 <message>` or one NDJSON object whose `see` is the record's own or the
 * section owning the code (`seeOf`), with `frames` when the record is a throw's. The message is `written` to 2,048 characters
 * and each frame to 256 (k.serverlog).
 */
export function diagLine(format: "compact" | "json", d: Diag): string {
  const message = written(d.message, 2048);
  if (format !== "json") return `${d.code} ${message}`;
  const at = d.frames === undefined ? {} : { frames: d.frames.map((f) => written(f, 256)) };
  return JSON.stringify({ kind: "diag", code: d.code, message, see: d.see ?? seeOf(d.code), ...at });
}
