import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * For a literal `name` the package file `file` reads with `new URL(name, import.meta.url)` that names a path above the
 * file's folder and inside `folder`, its package's folder: the path `name` names, normalized, with its leading `../`
 * segments removed (POSIX separators), where `keel build` copies it beside `server.mjs`. Undefined for any other path.
 */
export function liftedRead(file: string, name: string, folder: string): string | undefined {
  const normal = path.posix.normalize(name);
  if (!normal.startsWith("../")) return undefined;
  const target = fileURLToPath(new URL(name, pathToFileURL(file)));
  const inPackage = path.relative(folder, target);
  if (inPackage === "" || inPackage.startsWith("..") || path.isAbsolute(inPackage)) return undefined;
  return normal.replace(/^(?:\.\.\/)+/, "");
}
