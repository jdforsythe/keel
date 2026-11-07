import type { Io } from "../types/Io.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import { projectFiles } from "./projectFiles.ts";
import { relPath } from "./relPath.ts";

/** A compiler artifact `keel check` verifies (E1005, k.compiler): `.keel/<name>.json` at the project root. */
const ARTIFACT = /^\.keel\/[^/]+\.json$/;

/**
 * Code files of the project, restricted to `paths` (files or directories) when any are given; with
 * `artifacts`, also the `.keel/*.json` artifacts under those paths (`keel check`, rfc:0037).
 */
export function codeFiles(io: Io, paths: readonly string[] | undefined, artifacts = false): SourceFile[] {
  const roots = (paths ?? []).map((p) => relPath(io.cwd, p).replace(/\/+$/, "")).filter((p) => p !== "" && p !== ".");
  return projectFiles(io).filter(
    (f) =>
      (CODE_FILE.test(f.path) || (artifacts && ARTIFACT.test(f.path))) &&
      (roots.length === 0 || roots.some((r) => f.path === r || f.path.startsWith(`${r}/`))),
  );
}
