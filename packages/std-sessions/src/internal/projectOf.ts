import path from "node:path";
import type { Io, SourceFile } from "@keel/cli";

/** `io.files` with paths relative to `io.cwd` (POSIX separators). */
export function projectOf(io: Io): SourceFile[] {
  return (io.files ?? []).map((f) => ({
    path: (path.isAbsolute(f.path) ? path.relative(io.cwd, f.path) : path.normalize(f.path)).split(path.sep).join("/"),
    source: f.source,
  }));
}
