import fs from "node:fs";
import path from "node:path";
import { isSourcePath } from "./isSourcePath.ts";

/**
 * Root-relative (`/`-separated, sorted) app code files under `root` (`isSourcePath`). A directory is walked only
 * when a module directly inside it could be a source, so skipped trees such as `node_modules` are never read.
 */
export function listSources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join("/");
      if (e.isDirectory()) {
        if (isSourcePath(`${rel}/index.ts`)) walk(path.join(dir, e.name));
      } else if (e.isFile() && isSourcePath(rel)) out.push(rel);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}
