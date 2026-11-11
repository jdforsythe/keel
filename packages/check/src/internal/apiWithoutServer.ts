import { routeLiterals } from "@keel/compiler";
import type { Topology } from "@keel/compiler";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { clip } from "./clip.ts";
import { lineCol } from "./lineCol.ts";

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `text` parsed as JSON; undefined when it is not JSON (E1005 reports that file). */
function parsed(text: string): unknown {
  try {
    const v: unknown = JSON.parse(text);
    return v;
  } catch {
    return undefined;
  }
}

/**
 * E1511 (k.api, k.topology): an API route in a module that a `client` or `static` deployable of `topology` serves;
 * those have no server to answer it. An API route is a literal `api: true` entry of a `modules/<m>/routes.ts` among
 * `files` (paths relative to the project `dir`), or an entry with `api: true` in `evaluated`, the text of
 * `<dir>.keel/routes.json` the build writes from the evaluated manifests (an entry whose `api` is a spread, a computed
 * key or a variable has no literal). Reported at `<dir>topology.ts`, on the module id in `source` (its text) when
 * found. Package routes resolve from `root`. No fix.
 */
export function apiWithoutServer(
  dir: string,
  files: readonly SourceFile[],
  topology: Topology,
  root: string,
  source = "",
  evaluated = "",
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const ids = new Set<string>();
  for (const [id, r] of Object.entries(routeLiterals(files, { root })?.routes ?? {})) if (r.api === true) ids.add(id);
  const data = evaluated === "" ? undefined : parsed(evaluated);
  if (isRecord(data)) for (const [id, r] of Object.entries(data)) if (isRecord(r) && r.api === true) ids.add(id);
  for (const [name, d] of Object.entries(topology))
    for (const id of [...ids].sort()) {
      const m = id.split(".")[0] ?? id;
      if (d.adapter === "node" || !d.modules.includes(m)) continue;
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
