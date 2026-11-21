import path from "node:path";
import type { Program } from "oxc-parser";
import { importEdges } from "../internal/importEdges.ts";
import { parseTopology } from "../internal/parseTopology.ts";
import type { Origins } from "../types/Origins.ts";
import { declaredOrigins } from "./declaredOrigins.ts";

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
const MODULE = /^modules\/([^/]+)\//;

/**
 * Over one project's files (root-relative paths) and the text of its `topology.ts`: whether an origin is declared
 * under a directive (k.origins Rules) on each deployable that serves a file. A file is served by the deployables
 * listing its module or the module of a file that imports it by a relative value import, directly or through other
 * files; a file no module holds or imports, by every deployable. False when the topology has no deployable.
 */
export function declaredFor(
  files: readonly { readonly path: string; readonly program: Program }[],
  topologySource: string,
): (file: string, directive: keyof Origins, origin: string) => boolean {
  const topology = parseTopology(topologySource).topology;
  const { origins } = declaredOrigins(topologySource);
  const known = new Set(files.map((f) => f.path));
  const importers = new Map<string, string[]>();
  for (const f of files)
    for (const e of importEdges(f.program)) {
      if (!e.source.startsWith(".")) continue;
      const at = path.posix.join(path.posix.dirname(f.path), e.source.split("?")[0] ?? "");
      const to = EXT.map((x) => at + x).find((c) => known.has(c));
      if (to !== undefined) importers.set(to, [...(importers.get(to) ?? []), f.path]);
    }
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
