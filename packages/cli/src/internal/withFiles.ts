import type { FileScope } from "../types/FileScope.ts";
import type { Io } from "../types/Io.ts";

/** `io` with `files` filled for `scope`: given files win; else `io.load(scope)`; else none. */
export function withFiles(io: Io, scope: FileScope): Io {
  if (io.files !== undefined) return io;
  return { ...io, files: scope === "none" || io.load === undefined ? [] : io.load(scope) };
}
