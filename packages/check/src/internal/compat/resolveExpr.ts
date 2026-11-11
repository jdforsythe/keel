import type { Argument, Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { SchemaSource } from "../SchemaSource.ts";
import { importTarget } from "../importTarget.ts";
import { parseFile } from "../parseFile.ts";
import { schemaSourceOf } from "../schemaSourceOf.ts";
import type { At } from "./At.ts";

const MAX_HOPS = 8;

/**
 * `expr` in `file` with parentheses and `as`/`satisfies` removed and identifiers followed to their top-level `const`
 * initializer, also through named imports from relative specifiers into `project` (at most 8 bindings). `null` for a
 * spread, or an identifier that cannot be followed (a parameter, a package import).
 */
export function resolveExpr(
  expr: Argument | Expression | null | undefined,
  file: SourceFile,
  project: readonly SourceFile[],
  src: SchemaSource | null = null,
  hops = 0,
): At | null {
  if (expr === null || expr === undefined || expr.type === "SpreadElement" || hops > MAX_HOPS) return null;
  const here = src ?? schemaSourceOf(file.path, parseFile(file).program);
  if (
    expr.type === "ParenthesizedExpression" ||
    expr.type === "TSAsExpression" ||
    expr.type === "TSSatisfiesExpression"
  )
    return resolveExpr(expr.expression, file, project, here, hops);
  if (expr.type !== "Identifier") return { expr, file, src: here };
  const init = here.consts.get(expr.name);
  if (init !== undefined) return resolveExpr(init, file, project, here, hops + 1);
  const imp = here.imports.get(expr.name);
  const target = imp === undefined ? undefined : importTarget(file.path, imp.source, project);
  if (imp === undefined || target === undefined) return null;
  const there = schemaSourceOf(target.path, parseFile(target).program);
  const exported = there.consts.get(imp.name);
  return exported === undefined ? null : resolveExpr(exported, target, project, there, hops + 1);
}
