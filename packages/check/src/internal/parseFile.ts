import { parseSync } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Parsed } from "./Parsed.ts";
import { langOf } from "./langOf.ts";

const memo = new Map<string, Parsed>();
const MEMO_MAX = 256;

/** Parse one file with oxc (pipeline step 1). Memoized on path and text; the AST is shared read-only. */
export function parseFile(file: SourceFile): Parsed {
  const key = `${file.path}\u0000${file.source}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const r = parseSync(file.path, file.source, { sourceType: "module", lang: langOf(file.path) });
  const parsed: Parsed = { program: r.program, ok: r.errors.length === 0 };
  if (memo.size >= MEMO_MAX) {
    const first = memo.keys().next();
    if (first.done !== true) memo.delete(first.value);
  }
  memo.set(key, parsed);
  return parsed;
}
