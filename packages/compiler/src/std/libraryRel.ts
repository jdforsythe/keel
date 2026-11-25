import path from "node:path";
import type { Library } from "../types/Library.ts";

/**
 * The path the compiler reads file `file` (absolute, real) at when it lies under `src/` or `unsafe/` of one of
 * `libraries`: `modules/<id>/<f>`, `<f>` its path in the library's folder and `<id>` the library's manifest `id`, else
 * its package name (k.library In an app). Undefined for any other file.
 */
export function libraryRel(libraries: readonly Library[], file: string): string | undefined {
  for (const lib of libraries) {
    const rel = path.relative(lib.dir, file);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    const posix = rel.split(path.sep).join("/");
    if (posix.startsWith("src/") || posix.startsWith("unsafe/")) return `modules/${lib.id ?? lib.name}/${posix}`;
  }
  return undefined;
}
