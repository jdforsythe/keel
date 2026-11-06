import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Apply a unified diff to `source` (file `path`) with `git apply` in a temp dir; returns the patched text. */
export function applyPatch(path: string, source: string, patch: string): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-check-"));
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
