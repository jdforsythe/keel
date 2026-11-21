import { callsOf, propOf } from "@keel/std-jobs/tools/internal";
import type { Ast } from "./Ast.ts";
import type { Flow } from "./Flow.ts";
import { importsOf } from "./importsOf.ts";
import { resolvePath } from "./resolvePath.ts";

/** The `workflow` calls of the file at `path` whose options are a literal naming a `chart`. */
export function flowsIn(path: string, ast: Ast): Flow[] {
  const out: Flow[] = [];
  for (const call of callsOf(ast, "@keel/std-workflows", "workflow")) {
    const arg = call.arguments[1];
    const opts = arg?.type === "ObjectExpression" ? arg : undefined;
    const c = propOf(opts, "chart");
    if (c === undefined) continue;
    const imp = c.type === "Identifier" ? importsOf(ast).find((i) => i.local === c.name) : undefined;
    const at = imp === undefined ? path : resolvePath(path, imp.from);
    if (at === undefined) continue;
    const chart = c.type === "Identifier" ? { path: at, name: imp?.name ?? c.name } : { path, start: c.start };
    out.push({ path, opts, chart });
  }
  return out;
}
