import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { SourceFile } from "../../types/SourceFile.ts";
import { clip } from "../clip.ts";
import { lineCol } from "../lineCol.ts";

/** A k.module diagnostic at offset `at` of `file`: one-line message under 90 chars, optional fix diff. */
export function moduleDiag(code: string, file: SourceFile, at: number, message: string, fix?: string): Diagnostic {
  const { line, col } = lineCol(file.source, at);
  const base: Diagnostic = {
    kind: "diag",
    code,
    path: file.path,
    line,
    col,
    message: clip(message, 89),
    see: "k.module",
  };
  return fix === undefined ? base : { ...base, fix };
}
