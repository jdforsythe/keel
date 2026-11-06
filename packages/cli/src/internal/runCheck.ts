import { check } from "@keel/check";
import { parseTopology } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import type { Diag } from "./Diag.ts";
import { relPath } from "./relPath.ts";

/** Run the k.check pipeline over `files` (the root `topology.ts` of `project` is parsed for E1004); its diagnostics pass through unchanged except for project-relative paths. */
export function runCheck(cwd: string, files: readonly SourceFile[], project: readonly SourceFile[] = files): Diag[] {
  const manifest = project.find((f) => f.path === "topology.ts");
  const topology = manifest === undefined ? undefined : parseTopology(manifest.source).topology;
  const found: readonly CheckDiagnostic[] = check(
    files.map((f) => ({ path: f.path, source: f.source })),
    { root: cwd, ...(topology === undefined ? {} : { topology }) },
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
