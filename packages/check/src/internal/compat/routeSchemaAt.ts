import { type CallExpression, Visitor } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { parseFile } from "../parseFile.ts";
import type { At } from "./At.ts";
import { memberOf } from "./memberOf.ts";
import { resolveExpr } from "./resolveExpr.ts";

/** The first argument of the call `at` resolves to (`action({...})`, `loader({...})`). */
function firstArg(at: At | null, project: readonly SourceFile[]): At | null {
  return at !== null && at.expr.type === "CallExpression"
    ? resolveExpr(at.expr.arguments[0], at.file, project, at.src)
    : null;
}

/**
 * The schema expression of route `id` declared in `file`, read statically: `input` of the `method` action bound by
 * `routes.actions({ [id]: { [method]: action({ input }) } })`, `output` of the entry's `loader({ output })`, or the
 * entry's own `params`/`search` in `manifest({ [id]: {...} })`. `null` when the source does not spell it out.
 */
export function routeSchemaAt(
  file: SourceFile,
  id: string,
  part: "input" | "output" | "params" | "search",
  method: string,
  project: readonly SourceFile[],
): At | null {
  const calls: CallExpression[] = [];
  new Visitor({ CallExpression: (n) => void calls.push(n) }).visit(parseFile(file).program);
  for (const call of calls) {
    const c = call.callee;
    const binds = c.type === "MemberExpression" && !c.computed && c.property.name === "actions";
    if (binds !== (part === "input")) continue;
    const entry = memberOf(resolveExpr(call.arguments[0], file, project), id, project);
    if (entry === null) continue;
    if (part === "input")
      return (
        memberOf(firstArg(memberOf(entry.value, method, project)?.value ?? null, project), "input", project)?.value ??
        null
      );
    if (part !== "output") return memberOf(entry.value, part, project)?.value ?? null;
    return (
      memberOf(firstArg(memberOf(entry.value, "loader", project)?.value ?? null, project), "output", project)?.value ??
      null
    );
  }
  return null;
}
