import type { Program } from "oxc-parser";
import type { Resolve } from "../internal/Resolve.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import { reachEdges } from "../internal/reachEdges.ts";
import { relativeResolve } from "../internal/relativeResolve.ts";
import type { Origins } from "../types/Origins.ts";
import { declaredOrigins } from "./declaredOrigins.ts";

const MODULE = /^modules\/([^/]+)\//;

/**
 * Over one project's files (root-relative paths) and the text of its `topology.ts`: whether an origin is declared
 * under a directive (k.origins Rules) on each deployable that serves a file. A file is served by the deployables
 * listing its module or the module of a file that imports it, directly or through other files, each edge one reach
 * follows (`reachEdges` with `resolve`, k.boundary Following; relative specifiers only when absent); a file no module
 * holds or imports, by every deployable. False when the topology has no deployable.
 */
export function declaredFor(
  files: readonly { readonly path: string; readonly program: Program }[],
  topologySource: string,
  resolve?: Resolve,
): (file: string, directive: keyof Origins, origin: string) => boolean {
  const topology = parseTopology(topologySource).topology;
  const { origins } = declaredOrigins(topologySource);
  const known = new Set(files.map((f) => f.path));
  const follow = resolve ?? relativeResolve(known);
  const importers = new Map<string, string[]>();
  for (const f of files)
    for (const e of reachEdges(f.path, f.program, follow, known))
      for (const to of e.files) importers.set(to, [...(importers.get(to) ?? []), f.path]);
  const names = Object.keys(topology);
  return (file, directive, origin) => {
    const modules = new Set<string>();
    const seen = new Set([file]);
    for (const p of seen) {
      const m = MODULE.exec(p)?.[1];
      if (m !== undefined) modules.add(m);
      for (const q of importers.get(p) ?? []) seen.add(q);
    }
    const serving = names.filter((n) => topology[n]?.modules.some((m) => modules.has(m)));
    const each = serving.length > 0 ? serving : names;
    return each.length > 0 && each.every((n) => Object.hasOwn(origins[n]?.[directive] ?? {}, origin));
  };
}
