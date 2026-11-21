import type { Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { memberOf } from "./memberOf.ts";
import { resolveExpr } from "./resolveExpr.ts";

/**
 * The literal `path` and `method` (upper case; `""` when not literal) of each endpoint of the `endpoints({...})`
 * declarations `schema` (a `service({ schema })` value in `file`) resolves to, through consts and relative imports into
 * `project`; an endpoint whose path is not literal is skipped.
 */
export function endpointRefs(
  schema: Expression | null | undefined,
  file: SourceFile,
  project: readonly SourceFile[],
): { readonly method: string; readonly path: string }[] {
  const at = resolveExpr(schema, file, project);
  const decls = at?.expr.type === "CallExpression" ? resolveExpr(at.expr.arguments[0], at.file, project, at.src) : at;
  if (decls === null || decls.expr.type !== "ObjectExpression") return [];
  return decls.expr.properties.flatMap((p) => {
    if (p.type !== "Property") return [];
    const entry = resolveExpr(p.value, decls.file, project, decls.src);
    const [method = "", path = ""] = ["method", "path"].map((k) => {
      const v = memberOf(entry, k, project)?.value?.expr;
      return v?.type === "Literal" && typeof v.value === "string" ? v.value : "";
    });
    return path ? [{ method: method.toUpperCase(), path }] : [];
  });
}
