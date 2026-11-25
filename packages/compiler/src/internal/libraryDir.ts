import path from "node:path";
import { libraryKind } from "../std/libraryKind.ts";
import { packageDir } from "./packageDir.ts";
import { readJson } from "./readJson.ts";

/**
 * The directory of library `name` as an import from `dir` finds it (`node_modules/<name>` in `dir` or an ancestor), when
 * the package found there is a library (`libraryKind`); undefined for a name that does not begin with `@`, a package not
 * found, or a package of another kind.
 */
export function libraryDir(dir: string, name: string): string | undefined {
  if (!name.startsWith("@")) return undefined;
  const pkg = packageDir(dir, name);
  return pkg !== undefined && libraryKind(readJson(path.join(pkg, "package.json")), name) !== undefined
    ? pkg
    : undefined;
}
