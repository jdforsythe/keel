import type { Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { memberOf } from "../compat/memberOf.ts";
import { resolveExpr } from "../compat/resolveExpr.ts";

/**
 * The literal `path` of each endpoint in the `endpoints({...})` declarations `schema` (a `service({ schema })` value
 * in `file`) resolves to, through consts and relative imports into `project`; none when not literal.
 */
export function endpointPaths(schema: Expression | null, file: SourceFile, project: readonly SourceFile[]): string[] {
  const at = resolveExpr(schema, file, project);
  const decls = at?.expr.type === "CallExpression" ? resolveExpr(at.expr.arguments[0], at.file, project, at.src) : at;
  if (decls === null || decls.expr.type !== "ObjectExpression") return [];
  return decls.expr.properties.flatMap((p) => {
    if (p.type !== "Property") return [];
    const v = memberOf(resolveExpr(p.value, decls.file, project, decls.src), "path", project)?.value?.expr;
    return v?.type === "Literal" && typeof v.value === "string" ? [v.value] : [];
  });
}
