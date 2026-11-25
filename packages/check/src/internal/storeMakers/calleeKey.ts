import type { Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { followRef } from "../followRef.ts";
import { exportedFunction } from "../functionRead/exportedFunction.ts";
import { fileOfIn } from "../functionRead/fileOfIn.ts";
import { localFunction } from "../functionRead/localFunction.ts";
import { projectLibraries } from "../projectLibraries.ts";
import { fnKeyOf } from "./fnKeyOf.ts";

/**
 * The key of the function a call's callee names, past parentheses and type wrappers: by name through imports,
 * re-exports and a library's entries, or a namespace member (`c.chart`).
 */
export function calleeKey(callee: Expression, file: SourceFile, project: readonly SourceFile[]): string | undefined {
  const fileOf = fileOfIn(project, projectLibraries.get(project)?.entries);
  let c = callee;
  while (
    c.type === "ParenthesizedExpression" ||
    c.type === "TSAsExpression" ||
    c.type === "TSSatisfiesExpression" ||
    c.type === "TSNonNullExpression"
  )
    c = c.expression;
  if (c.type === "Identifier") {
    const hit = localFunction(c.name, file, fileOf);
    return hit === undefined ? undefined : fnKeyOf(hit.file, hit.fn);
  }
  if (c.type !== "MemberExpression" || c.computed) return undefined;
  const ns = followRef(c.object, file, project);
  if (ns === null || ns === "global" || !("package" in ns) || ns.name !== "*") return undefined;
  const entry = fileOf(file, ns.package);
  const hit = entry === undefined ? undefined : exportedFunction(c.property.name, entry, fileOf);
  return hit === undefined ? undefined : fnKeyOf(hit.file, hit.fn);
}
