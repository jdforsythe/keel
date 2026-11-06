import type { Io } from "../types/Io.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import { projectFiles } from "./projectFiles.ts";
import { relPath } from "./relPath.ts";

/** Code files of the project, restricted to `paths` (files or directories) when any are given. */
export function codeFiles(io: Io, paths: readonly string[] | undefined): SourceFile[] {
  const roots = (paths ?? []).map((p) => relPath(io.cwd, p).replace(/\/+$/, "")).filter((p) => p !== "" && p !== ".");
  return projectFiles(io).filter(
    (f) =>
      CODE_FILE.test(f.path) && (roots.length === 0 || roots.some((r) => f.path === r || f.path.startsWith(`${r}/`))),
  );
}
