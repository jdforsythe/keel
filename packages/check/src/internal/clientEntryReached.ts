import { projectDirs } from "@keel/compiler";
import { SERVER_ONLY_NAME, clientReach } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { dirPrograms } from "./dirPrograms.ts";
import { isTestPath } from "./isTestPath.ts";
import { reachResolve } from "./reachResolve.ts";
import { tokensFamily } from "./tokensFamily.ts";
import { topologyFor } from "./topologyFor.ts";
import { valueImportSites } from "./valueImportSites.ts";

const reached = new WeakMap<readonly SourceFile[], Map<string, ReadonlySet<string>>>();
const CONFIG = /\.config\.[cm]?[jt]sx?$/;

/** What the files of `dir` that `entry` names reach by value imports, re-exports and `import()`, entries included. */
function walk(dir: string, project: readonly SourceFile[], entry: (path: string) => boolean): ReadonlySet<string> {
  const files = dirPrograms(dir, project);
  const byPath = new Map(files.map((f) => [f.path, f.program]));
  const resolve = reachResolve(project, dir, new Set(byPath.keys()));
  const out = new Set<string>();
  const queue = files.map((f) => f.path).filter((p) => entry(p));
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i] ?? "";
    if (out.has(at)) continue;
    out.add(at);
    const program = byPath.get(at);
    for (const s of program === undefined ? [] : valueImportSites(program)) {
      const next = resolve(at, s.spec);
      if (next !== undefined && !SERVER_ONLY_NAME.test(next)) queue.push(next);
    }
  }
  return out;
}

/**
 * Whether a client entry reaches `path` (k.boundary Following): a route `component` or a file of a `client` module,
 * or a file one reaches by value imports, re-exports and `import()`, read from `clientReach` over its project's
 * `topology.ts` directory once per project. With no `topology.ts` every file is client code (k.boundary Reach), so
 * each code file but a server-only, test or config file and the `tokensFamily` files is an entry.
 */
export function clientEntryReached(path: string, project: readonly SourceFile[]): boolean {
  const read = topologyFor(path, project);
  const dir =
    read?.dir ?? projectDirs(project.map((f) => ({ path: f.path, source: f.source }))).find((d) => path.startsWith(d));
  if (dir === undefined) return false;
  const byDir = reached.get(project) ?? new Map<string, ReadonlySet<string>>();
  reached.set(project, byDir);
  let set = byDir.get(dir);
  if (set === undefined) {
    if (read === undefined)
      set = walk(
        dir,
        project,
        (p) => !SERVER_ONLY_NAME.test(p) && !isTestPath(p) && !CONFIG.test(p) && !tokensFamily(`${dir}${p}`, project),
      );
    else {
      const files = dirPrograms(read.dir, project);
      const resolve = reachResolve(project, read.dir, new Set(files.map((f) => f.path)));
      set = clientReach(files, read.topology, resolve).reached;
    }
    byDir.set(dir, set);
  }
  return set.has(path.slice(dir.length));
}
