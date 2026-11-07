import { check } from "@keel/check";
import { artifactHashes } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import type { Diag } from "./Diag.ts";
import { projectTopology } from "./projectTopology.ts";
import { relPath } from "./relPath.ts";

/**
 * Run the k.check pipeline over `files` (the root `topology.ts` of `project` is parsed for E1004); its diagnostics
 * pass through unchanged except for project-relative paths. When a `.keel/` artifact is checked, E1005 compares it
 * with the hashes the compiler derives from every source of `project`, not only the checked ones (rfc:0050).
 */
export function runCheck(cwd: string, files: readonly SourceFile[], project: readonly SourceFile[] = files): Diag[] {
  const topology = projectTopology(project);
  const options = topology === undefined ? {} : { topology };
  const hashes = files.some((f) => f.path.startsWith(".keel/")) ? artifactHashes(project, options) : undefined;
  const found: readonly CheckDiagnostic[] = check(
    files.map((f) => ({ path: f.path, source: f.source })),
    { root: cwd, ...options, ...(hashes === undefined ? {} : { artifacts: { hashes } }) },
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
