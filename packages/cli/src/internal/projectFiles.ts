import type { Io } from "../types/Io.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { relPath } from "./relPath.ts";

/** `io.files` with project-relative paths, sorted by path so equal input gives equal output. */
export function projectFiles(io: Io): SourceFile[] {
  return (io.files ?? [])
    .map((f) => ({ path: relPath(io.cwd, f.path), source: f.source }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
