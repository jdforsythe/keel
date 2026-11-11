// Where mutation runs keep what the next run reuses, and how a test file is named inside it.
// The home is `<git common dir>/keel-mutation`: every worktree of a clone shares it and CI caches that one directory.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The shared cache directory; `.stryker-tmp` under `cwd` when `cwd` is outside a git repository. */
export function mutateCacheDir(cwd: string = process.cwd()): string {
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path.join(path.resolve(cwd, common), "keel-mutation");
  } catch {
    return path.join(cwd, ".stryker-tmp");
  }
}

/** A test file's path relative to its package, whether it runs from the package or from a Stryker sandbox copy. */
export function packageRelative(file: string, cwd: string = process.cwd()): string {
  const inSandbox = /^.*\/\.stryker-tmp\/sandbox-[^/]+\//.exec(file);
  if (inSandbox) return file.slice(inSandbox[0].length);
  return path.isAbsolute(file) ? path.relative(cwd, file) : file;
}

/** Milliseconds per test file from the last dry run; empty when none was recorded. */
export function readTimes(file: string | undefined): Record<string, number> {
  if (!file) return {};
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    const out: Record<string, number> = {};
    if (typeof raw === "object" && raw !== null)
      for (const [k, v] of Object.entries(raw)) if (typeof v === "number") out[k] = v;
    return out;
  } catch {
    return {};
  }
}
