import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The `fn` parameter carrying `params`/`search`: loader `fn({ params, search, url }, ctx)`, action `fn(input, { params, url }, ctx)`. */
const ROUTE_ARG: ReadonlyMap<string, number> = new Map([
  ["loader", 0],
  ["action", 1],
]);

/** The declaration form that replaced the positional one (rfc:0027). */
const DECLARATION: ReadonlyMap<string, string> = new Map([
  ["loader", "loader({ output, params?, search? }, fn)"],
  ["action", "action({ input, params? }, fn)"],
]);

/**
 * E1507 (k.router), static half: a `loader`/`action` from `@keel/router` called in the removed positional form
 * (`loader(Output, fn)`: the first argument is not a declaration object), or whose `fn` annotates the parameter
 * that carries `params`/`search` (they are inferred from the declared schemas). Fix (annotation): delete it.
 * The other half (a declared schema that is not the route's) is `manifest`'s runtime throw. Guards play no part.
 */
export const routeSchemaInferred: RuleDef = {
  code: "E1507",
  message: (f) =>
    str(f.data, "kind") === "positional"
      ? `positional ${str(f.data, "name")}(schema, fn); use ${DECLARATION.get(str(f.data, "name")) ?? ""}`
      : `${str(f.data, "name")} params/search typed by hand; drop the annotation, they are inferred`,
  explain: "loader/action fn parameters are inferred from the declared schemas; never annotate them.",
  see: "k.router",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const names = new Map<string, string>();
    for (const kind of ROUTE_ARG.keys()) for (const n of localNames(ast, kind, "@keel/router")) names.set(n, kind);
    if (names.size === 0) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier") return;
        const kind = names.get(n.callee.name);
        if (kind === undefined) return;
        const [decl, fn] = n.arguments;
        if (decl !== undefined && decl.type !== "ObjectExpression") {
          out.push(findingAt(file, n.start, { name: kind, kind: "positional" }));
          return;
        }
        if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") return;
        const p = fn.params[ROUTE_ARG.get(kind) ?? 0];
        if (p === undefined || p.type === "TSParameterProperty") return;
        const ann = p.type === "AssignmentPattern" ? p.left.typeAnnotation : p.typeAnnotation;
        if (ann === null || ann === undefined) return;
        out.push(findingAt(file, ann.start, { name: kind, kind: "annotated", start: ann.start, end: ann.end }));
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const start = num(f.data, "start");
    const end = num(f.data, "end");
    return start < 0 || end <= start ? null : [{ start, end, text: "" }];
  },
};
