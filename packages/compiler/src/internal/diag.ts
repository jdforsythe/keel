import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Analysis } from "./Analysis.ts";
import { lineCol } from "./lineCol.ts";

/** Build a diagnostic at a source offset of `a`. `see` names the spec section. */
export function diag(a: Analysis, code: string, at: number, message: string, see: string, fix?: string): Diagnostic {
  const { line, col } = lineCol(a.source, at);
  const d: Diagnostic = { code, path: a.path, line, col, message, see };
  if (fix !== undefined) d.fix = fix;
  return d;
}
