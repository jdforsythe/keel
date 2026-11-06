import { check } from "@keel/check";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import type { Diag } from "./Diag.ts";
import { relPath } from "./relPath.ts";

/** Run the k.check pipeline over `files`; its diagnostics pass through unchanged except for project-relative paths. */
export function runCheck(cwd: string, files: readonly SourceFile[]): Diag[] {
  const found: readonly CheckDiagnostic[] = check(
    files.map((f) => ({ path: f.path, source: f.source })),
    {},
  ).diagnostics;
  return found.map((d) => ({
    kind: "diag",
    code: d.code,
    ...(d.path === undefined ? {} : { path: relPath(cwd, d.path) }),
    ...(d.line === undefined ? {} : { line: d.line }),
    ...(d.col === undefined ? {} : { col: d.col }),
    message: d.message,
    ...(d.fix === undefined ? {} : { fix: d.fix }),
    ...(d.see === undefined ? {} : { see: d.see }),
  }));
}
