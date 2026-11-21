import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";

/** A diagnostic `code` at offset `at` of `file`, its message clipped to one line under 90 chars. */
export function diagAt(file: SourceFile, at: number, code: string, message: string, see: string): Diagnostic {
  const { line, col } = lineCol(file.source, at);
  return { kind: "diag", code, path: file.path, line, col, message: clip(message, 89), see };
}
