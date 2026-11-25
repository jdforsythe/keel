import path from "node:path";
import type { Resolve } from "./Resolve.ts";

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

/**
 * A `Resolve` over the project files `known` (root-relative paths) that follows relative specifiers only: the path
 * joined to the importer's folder, then with each extension or `/index` file tried in turn. The project's own name and
 * links need the disk, so `keel check` passes its own resolver (k.bundle Aliases).
 */
export function relativeResolve(known: ReadonlySet<string>): Resolve {
  return (from, specifier) => {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
    const at = path.posix.join(path.posix.dirname(from), specifier);
    return EXT.map((e) => at + e).find((c) => known.has(c));
  };
}
