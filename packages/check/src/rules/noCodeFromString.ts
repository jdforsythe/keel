import { globalRefs } from "@keel/compiler/internal";
import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** `Function` used as a value elsewhere (`x instanceof Function`) is not string code; these members are. */
const INVOKERS: ReadonlySet<string> = new Set(["call", "apply", "bind"]);
/** `Reflect` members whose first argument is invoked. */
const REFLECT_INVOKE: ReadonlySet<string> = new Set(["apply", "construct"]);
/** Schemes whose URL carries its own code: `data:` inline, `blob:` from `URL.createObjectURL` (rfc:0058, 0061). */
const CODE_SCHEMES: ReadonlySet<string> = new Set(["data:", "blob:"]);
/** Constructors whose first argument is a script URL that runs (rfc:0061). */
const WORKERS: ReadonlySet<string> = new Set(["Worker", "SharedWorker"]);
/** The scheme `s` starts with as the URL parser reads it: leading C0 and spaces skipped, tabs and newlines removed. */
function schemeOf(s: string): string {
  let i = 0;
  while (i < s.length && s.charCodeAt(i) <= 0x20) i++;
  return s
    .slice(i)
    .replace(/[\t\n\r]/g, "")
    .slice(0, 5)
    .toLowerCase();
}
/** Alias and `+` links followed for a constant prefix before giving up. */
const MAX_DEPTH = 16;

/**
 * Whether a resolved path is the `Function` constructor: `Function` itself, or a `constructor` reached from it.
 * A function or class resolves to `Function.prototype` (`globalRefs`), so `(() => {}).constructor`,
 * `Function.prototype.constructor` and an async or generator function's `constructor` all match.
 */
const isFunctionPath = (p: readonly string[] | null): boolean =>
  p !== null && p[0] === "Function" && (p.length === 1 || p[p.length - 1] === "constructor");

/**
 * E1603 (k.ctx, rfc:0053): `eval`, `Function(...)`, or `new Function(...)` in app and test code. Code from a
 * string reaches every ambient past E1601. Resolved like E1601 (`globalRefs`): aliases, `globalThis` and
 * literal keys, lexical scope. `eval` is reported at every use; `Function` where it is invoked (called,
 * constructed, `.call`/`.apply`/`.bind`, or `Reflect.apply`/`construct`), so `instanceof Function` stays clean;
 * also a function's `constructor` (`(() => {}).constructor(s)`, async and generator forms, also through
 * `Object.getPrototypeOf`) and `import()` or `new Worker`/`SharedWorker` of a `data:` or `blob:` URL
 * (a constant prefix, or `URL.createObjectURL(...)`) (rfc:0058, 0061).
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
    const isFunction = (e: Expression): boolean => isFunctionPath(g.resolve(e));
    /** The constant text `e` starts with, through same-file aliases, `+` and templates ("" when unknown). */
    const prefixOf = (e: Expression, depth: number): string => {
      const whole = g.constString(e);
      if (whole !== null || depth > MAX_DEPTH) return whole ?? "";
      const x = g.initOf(e);
      if (x.type === "BinaryExpression" && x.operator === "+") {
        const left = g.constString(x.left);
        return left === null ? prefixOf(x.left, depth + 1) : left + prefixOf(x.right, depth + 1);
      }
      if (x.type !== "TemplateLiteral") return "";
      let out = x.quasis[0]?.value.cooked ?? "";
      for (const [i, sub] of x.expressions.entries()) {
        const s = g.constString(sub);
        if (s === null) return out + prefixOf(sub, depth + 1);
        out += s + (x.quasis[i + 1]?.value.cooked ?? "");
      }
      return out;
    };
    /** `data:` or `blob:` when `e` is such a URL: a constant prefix, or `URL.createObjectURL(...)` through aliases. */
    const codeUrl = (e: Expression): string | null => {
      const x = g.initOf(e);
      if (x.type === "CallExpression" && g.resolve(x.callee)?.join(".") === "URL.createObjectURL") return "blob:";
      const scheme = schemeOf(prefixOf(e, 0));
      return CODE_SCHEMES.has(scheme) ? scheme : null;
    };
    const invoked = (e: Expression): void => {
      if (isFunction(e) && !g.isAliasInit(e.start, e.end)) hit(e.start, "Function");
    };
    new Visitor({
      CallExpression: (n) => {
        const p = g.resolve(n.callee);
        const name = p === null ? "" : p.join(".");
        if (isFunctionPath(p)) return hit(n.callee.start, "Function");
        if (p !== null && INVOKERS.has(p[p.length - 1] ?? "") && isFunctionPath(p.slice(0, -1)))
          return hit(n.callee.start, "Function");
        const first = n.arguments[0];
        if (p !== null && p.length === 2 && p[0] === "Reflect" && REFLECT_INVOKE.has(p[1] ?? "") && first !== undefined)
          if (first.type !== "SpreadElement") invoked(first);
      },
      NewExpression: (n) => {
        invoked(n.callee);
        const worker = g.resolve(n.callee)?.join(".") ?? "";
        const first = n.arguments[0];
        if (!WORKERS.has(worker) || first === undefined || first.type === "SpreadElement") return;
        const scheme = codeUrl(first);
        if (scheme !== null) hit(n.start, `new ${worker}(${scheme})`);
      },
      ImportExpression: (n) => {
        const scheme = codeUrl(n.source);
        if (scheme !== null) hit(n.start, `import(${scheme})`);
      },
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
