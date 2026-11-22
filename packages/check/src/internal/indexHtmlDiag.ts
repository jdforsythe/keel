import { INDEX_HTML_IGNORED } from "@keel/compiler/hosting/INDEX_HTML_IGNORED";
import type { Diagnostic } from "../types/Diagnostic.ts";

/** W1012 (k.head Document source): a project root `dir` holding `index.html`, at that file. */
export function indexHtmlDiag(dir: string): Diagnostic {
  return {
    kind: "diag",
    code: "W1012",
    path: `${dir}index.html`,
    line: 1,
    col: 1,
    message: INDEX_HTML_IGNORED,
    see: "k.head",
  };
}
