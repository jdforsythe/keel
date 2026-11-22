import type { Scope } from "./Scope.ts";
import type { Snapshot } from "./Snapshot.ts";

const DEFAULT_EXPORT = /^\s*export\s+default\b/m;
const REPO_FILES = new Set([
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "keel-review.json",
]);

/** A file of the git root the review always reads: manifests, lockfiles, CI, hooks, patches, tracked `node_modules/`. */
const isRepoFile = (p: string): boolean =>
  REPO_FILES.has(p) || /^(?:\.github|\.githooks|patches)\//.test(p) || /(?:^|\/)node_modules\//.test(p);

/**
 * The scope of a review (k.review Command): a project is a folder holding a `topology.ts` with a default export, not
 * under `modules/` or `node_modules/`. Each target (a git-root path ending `/`) chooses the deepest project holding
 * it, else every project under it. Then the git root's repository files.
 */
export function scopeOf(snap: Snapshot, targets: readonly string[]): Scope {
  const projects = snap.paths
    .filter((p) => p === "topology.ts" || p.endsWith("/topology.ts"))
    .map((p) => p.slice(0, -"topology.ts".length))
    .filter((d) => !d.split("/").some((s) => s === "modules" || s === "node_modules"))
    .filter((d) => DEFAULT_EXPORT.test(snap.text(`${d}topology.ts`) ?? ""))
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const projectOf = (p: string): string | null => projects.find((d) => p.startsWith(d)) ?? null;
  const chosen = new Set<string>();
  for (const t of targets) {
    const holding = projects.find((d) => t.startsWith(d));
    if (holding !== undefined) chosen.add(holding);
    else for (const d of projects) if (d.startsWith(t)) chosen.add(d);
  }
  const dirs = [...chosen].sort();
  return {
    projects,
    chosen: dirs,
    has: (p) => isRepoFile(p) || dirs.some((d) => p.startsWith(d)),
    projectOf,
  };
}
