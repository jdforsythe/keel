import type { ParsedFile } from "./ParsedFile.ts";
import { argAt } from "./argAt.ts";
import { callsIn } from "./callsIn.ts";
import { hasSchemaPath } from "./hasSchemaPath.ts";
import { memberCall } from "./memberCall.ts";
import { propValue } from "./propValue.ts";
import { resolveSchema } from "./resolveSchema.ts";
import { stringLiteral } from "./stringLiteral.ts";
import { unwrap } from "./unwrap.ts";

const segs = (p: string): string[] => p.split(".");

/** True when `path` is proven absent from the target's schema within `files` (the module folder). */
export function pathMissing(subject: string, name: string, path: string, files: readonly ParsedFile[]): boolean {
  if (subject === "el") return path !== "value";
  for (const f of files) {
    for (const call of callsIn(f.program)) {
      const callee = unwrap(call.callee);
      const mc = memberCall(call);
      const schemaAt = (i: number, rest: string) => {
        const a = argAt(call, i);
        return a === undefined ? false : !hasSchemaPath(resolveSchema(a, f.scope), segs(rest));
      };
      if (subject === "tx" && callee.type === "Identifier" && callee.name === "transaction") {
        if (stringLiteral(argAt(call, 1)) === name) return schemaAt(2, path);
      } else if (subject === "store" && callee.type === "Identifier" && callee.name === "store") {
        const opts = unwrap(argAt(call, 2) ?? callee);
        if (opts.type === "ObjectExpression" && stringLiteral(propValue(opts, "id")) === name) return schemaAt(0, path);
      } else if (subject === "error" && mc !== undefined && mc.name === "error") {
        const o = unwrap(mc.object);
        if (o.type === "Identifier" && o.name === "s" && stringLiteral(argAt(call, 0)) === name)
          return path.startsWith("data.") ? schemaAt(1, path.slice(5)) : true;
      } else if (subject === "route" && callee.type === "Identifier" && callee.name === "manifest") {
        const table = unwrap(argAt(call, 0) ?? callee);
        if (table.type !== "ObjectExpression") continue;
        const entryExpr = propValue(table, name);
        const entry = entryExpr === undefined ? undefined : unwrap(entryExpr);
        if (entry === undefined || entry.type !== "ObjectExpression") continue;
        const head = path.startsWith("params.") ? "params" : path.startsWith("search.") ? "search" : undefined;
        if (head === undefined) return true;
        const schema = propValue(entry, head);
        return schema === undefined
          ? false
          : !hasSchemaPath(resolveSchema(schema, f.scope), segs(path.slice(head.length + 1)));
      }
    }
  }
  return false;
}
