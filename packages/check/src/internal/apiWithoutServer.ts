import { routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1511 (k.api, k.topology): an API route (a literal `api: true` entry of a `modules/<m>/routes.ts` among `files`,
 * paths relative to the project `dir`) in a module that a `client` or `static` deployable of `topology` serves; those
 * have no server to answer it. Reported at `<dir>topology.ts`, on the module id in `source` (its text) when found.
 * Package routes resolve from `root`. No fix.
 */
export function apiWithoutServer(
  dir: string,
  files: readonly SourceFile[],
  topology: Topology,
  root: string,
  source = "",
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const table = Object.entries(routeLiterals(files, { root })?.routes ?? {});
  for (const [name, d] of Object.entries(topology))
    for (const [id, r] of table) {
      const m = id.split(".")[0] ?? id;
      if (d.adapter === "node" || r.api !== true || !d.modules.includes(m)) continue;
      const { line, col } = lineCol(source, Math.max(0, source.search(new RegExp(`["'\`]${m}["'\`]`))));
      const message = `${id}: API route in ${d.adapter} deployable ${name}, which has no server`;
      out.push({
        kind: "diag",
        code: "E1511",
        path: `${dir}topology.ts`,
        line,
        col,
        message: clip(message, 89),
        see: "k.api",
      });
    }
  return out;
}
