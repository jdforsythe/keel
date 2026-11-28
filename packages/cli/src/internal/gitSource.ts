import { spawnSync } from "node:child_process";
import { isAbsolute, relative } from "node:path";

/**
 * Binary only: the manifest's `source` (k.evidence): the commit checked out at `cwd` and whether the tree differs from
 * it, the bundle directory `out` aside; null when `cwd` is not in a git work tree.
 */
export function gitSource(cwd: string, out: string): { commit: string; dirty: boolean } | null {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  const commit = head.status === 0 ? head.stdout.trim() : "";
  if (!/^[0-9a-f]{40,64}$/.test(commit)) return null;
  const rel = relative(cwd, out);
  const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  const status = spawnSync("git", ["status", "--porcelain", "--", ".", ...(inside ? [`:(exclude)${rel}`] : [])], {
    cwd,
    encoding: "utf8",
  });
  return { commit, dirty: status.status !== 0 || status.stdout.trim() !== "" };
}
