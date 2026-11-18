import { parseTopology } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";

type Read = { readonly dir: string; readonly topology: Topology | undefined };

const reads = new WeakMap<readonly SourceFile[], Map<string, Read>>();

/** The deepest `topology.ts` of `project` whose directory holds `path`, parsed once per project. */
function topologyFor(path: string, project: readonly SourceFile[]): Read | undefined {
  const byDir = reads.get(project) ?? new Map<string, Read>();
  reads.set(project, byDir);
  let best: SourceFile | undefined;
  for (const f of project) {
    if (f.path !== "topology.ts" && !f.path.endsWith("/topology.ts")) continue;
    const dir = f.path.slice(0, -"topology.ts".length);
    if (path.startsWith(dir) && (best === undefined || f.path.length > best.path.length)) best = f;
  }
  if (best === undefined) return undefined;
  const hit = byDir.get(best.path);
  if (hit !== undefined) return hit;
  const read = { dir: best.path.slice(0, -"topology.ts".length), topology: parseTopology(best.source).topology };
  byDir.set(best.path, read);
  return read;
}

/**
 * A file the browser can load (k.host Node globals): not named `*.server.*`, and, with a `topology.ts` in its
 * project, under `modules/<id>/` of a module a deployable lists, except the `routes.ts` of a module no `client` or
 * `static` deployable lists. With no `topology.ts`, every file not named `*.server.*`.
 */
export function isBrowserFile(path: string, project: readonly SourceFile[]): boolean {
  if (/\.server\.[cm]?[jt]sx?$/.test(path)) return false;
  const read = topologyFor(path, project);
  if (read === undefined) return true;
  const m = /^modules\/([^/]+)\/(.+)$/.exec(path.slice(read.dir.length));
  if (m === null) return false;
  const [, id = "", rest = ""] = m;
  const listing = Object.values(read.topology ?? {}).filter((d) => d.modules.includes(id));
  if (listing.length === 0) return false;
  return rest !== "routes.ts" || listing.some((d) => d.adapter !== "node");
}
