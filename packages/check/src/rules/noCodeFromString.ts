import { globalRefs } from "@keel/compiler/internal";
import { type Expression, type MemberExpression, type SpreadElement, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { propertyOf } from "../internal/propertyOf.ts";
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
/** Alias, `+`, assignment and prototype links followed before giving up. */
const MAX_DEPTH = 16;
/** Calls and members that return the URL they are read from: `u.toString()`, `new URL(u).href` (rfc:0065). */
const SAME_URL: ReadonlySet<string> = new Set(["href", "toString", "valueOf"]);
/** Calls that return their argument's prototype. */
const PROTOTYPE_OF: ReadonlySet<string> = new Set(["Object.getPrototypeOf", "Reflect.getPrototypeOf"]);
/** Assignment operators whose value is the right operand. */
const ASSIGN: ReadonlySet<string> = new Set(["=", "||=", "&&=", "??="]);
/** The constant text a string expression starts with and the first part that is not constant (null: none). */
type Lead = { readonly text: string; readonly rest: Expression | null };

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
 * also a function's `constructor` (`(() => {}).constructor(s)`, async and generator forms, and up its prototype
 * chain while it stays in the `Function` family) and `import()` or `new Worker`/`SharedWorker` (also through
 * `Reflect.construct`) of a `data:` or `blob:` URL followed to its origin (`urlOf`) (rfc:0058, 0061, 0065).
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
    /** Values each name is given in the file, at the binding offset: declarations and assignments (rfc:0065). */
    const values = new Map<string, { at: number; v: Expression }[]>();
    const give = (name: string, at: number, v: Expression): void =>
      void values.set(name, [...(values.get(name) ?? []), { at, v }]);
    new Visitor({
      VariableDeclarator: (n) => {
        if (n.id.type === "Identifier" && n.init !== null) give(n.id.name, n.id.start, n.init);
      },
      AssignmentExpression: (n) => {
        if (n.left.type === "Identifier" && ASSIGN.has(n.operator)) give(n.left.name, n.left.start, n.right);
      },
    }).visit(ast);
    const keyOf = (m: MemberExpression): string | null =>
      m.computed ? g.constString(m.property) : m.property.type === "Identifier" ? m.property.name : null;
    /** The value an object literal (through aliases) holds at the member `m` reads, or null. */
    const propValue = (m: MemberExpression): Expression | null => {
      const key = keyOf(m);
      const o = g.initOf(m.object);
      const p = key === null || o.type !== "ObjectExpression" ? null : propertyOf(o, key);
      return p === null ? null : p.value;
    };
    /** Prototype steps from `e` that stay in the `Function` family (-1: not a function value; rfc:0065). */
    const hops = (e: Expression, depth: number): number => {
      const x = g.initOf(e);
      if (depth > MAX_DEPTH) return -1;
      if (x.type === "ArrowFunctionExpression") return x.async ? 2 : 1;
      if (x.type === "FunctionExpression") return x.async || x.generator ? 2 : 1;
      if (x.type === "ClassExpression") return 1;
      if (x.type === "Identifier") {
        const d = g.functionOf(x.name, x.start);
        if (d !== null) return d.async || d.generator ? 2 : 1;
      }
      if (x.type === "CallExpression") {
        const a = x.arguments[0];
        if (!PROTOTYPE_OF.has(g.resolve(x.callee)?.join(".") ?? "") || a === undefined || a.type === "SpreadElement")
          return -1;
        const h = hops(a, depth + 1);
        return h > 0 ? h - 1 : -1;
      }
      const v = x.type === "MemberExpression" ? propValue(x) : null;
      if (v !== null) return hops(v, depth + 1);
      const p = g.resolve(x);
      return isFunctionPath(p) ? 1 : p?.join(".") === "Function.prototype" ? 0 : -1;
    };
    /** Whether `e` is the `Function` constructor family: resolved, or a function value's `constructor` (rfc:0065). */
    const isCtor = (e: Expression): boolean => {
      if (isFunctionPath(g.resolve(e))) return true;
      const x = g.initOf(e);
      return x.type === "MemberExpression" && keyOf(x) === "constructor" && hops(x.object, 0) >= 0;
    };
    /** The constant text `e` starts with, through same-file aliases, `+` and templates, and the first other part. */
    const lead = (e: Expression, depth: number): Lead => {
      const whole = g.constString(e);
      if (whole !== null) return { text: whole, rest: null };
      const x = g.initOf(e);
      if (depth > MAX_DEPTH) return { text: "", rest: null };
      if (x.type === "BinaryExpression" && x.operator === "+") {
        const l = lead(x.left, depth + 1);
        if (l.rest !== null) return l;
        const r = lead(x.right, depth + 1);
        return { text: l.text + r.text, rest: r.rest };
      }
      if (x.type !== "TemplateLiteral") return { text: "", rest: x };
      let text = x.quasis[0]?.value.cooked ?? "";
      for (const [i, sub] of x.expressions.entries()) {
        const s = lead(sub, depth + 1);
        text += s.text;
        if (s.rest !== null) return { text, rest: s.rest };
        text += x.quasis[i + 1]?.value.cooked ?? "";
      }
      return { text, rest: null };
    };
    /**
     * `data:` or `blob:` when `e` is such a URL, followed to its origin (rfc:0061, 0065): a constant prefix,
     * `URL.createObjectURL(...)`, and through aliases, values a local is given, `?:`/`&&`/`||`/`??`, an object
     * literal's property, `String(u)`, `u.toString()`, `new URL(u)`, `.href`, and a template or `+` it leads.
     */
    const urlOf = (e: Expression, depth: number): string | null => {
      const x = g.initOf(e);
      if (depth > MAX_DEPTH) return null;
      const next = (v: Expression | SpreadElement | undefined | null): string | null =>
        v === undefined || v === null || v.type === "SpreadElement" ? null : urlOf(v, depth + 1);
      if (x.type === "Identifier") {
        if (g.resolveName(x.name, x.start) !== null) return null;
        for (const { at, v } of values.get(x.name) ?? []) {
          const r = g.sameBinding(x.name, at, x.start) ? next(v) : null;
          if (r !== null) return r;
        }
        return null;
      }
      if (x.type === "ConditionalExpression") return next(x.consequent) ?? next(x.alternate);
      if (x.type === "LogicalExpression") return next(x.left) ?? next(x.right);
      if (x.type === "MemberExpression") return keyOf(x) === "href" ? next(x.object) : next(propValue(x));
      if (x.type === "NewExpression") return g.resolve(x.callee)?.join(".") === "URL" ? next(x.arguments[0]) : null;
      if (x.type === "CallExpression") {
        const name = g.resolve(x.callee)?.join(".") ?? "";
        if (name === "URL.createObjectURL") return "blob:";
        if (name === "String") return next(x.arguments[0]);
        const c = g.initOf(x.callee);
        return c.type === "MemberExpression" && SAME_URL.has(keyOf(c) ?? "") ? next(c.object) : null;
      }
      const { text, rest } = lead(x, depth);
      const scheme = schemeOf(text);
      if (CODE_SCHEMES.has(scheme)) return scheme;
      return scheme === "" && rest !== x ? next(rest) : null;
    };
    const invoked = (e: Expression): void => {
      if (isCtor(e) && !g.isAliasInit(e.start, e.end)) hit(e.start, "Function");
    };
    const worker = (
      n: { readonly start: number },
      callee: Expression,
      arg: Expression | SpreadElement | undefined | null,
    ): void => {
      const name = g.resolve(callee)?.join(".") ?? "";
      const scheme =
        !WORKERS.has(name) || arg === undefined || arg === null || arg.type === "SpreadElement" ? null : urlOf(arg, 0);
      if (scheme !== null) hit(n.start, `new ${name}(${scheme})`);
    };
    new Visitor({
      CallExpression: (n) => {
        if (isCtor(n.callee)) return hit(n.callee.start, "Function");
        const m = g.initOf(n.callee);
        if (m.type === "MemberExpression" && INVOKERS.has(keyOf(m) ?? "") && isCtor(m.object))
          return hit(n.callee.start, "Function");
        const p = g.resolve(n.callee);
        const [first, second] = n.arguments;
        if (p === null || p.length !== 2 || p[0] !== "Reflect" || !REFLECT_INVOKE.has(p[1] ?? "")) return;
        if (first === undefined || first.type === "SpreadElement") return;
        invoked(first);
        const list = second === undefined || second.type === "SpreadElement" ? null : g.initOf(second);
        if (p[1] === "construct" && list?.type === "ArrayExpression") worker(n, first, list.elements[0]);
      },
      NewExpression: (n) => {
        invoked(n.callee);
        worker(n, n.callee, n.arguments[0]);
      },
      ImportExpression: (n) => {
        const scheme = urlOf(n.source, 0);
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
