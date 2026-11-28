import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { lineCol } from "./lineCol.ts";
import { referenceDirectives } from "./referenceDirectives.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

/** A TS or JS file, declaration files included. */
const CODE = /\.[cm]?[jt]sx?$/;
/** Kernel and stdlib code and generated output, at the root: E1576's files are the others. */
const LIBRARY = /^(?:packages|node_modules|\.keel)\//;

/**
 * E1016 (k.boundary Ambient types), the directive: each `/// <reference types|path|lib|no-default-lib …/>` of a
 * project code file (E1576's files, tests and declaration files included), at its `///`. The fix deletes the line that
 * holds it. Purely textual, so it holds whether or not the type pass runs.
 */
export function typeReferences(files: readonly SourceFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const file of files) {
    if (!CODE.test(file.path) || LIBRARY.test(file.path)) continue;
    for (const { start, end } of referenceDirectives(file.source)) {
      const from = file.source.lastIndexOf("\n", start - 1) + 1;
      const eol = file.source.indexOf("\n", end);
      const to = eol < 0 ? file.source.length : eol + 1;
      out.push({
        kind: "diag",
        code: "E1016",
        path: file.path,
        ...lineCol(file.source, start),
        message: "type reference in project code; import.meta.env and import types are Keel's",
        see: "k.boundary",
        fix: unifiedDiff(file.path, file.source, file.source.slice(0, from) + file.source.slice(to)),
      });
    }
  }
  return out;
}
