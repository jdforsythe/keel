import type { ModuleExportName, Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { importTarget } from "./importTarget.ts";
import { localNames } from "./modules/localNames.ts";
import { parseFile } from "./parseFile.ts";

const MAX_HOPS = 8;
const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);

/** Whether the export `name` of `file` is `reveal` from `@keel/schema`: `export { reveal as name }`, with or without a source, or through a file it re-exports. */
function exportsReveal(file: SourceFile, name: string, project: readonly SourceFile[], hops: number): boolean {
  const parsed = parseFile(file);
  if (hops > MAX_HOPS || !parsed.ok) return false;
  const own = localNames(parsed.program, "reveal", "@keel/schema");
  const via = (source: string, as: string): boolean => {
    const target = importTarget(file.path, source, project);
    return target !== undefined && exportsReveal(target, as, project, hops + 1);
  };
  for (const st of parsed.program.body) {
    if (st.type === "ExportAllDeclaration" && st.exported === null && via(st.source.value, name)) return true;
    if (st.type !== "ExportNamedDeclaration") continue;
    for (const sp of st.specifiers) {
      if (nameOf(sp.exported) !== name) continue;
      const local = nameOf(sp.local);
      if (
        st.source === null
          ? own.has(local)
          : st.source.value === "@keel/schema"
            ? local === "reveal"
            : via(st.source.value, local)
      )
        return true;
    }
  }
  return false;
}

/** The local names `program` (the file at `from`) imports from relative project files that export `reveal` from `@keel/schema` under that name. */
export function revealImports(program: Program, from: string, project: readonly SourceFile[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    const target = importTarget(from, st.source.value, project);
    if (target === undefined) continue;
    for (const sp of st.specifiers)
      if (
        sp.type === "ImportSpecifier" &&
        sp.importKind !== "type" &&
        exportsReveal(target, nameOf(sp.imported), project, 0)
      )
        out.add(sp.local.name);
  }
  return out;
}
