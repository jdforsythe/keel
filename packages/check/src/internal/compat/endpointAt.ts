import { type CallExpression, Visitor } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { localNames } from "../modules/localNames.ts";
import { parseFile } from "../parseFile.ts";
import type { Spot } from "./Spot.ts";
import { memberOf } from "./memberOf.ts";
import { resolveExpr } from "./resolveExpr.ts";

/**
 * Where endpoint `name` of the `service({ module })` call in `file` is declared: its key in the `endpoints({...})`
 * literal the call's `schema` resolves to (in this file or a relative import), else the call's `module` property.
 * `null` when `file` holds no such call.
 */
export function endpointAt(
  file: SourceFile,
  module: string,
  name: string,
  project: readonly SourceFile[],
): Spot | null {
  const program = parseFile(file).program;
  const service = localNames(program, "service", "@keel/services");
  const calls: CallExpression[] = [];
  new Visitor({ CallExpression: (n) => void calls.push(n) }).visit(program);
  for (const call of calls) {
    if (call.callee.type !== "Identifier" || !service.has(call.callee.name)) continue;
    const opts = resolveExpr(call.arguments[0], file, project);
    const mod = memberOf(opts, "module", project);
    const lit = mod?.value?.expr;
    if (mod === null || lit?.type !== "Literal" || lit.value !== module) continue;
    const schema = memberOf(opts, "schema", project)?.value ?? null;
    const decls =
      schema?.expr.type === "CallExpression" ? resolveExpr(schema.expr.arguments[0], schema.file, project) : schema;
    const hit = memberOf(decls, name, project);
    return hit === null
      ? { file, start: mod.prop.start, end: mod.prop.end }
      : { file: hit.file, start: hit.prop.start, end: hit.prop.end };
  }
  return null;
}
