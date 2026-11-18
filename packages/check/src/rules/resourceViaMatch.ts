import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1204 (k.reactive): a `resource` (from `@keel/reactive`, bound with `const r = resource(...)`) whose state is
 * read with `r.get()` anywhere but the `on` attribute of a `Match` (from `@keel/runtime-dom`). Name-based, no
 * scope resolution. No fix: the `Case` per state is the author's.
 */
export const resourceViaMatch: RuleDef = {
  code: "E1204",
  message: (f) => `resource ${str(f.data, "name")} read outside Match; render it with <Match on={r.get()}>`,
  see: "k.reactive",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const resource = localNames(ast, "resource", "@keel/reactive");
    if (resource.size === 0) return [];
    const match = localNames(ast, "Match", "@keel/runtime-dom");
    const bound = new Set<string>();
    const reads: { start: number; name: string }[] = [];
    const allowed = new Set<number>();
    new Visitor({
      VariableDeclarator: (n) => {
        const init = n.init;
        if (n.id.type !== "Identifier" || init?.type !== "CallExpression") return;
        if (init.callee.type === "Identifier" && resource.has(init.callee.name)) bound.add(n.id.name);
      },
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "MemberExpression" || c.computed || c.property.name !== "get") return;
        if (c.object.type === "Identifier") reads.push({ start: n.start, name: c.object.name });
      },
      JSXOpeningElement: (n) => {
        if (n.name.type !== "JSXIdentifier" || !match.has(n.name.name)) return;
        for (const a of n.attributes) {
          if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== "on") continue;
          if (a.value?.type === "JSXExpressionContainer") allowed.add(a.value.expression.start);
        }
      },
    }).visit(ast);
    const out: Finding[] = [];
    for (const r of reads) {
      if (bound.has(r.name) && !allowed.has(r.start)) out.push(findingAt(file, r.start, { name: r.name }));
    }
    return out;
  },
};
