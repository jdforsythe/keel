import path from "node:path";
import type { Program } from "oxc-parser";
import { importEdges } from "./importEdges.ts";

const EXT = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs", "/index.ts", "/index.tsx", "/index.js"];

/**
 * The relative specifiers of a project's files (root-relative paths, the names on disk) that name a file of the
 * project in another case (k.bundle Names, E1010): no file has the specifier's path, one does when case is ignored.
 * Each is where, the specifier, and the name on disk.
 */
export function miscasedImports(
  files: readonly { readonly path: string; readonly program: Program }[],
  names: readonly string[] = files.map((f) => f.path),
): { path: string; start: number; source: string; disk: string }[] {
  const exact = new Set(names);
  const folded = new Map<string, string>();
  for (const n of names) folded.set(n.toLowerCase(), n);
  const out: { path: string; start: number; source: string; disk: string }[] = [];
  for (const f of files)
    for (const e of importEdges(f.program)) {
      if (!e.source.startsWith(".")) continue;
      const at = path.posix.join(path.posix.dirname(f.path), e.source.split("?")[0] ?? e.source);
      const tries = EXT.map((x) => at + x);
      if (tries.some((c) => exact.has(c))) continue;
      const disk = tries.map((c) => folded.get(c.toLowerCase())).find((d) => d !== undefined);
      if (disk !== undefined) out.push({ path: f.path, start: e.start, source: e.source, disk });
    }
  return out;
}
