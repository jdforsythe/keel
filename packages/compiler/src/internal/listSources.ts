import fs from "node:fs";
import path from "node:path";

const SKIP: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "coverage",
  "reports",
  "test",
  "tests",
  "conformance",
]);
const CODE = /\.[cm]?[jt]sx?$/;
const NOT_APP = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;

/** Root-relative (`/`-separated, sorted) app code files under `root`: no tests or test dirs, declarations, dot or build dirs. */
export function listSources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && CODE.test(e.name) && !NOT_APP.test(e.name))
        out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}
