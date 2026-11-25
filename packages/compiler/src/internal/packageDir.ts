import fs from "node:fs";
import path from "node:path";

/** The directory of `node_modules/<name>` holding a `package.json`, in `dir` or an ancestor; undefined when none. */
export function packageDir(dir: string, name: string): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", name);
    if (fs.existsSync(path.join(pkg, "package.json"))) return pkg;
    if (path.dirname(d) === d) return undefined;
  }
}
