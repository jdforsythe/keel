import type { Argument, Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { followValue } from "./followValue.ts";

/**
 * The statically known text a URL expression starts with, or null: a string literal, a `const` bound to one (through
 * imports), a template literal's head (its first substitution's when the head is empty), the left side of `+`, and
 * `new URL(path, base)` (the base unless `path` is itself absolute) or `new Request(url)`.
 */
export function urlText(
  expr: Expression | Argument | undefined,
  file: SourceFile,
  project: readonly SourceFile[],
  depth = 0,
): string | null {
  if (expr === undefined || expr.type === "SpreadElement" || depth > 8) return null;
  const at = followValue(expr, file, project);
  if (at === null || typeof at === "string") return null;
  const e = at.expr;
  const next = (x: Expression | Argument | undefined): string | null => urlText(x, at.file, project, depth + 1);
  if (e.type === "Literal") return typeof e.value === "string" ? e.value : null;
  if (e.type === "TemplateLiteral") {
    const head = e.quasis[0]?.value.cooked ?? "";
    return head === "" && e.expressions.length > 0 ? next(e.expressions[0]) : head;
  }
  if (e.type === "BinaryExpression" && e.operator === "+") return next(e.left);
  if (e.type !== "NewExpression" || e.callee.type !== "Identifier") return null;
  if (e.callee.name === "Request") return next(e.arguments[0]);
  if (e.callee.name !== "URL") return null;
  const path = next(e.arguments[0]);
  return path !== null && /^[a-z][a-z0-9+.-]*:|^\/\//i.test(path) ? path : next(e.arguments[1]);
}
