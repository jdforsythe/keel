import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { globalRefs } from "../internal/globalRefs.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** `Function` used as a value elsewhere (`x instanceof Function`) is not string code; these members are. */
const INVOKERS: ReadonlySet<string> = new Set(["call", "apply", "bind"]);
/** `Reflect` members whose first argument is invoked. */
const REFLECT_INVOKE: ReadonlySet<string> = new Set(["apply", "construct"]);

/**
 * E1603 (k.ctx, rfc:0053): `eval`, `Function(...)`, or `new Function(...)` in app and test code. Code from a
 * string reaches every ambient past E1601. Resolved like E1601 (`globalRefs`): aliases, `globalThis` and
 * literal keys, lexical scope. `eval` is reported at every use; `Function` where it is invoked (called,
 * constructed, `.call`/`.apply`/`.bind`, or `Reflect.apply`/`construct`), so `instanceof Function` stays clean.
 * An unexported alias is reported at its uses. No fix: the code in the string is the author's.
 */
export const noCodeFromString: RuleDef = {
  code: "E1603",
  message: (f) => `${str(f.data, "name")} runs code from a string; pass a function`,
  explain: "A string evaluated as code can reach any ambient effect past E1601; write the function instead.",
  see: "k.ctx",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) && !isTestPath(file.path)) return [];
    const g = globalRefs(ast);
    const out: Finding[] = [];
    const seen = new Set<number>();
    const hit = (at: number, name: string): void => {
      if (seen.has(at)) return;
      seen.add(at);
      out.push(findingAt(file, at, { name }));
    };
    const isFunction = (e: Expression): boolean => g.resolve(e)?.join(".") === "Function";
    const invoked = (e: Expression): void => {
      if (isFunction(e) && !g.isAliasInit(e.start, e.end)) hit(e.start, "Function");
    };
    new Visitor({
      CallExpression: (n) => {
        const p = g.resolve(n.callee);
        const name = p === null ? "" : p.join(".");
        if (name === "Function") return hit(n.callee.start, "Function");
        if (p !== null && p.length === 2 && p[0] === "Function" && INVOKERS.has(p[1] ?? ""))
          return hit(n.callee.start, "Function");
        const first = n.arguments[0];
        if (p !== null && p.length === 2 && p[0] === "Reflect" && REFLECT_INVOKE.has(p[1] ?? "") && first !== undefined)
          if (first.type !== "SpreadElement") invoked(first);
      },
      NewExpression: (n) => invoked(n.callee),
      MemberExpression: (n) => {
        if (g.isAliasInit(n.start, n.end)) return;
        if (g.resolve(n)?.join(".") === "eval") hit(n.start, "eval");
      },
    }).visit(ast);
    for (const r of g.refs) {
      if (g.isAliasInit(r.start, r.end)) continue;
      if (g.resolveName(r.name, r.start)?.join(".") === "eval") hit(r.start, "eval");
    }
    return out;
  },
};
