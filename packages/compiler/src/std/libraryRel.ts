import path from "node:path";
import type { Library } from "../types/Library.ts";

/** Each library's folder, absolute, ending in the separator. */
const folders = new WeakMap<Library, string>();
const folderOf = (lib: Library): string => {
  let dir = folders.get(lib);
  if (dir === undefined) {
    const at = path.resolve(lib.dir);
    dir = at.endsWith(path.sep) ? at : `${at}${path.sep}`;
    folders.set(lib, dir);
  }
  return dir;
};

/**
 * The path the compiler reads file `file` (absolute, real) at when it lies under `src/` or `unsafe/` of one of
 * `libraries`: `modules/<id>/<f>`, `<f>` its path in the library's folder and `<id>` the library's manifest `id`, else
 * its package name (k.library In an app). Undefined for any other file.
 */
export function libraryRel(libraries: readonly Library[], file: string): string | undefined {
  const abs = path.resolve(file);
  for (const lib of libraries) {
    const dir = folderOf(lib);
    if (!abs.startsWith(dir)) continue;
    const posix = abs.slice(dir.length).split(path.sep).join("/");
    if (posix.startsWith("src/") || posix.startsWith("unsafe/")) return `modules/${lib.id ?? lib.name}/${posix}`;
  }
  return undefined;
}
