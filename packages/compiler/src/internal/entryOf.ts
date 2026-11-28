import fs from "node:fs";
import path from "node:path";
import { exportOf } from "./exportOf.ts";

/**
 * The real entry file of `dep` as an ESM import from `dir` sees it, with the package's real directory: the first
 * `node_modules/<dep>/package.json` in `dir` or an ancestor (no NODE_PATH, no global folders), then its export `sub`
 * (`exportOf`). Undefined when there is none.
 */
export function entryOf(dir: string, dep: string, sub = "."): [file: string, pkg: string] | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", dep);
    if (fs.existsSync(path.join(pkg, "package.json"))) return exportOf(pkg, sub);
    if (path.dirname(d) === d) return undefined;
  }
}
