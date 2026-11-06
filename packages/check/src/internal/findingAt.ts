import type { Finding } from "../types/Finding.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { lineCol } from "./lineCol.ts";

/** A finding at offset `at` of `file`, carrying rule-private `data` (offsets for the fix, names). */
export function findingAt(file: SourceFile, at: number, data?: Readonly<Record<string, string | number>>): Finding {
  const { line, col } = lineCol(file.source, at);
  return data === undefined ? { path: file.path, line, col } : { path: file.path, line, col, data };
}
