import type { SourceFile } from "@keel/check";
import { manifestDeps } from "./manifestDeps.ts";

const MANIFEST = "module.ts";
const depsMemo = new WeakMap<SourceFile, readonly string[]>();

function depsOf(manifest: SourceFile): readonly string[] {
  const hit = depsMemo.get(manifest);
  if (hit !== undefined) return hit;
  const deps = manifestDeps(manifest.source);
  depsMemo.set(manifest, deps);
  return deps;
}

/**
 * Whether the module holding `path` lists `pkg` in its `deps` (k.module). The module is the `module.ts` in `project`
 * whose directory is the longest prefix of `path`; a file outside every module depends on nothing.
 */
export function dependsOn(path: string, project: readonly SourceFile[], pkg: string): boolean {
  let best: SourceFile | undefined;
  for (const f of project) {
    if (f.path !== MANIFEST && !f.path.endsWith(`/${MANIFEST}`)) continue;
    const root = f.path.slice(0, f.path.length - MANIFEST.length);
    if (path.startsWith(root) && (best === undefined || f.path.length > best.path.length)) best = f;
  }
  return best !== undefined && depsOf(best).includes(pkg);
}
