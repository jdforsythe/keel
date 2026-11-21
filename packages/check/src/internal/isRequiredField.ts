import type { SourceFile } from "../types/SourceFile.ts";
import type { At } from "./compat/At.ts";
import { resolveExpr } from "./compat/resolveExpr.ts";

const MAX_HOPS = 8;

/**
 * Whether the schema `at` resolves to is a required field: a chain of calls rooted at an `s` builder with no
 * `.optional()` in it, followed through consts and relative imports. `null` when that cannot be read statically.
 */
export function isRequiredField(at: At | null, project: readonly SourceFile[], hops = 0): boolean | null {
  if (at === null || hops > MAX_HOPS) return null;
  let e = at.expr;
  for (;;) {
    if (e.type !== "CallExpression" || e.callee.type !== "MemberExpression" || e.callee.computed) return null;
    if (e.callee.property.name === "optional") return false;
    const obj = e.callee.object;
    if (obj.type === "Identifier") {
      if (at.src.s.has(obj.name)) return true;
      return isRequiredField(resolveExpr(obj, at.file, project, at.src), project, hops + 1);
    }
    e = obj;
  }
}
