import { clipMessage } from "../internal/clipMessage.ts";
import { ESCAPES } from "./ESCAPES.ts";
import type { Found } from "./Found.ts";
import type { Raw } from "./Raw.ts";
import { escapeId } from "./escapeId.ts";

/** One file's raw escapes as findings at `path` (k.review Findings): the row's fields, an `id` per escape in file order. */
export function placed(path: string, raws: readonly Raw[]): Found[] {
  const seen = new Map<string, number>();
  const out: Found[] = [];
  for (const r of [...raws].sort((a, b) => a.line - b.line || a.col - b.col)) {
    const row = ESCAPES.get(r.code);
    if (row === undefined) continue;
    const norm = r.text.replace(/\s+/g, " ").trim();
    const key = `${r.code}\n${norm}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    out.push({
      code: r.code,
      path,
      line: r.line,
      col: r.col,
      message: clipMessage(r.message ?? row.message),
      protection: row.protection,
      opt: row.opt,
      danger: r.danger ?? row.danger,
      id: escapeId(r.code, path, r.text, n),
      ...(r.reason === undefined ? {} : { reason: r.reason }),
    });
  }
  return out;
}
