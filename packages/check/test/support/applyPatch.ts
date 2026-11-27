import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";

/** Apply a unified diff to `source` (file `path`) with `git apply` in a temp dir; returns the patched text. */
export function applyPatch(path: string, source: string, patch: string): string {
  const dir = tempDir("keel-check-");
  try {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), source);
    writeFileSync(join(dir, "fix.patch"), `${patch}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return readFileSync(join(dir, path), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
