import type { SourceFile } from "../../types/SourceFile.ts";
import type { At } from "./At.ts";
import type { Spot } from "./Spot.ts";
import { memberOf } from "./memberOf.ts";
import { resolveExpr } from "./resolveExpr.ts";

/** The first argument of `<x>.<factory>(arg)` (`s.object`, `s.array`, `s.record`), past `.optional()`/`.nullable()`. */
function argOf(at: At | null, factory: string, project: readonly SourceFile[]): At | null {
  let cur = at;
  while (cur !== null && cur.expr.type === "CallExpression" && cur.expr.callee.type === "MemberExpression") {
    const callee = cur.expr.callee;
    const name = !callee.computed && callee.property.type === "Identifier" ? callee.property.name : "";
    if (name === factory) return resolveExpr(cur.expr.arguments[0], cur.file, project, cur.src);
    if (name !== "optional" && name !== "nullable") return null;
    cur = resolveExpr(callee.object, cur.file, project, cur.src);
  }
  return null;
}

/**
 * The span of the field at `path` inside the schema expression `at` (`s.object({...})` fields, `[]` array items, `*`
 * record values; through consts and relative imports): the whole property for a field, the expression for `[]`.
 * `null` when the source does not spell it out literally.
 */
export function fieldAt(at: At | null, path: readonly string[], project: readonly SourceFile[]): Spot | null {
  if (at === null) return null;
  const [step, ...rest] = path;
  if (step === undefined) return { file: at.file, start: at.expr.start, end: at.expr.end };
  if (step === "[]" || step === "*")
    return fieldAt(argOf(at, step === "[]" ? "array" : "record", project), rest, project);
  const m = memberOf(argOf(at, "object", project), step, project);
  if (m === null) return null;
  if (rest.length > 0) return fieldAt(m.value, rest, project);
  return { file: m.file, start: m.prop.start, end: m.prop.value.end };
}
