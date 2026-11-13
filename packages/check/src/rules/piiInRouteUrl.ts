import { type Argument, type Expression, Visitor } from "oxc-parser";
import type { At } from "../internal/compat/At.ts";
import { resolveExpr } from "../internal/compat/resolveExpr.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { parseFile } from "../internal/parseFile.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

/**
 * True when the schema expression `at` holds a `.pii(...)` call, also in the consts and relative imports named by
 * its identifiers in call arguments, member objects and property values (each expression read once).
 */
function marked(at: At | null, project: readonly SourceFile[], seen: Set<string>): boolean {
  if (at === null) return false;
  const key = `${at.file.path}:${at.expr.start}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const { start, end } = at.expr;
  const inside = (n: { readonly start: number; readonly end: number }): boolean => n.start >= start && n.end <= end;
  let hit = false;
  const names: Expression[] = [];
  const named = (e: Expression | Argument): void => {
    if (e.type === "Identifier" && inside(e)) names.push(e);
  };
  new Visitor({
    CallExpression: (n) => {
      const c = n.callee;
      if (inside(n) && c.type === "MemberExpression" && !c.computed && c.property.name === "pii") hit = true;
      n.arguments.forEach(named);
    },
    MemberExpression: (n) => named(n.object),
    ObjectExpression: (n) => {
      for (const p of n.properties) if (p.type === "Property") named(p.value);
    },
  }).visit(parseFile(at.file).program);
  return hit || names.some((n) => marked(resolveExpr(n, at.file, project, at.src), project, seen));
}

/**
 * E1111 (k.privacy): a `.pii()` node in the `params` or `search` schema of a `manifest({...})` entry, read through
 * consts and relative imports: a path or query reaches browser history and proxy logs Keel cannot redact. At the
 * property; no fix.
 */
export const piiInRouteUrl: RuleDef = {
  code: "E1111",
  message: (f) => `personal data in route ${str(f.data, "part")}; a URL reaches history and logs`,
  explain: "A path or query reaches browser history and proxy logs, which no redaction reaches.",
  see: "k.privacy",
  check: ({ file, ast, project }) => {
    const names = localNames(ast, "manifest", "@keel/router");
    if (!isAppPath(file.path) || names.size === 0) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const table = n.arguments[0];
        if (n.callee.type !== "Identifier" || !names.has(n.callee.name) || table?.type !== "ObjectExpression") return;
        for (const entry of table.properties) {
          const def = entry.type === "Property" ? resolveExpr(entry.value, file, project) : null;
          if (def === null || def.expr.type !== "ObjectExpression") continue;
          for (const part of ["params", "search"]) {
            const p = propertyOf(def.expr, part);
            const schema = p === null ? null : resolveExpr(p.value, def.file, project, def.src);
            if (p === null || !marked(schema, project, new Set())) continue;
            out.push(findingAt(file, def.file.path === file.path ? p.start : entry.start, { part }));
          }
        }
      },
    }).visit(ast);
    return out;
  },
};
