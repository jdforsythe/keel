import { unwrapExpression } from "@keel/compiler/internal";
import type { Program } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { importTarget } from "./importTarget.ts";
import { parseFile } from "./parseFile.ts";

type Spanned = { readonly type: string; readonly start: number; readonly end: number };
const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/**
 * The function the import `local` of `program` (in the file at `from`) names in a relative `project` file: an
 * `export function`, an `export const` of a function, or an `export default` function. Null for a package import,
 * a re-export, or any other export.
 */
export function importedFunction(
  program: Program,
  from: string,
  local: string,
  project: readonly SourceFile[],
): { readonly program: Program; readonly start: number; readonly end: number } | null {
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration") continue;
    const sp = st.specifiers.find((s) => s.local.name === local);
    if (sp === undefined || sp.type === "ImportNamespaceSpecifier") continue;
    const file = importTarget(from, st.source.value, project);
    const parsed = file === undefined ? undefined : parseFile(file);
    if (parsed === undefined || !parsed.ok) return null;
    const name =
      sp.type === "ImportDefaultSpecifier"
        ? null
        : sp.imported.type === "Identifier"
          ? sp.imported.name
          : sp.imported.value;
    const fn = (n: Spanned) => (FUNCTIONS.has(n.type) ? { program: parsed.program, start: n.start, end: n.end } : null);
    for (const ex of parsed.program.body) {
      if (ex.type === "ExportDefaultDeclaration" && name === null) {
        const d = ex.declaration;
        if (d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration") return null;
        return fn(d.type === "FunctionDeclaration" ? d : unwrapExpression(d));
      }
      if (ex.type !== "ExportNamedDeclaration" || ex.declaration === null || name === null) continue;
      const d = ex.declaration;
      if (d.type === "FunctionDeclaration" && d.id?.name === name) return fn(d);
      if (d.type !== "VariableDeclaration") continue;
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.id.name === name && v.init !== null && v.init !== undefined)
          return fn(unwrapExpression(v.init));
    }
    return null;
  }
  return null;
}
