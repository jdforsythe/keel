// Reads a real module of the repository as project files (not a test file). Public API only.
import { type Dirent, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Files } from "./support.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Every `.ts` and `.tsx` file under `dir` of the repository, as project files rooted at `at`. */
export function realFiles(dir: string, at: string): Files {
  const out: Files[number][] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(ROOT, dir, rel), { withFileTypes: true }) as Dirent[]) {
      const next = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(e.name))
        out.push({ path: `${at}/${next}`, source: readFileSync(join(ROOT, dir, next), "utf8") });
    }
  };
  walk("");
  return out;
}
