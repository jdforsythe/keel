import { lineCol } from "./internal/lineCol.ts";
import { routeLiterals } from "./routeLiterals.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { Topology } from "./types/Topology.ts";

/**
 * E1559 (k.topology Route table): a path served by two deployables. Reads every module's routes manifest without
 * evaluating it (`routeLiterals`); two literal paths collide when they match segment for segment, a `:param` matching
 * any other param, a trailing slash dropped as the router drops it. One E1559 per route after the first of its path
 * in another deployable, at that route's id in its `modules/<id>/routes.ts`, naming both routes. `root` is where
 * package manifests resolve from.
 */
export function pathCollisions(files: readonly SourceFile[], topology: Topology, root?: string): Diagnostic[] {
  const owner = new Map<string, string>();
  for (const [name, d] of Object.entries(topology)) for (const m of d.modules) owner.set(m, name);
  const routes = routeLiterals(files, { root })?.routes ?? {};
  const seen = new Map<string, { id: string; at: string }>();
  const out: Diagnostic[] = [];
  for (const id of Object.keys(routes).sort()) {
    const path = routes[id]?.path;
    const module = id.split(".")[0] ?? id;
    const at = owner.get(module);
    if (typeof path !== "string" || at === undefined) continue;
    const key = path.replace(/:[^/]+/g, ":").replace(/\/+$/, "");
    const first = seen.get(key);
    if (first === undefined) {
      seen.set(key, { id, at });
      continue;
    }
    if (first.at === at) continue;
    const file = `modules/${module}/routes.ts`;
    const source = files.find((f) => f.path === file)?.source ?? "";
    out.push({
      code: "E1559",
      path: file,
      ...lineCol(source, Math.max(0, source.indexOf(id))),
      message: `path ${path} is served by ${first.id} in ${first.at} and ${id} in ${at}; give one module the path`,
      see: "k.topology",
    });
  }
  return out;
}
