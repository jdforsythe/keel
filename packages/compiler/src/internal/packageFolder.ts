import path from "node:path";
import type { HeldLibrary } from "./HeldLibrary.ts";

/**
 * The folder of the package a bundled package file belongs to (k.server-deps): a library's real folder, else the
 * folder its package name names under the file's last `node_modules/` folder (`node_modules/@scope/name/`).
 */
export function packageFolder(file: string, lib: HeldLibrary | undefined): string {
  if (lib !== undefined) return lib.dir;
  const parts = file.split(path.sep);
  const at = parts.lastIndexOf("node_modules");
  const scoped = parts[at + 1]?.startsWith("@") === true;
  return parts.slice(0, at + (scoped ? 3 : 2)).join(path.sep);
}
