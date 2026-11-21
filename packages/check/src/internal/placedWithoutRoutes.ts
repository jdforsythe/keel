import type { Topology } from "@keel/compiler";
import { stdPlacedExports } from "@keel/compiler/std/stdPlacedExports";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { lineCol } from "./lineCol.ts";

/**
 * E1586 (k.topology Rules): a module id of a deployable in `<dir>topology.ts` (`source`) whose stdlib package
 * (`stdPlacedExports`, from the project's `files` and the packages under `root`) resolves `./contract` and not
 * `./routes`, at the id's string literal in `source`. A package with neither export (a runner-only module) is none.
 * No fix: the package, not the app, is wrong.
 */
export function placedWithoutRoutes(
  dir: string,
  topology: Topology,
  source: string,
  files: readonly { path: string; source: string }[],
  root: string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const deployable of Object.values(topology))
    for (const id of deployable.modules) {
      if (seen.has(id)) continue;
      seen.add(id);
      const found = stdPlacedExports(root, id, files);
      if (found === undefined || !found.contract || found.routes) continue;
      const literal = new RegExp(`(['"\`])${id.replace(/\W/g, "\\$&")}\\1(?!\\s*:)`).exec(source);
      const { line, col } = lineCol(source, literal?.index ?? 0);
      out.push({
        kind: "diag",
        code: "E1586",
        path: `${dir}topology.ts`,
        line,
        col,
        message: `module "${id}": ${found.name} exports ./contract and no ./routes`,
        see: "k.topology",
      });
    }
  return out;
}
