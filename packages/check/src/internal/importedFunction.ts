import { unwrapExpression } from "@keel/compiler/internal";
import type { ExportNamedDeclaration, ModuleExportName, Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { importTarget } from "./importTarget.ts";
import { parseFile } from "./parseFile.ts";

type Spanned = { readonly type: string; readonly start: number; readonly end: number };
type Found = { readonly file: SourceFile; readonly program: Program; readonly start: number; readonly end: number };
const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);
const MAX_HOPS = 8;
const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);

/** The function the export `name` (`default` for the default export) of `file` is, followed through re-exports. */
function exportedFunction(file: SourceFile, name: string, project: readonly SourceFile[], hops: number): Found | null {
  const parsed = parseFile(file);
  if (hops > MAX_HOPS || !parsed.ok) return null;
  const { program } = parsed;
  const fn = (n: Spanned): Found | null =>
    FUNCTIONS.has(n.type) ? { file, program, start: n.start, end: n.end } : null;
  const via = (source: string, as: string): Found | null => {
    const target = importTarget(file.path, source, project);
    return target === undefined ? null : exportedFunction(target, as, project, hops + 1);
  };
  /** A top-level binding `local` of the file: a function, a const function, or an import followed to its file. */
  const local = (id: string): Found | null => {
    for (const st of program.body) {
      if (st.type === "ImportDeclaration") {
        const sp = st.specifiers.find((s) => s.local.name === id);
        if (sp === undefined || sp.type === "ImportNamespaceSpecifier") continue;
        return via(st.source.value, sp.type === "ImportDefaultSpecifier" ? "default" : nameOf(sp.imported));
      }
      const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (d?.type === "FunctionDeclaration" && d.id?.name === id) return fn(d);
      if (d?.type === "VariableDeclaration")
        for (const v of d.declarations)
          if (v.id.type === "Identifier" && v.id.name === id && v.init !== null && v.init !== undefined)
            return fn(unwrapExpression(v.init));
    }
    return null;
  };
  const listed = (ex: ExportNamedDeclaration): Found | null => {
    for (const sp of ex.specifiers) {
      if (nameOf(sp.exported) !== name) continue;
      return ex.source === null ? local(nameOf(sp.local)) : via(ex.source.value, nameOf(sp.local));
    }
    return null;
  };
  for (const ex of program.body) {
    if (ex.type === "ExportDefaultDeclaration" && name === "default") {
      const d = ex.declaration;
      if (d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration") return null;
      return fn(d.type === "FunctionDeclaration" ? d : unwrapExpression(d));
    }
    if (ex.type === "ExportAllDeclaration" && ex.exported === null && name !== "default") {
      const hit = via(ex.source.value, name);
      if (hit !== null) return hit;
    }
    if (ex.type !== "ExportNamedDeclaration") continue;
    const d = ex.declaration;
    if (d === null) {
      const hit = listed(ex);
      if (hit !== null) return hit;
    } else if (d.type === "FunctionDeclaration" && d.id?.name === name) return fn(d);
    else if (d.type === "VariableDeclaration")
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.id.name === name && v.init !== null && v.init !== undefined)
          return fn(unwrapExpression(v.init));
  }
  return null;
}

/**
 * The function the import `local` of `program` (in the file at `from`) names in a relative `project` file: an
 * `export function`, an `export const` of a function, an `export default` function, or one of those a file re-exports
 * (`export { f } from`, `export { f as g }`, `export *`). Null for a package import or any other export.
 */
export function importedFunction(
  program: Program,
  from: string,
  local: string,
  project: readonly SourceFile[],
): Found | null {
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    const sp = st.specifiers.find((s) => s.local.name === local);
    if (sp === undefined || sp.type === "ImportNamespaceSpecifier") continue;
    const file = importTarget(from, st.source.value, project);
    if (file === undefined) return null;
    return exportedFunction(file, sp.type === "ImportDefaultSpecifier" ? "default" : nameOf(sp.imported), project, 0);
  }
  return null;
}
