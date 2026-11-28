import { type CallExpression, Visitor } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { isCodePath } from "../isCodePath.ts";
import { parseFile } from "../parseFile.ts";
import type { At } from "./At.ts";
import { memberOf } from "./memberOf.ts";
import { resolveExpr } from "./resolveExpr.ts";

/**
 * The state schema expression of the store with id `id` under `dir`, read statically: the first argument of a
 * `store(schema, initial, { id })` call whose options spell `id` as a string literal. `null` when none does.
 */
export function storeSchemaAt(dir: string, id: string, project: readonly SourceFile[]): At | null {
  for (const file of project) {
    if (!file.path.startsWith(dir) || !isCodePath(file.path) || !file.source.includes(id)) continue;
    const calls: CallExpression[] = [];
    new Visitor({ CallExpression: (n) => void calls.push(n) }).visit(parseFile(file).program);
    for (const call of calls) {
      if (call.callee.type !== "Identifier" || call.callee.name !== "store") continue;
      const v = memberOf(resolveExpr(call.arguments[2], file, project), "id", project)?.value?.expr;
      if (v?.type === "Literal" && v.value === id) return resolveExpr(call.arguments[0], file, project);
    }
  }
  return null;
}
