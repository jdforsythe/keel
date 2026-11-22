import fs from "node:fs";
import path from "node:path";

/**
 * The directory of the nearest `package.json` at or above `file`'s directory: the installed package a `styles` entry
 * (k.topology Declaration) belongs to, wherever it is installed. `file`'s own directory when none is found.
 */
export function packageRoot(file: string): string {
  const start = path.dirname(file);
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (path.dirname(dir) === dir) return start;
  }
}
