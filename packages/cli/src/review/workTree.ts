import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { GitRepo } from "./GitRepo.ts";
import type { Snapshot } from "./Snapshot.ts";

/** Folders a walk outside git never enters. */
const SKIP = new Set([".git", "node_modules"]);

/**
 * Binary only: the working tree as a snapshot (k.review `--all`): in git, the tracked and untracked unignored files;
 * outside git, every file under `root` but `.git/` and `node_modules/`. Text is read on demand and kept.
 */
export function workTree(root: string, repo: GitRepo | null): Snapshot {
  const paths: string[] = [];
  if (repo !== null) paths.push(...repo.files());
  else {
    const walk = (dir: string, rel: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const r = rel === "" ? e.name : `${rel}/${e.name}`;
        if (e.isDirectory() && !SKIP.has(e.name)) walk(join(dir, e.name), r);
        else if (e.isFile()) paths.push(r);
      }
    };
    walk(root, "");
  }
  const cache = new Map<string, string | undefined>();
  return {
    paths: paths.sort(),
    prefetch: () => {},
    text: (p) => {
      if (cache.has(p)) return cache.get(p);
      let t: string | undefined;
      try {
        t = readFileSync(join(root, p), "utf8");
      } catch {
        t = undefined;
      }
      cache.set(p, t);
      return t;
    },
  };
}
