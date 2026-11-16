import { globalRefs, unwrapExpression as unwrap } from "@keel/compiler/internal";
import { type Argument, type Expression, type MemberExpression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { givenAt } from "../internal/givenAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Links followed before giving up, as in E1603. */
const MAX_DEPTH = 16;
/** Operators whose result does not hold an operand: comparisons and tests. */
const TESTS: ReadonlySet<string> = new Set([
  ...["===", "!==", "==", "!=", "<", ">", "<=", ">=", "in", "instanceof"],
  ...["!", "typeof", "void", "delete"],
]);
/** Calls whose result holds an argument: conversions, copies and encodings that can be reversed. */
const KEEPS: ReadonlySet<string> = new Set([
  ...["String", "String.raw", "JSON.stringify", "structuredClone", "Array.from", "Object.assign", "Object.values"],
  ...["Object.entries", "btoa", "encodeURI", "encodeURIComponent", "Buffer.from"],
]);
/** Members that are a count, not the value. */
const COUNTS: ReadonlySet<string> = new Set(["length", "size"]);
/** Methods whose result is a test or a position. */
const ASKS: ReadonlySet<string> = new Set(["includes", "startsWith", "endsWith", "indexOf", "has"]);
/** Methods whose result holds an argument as well as the receiver. */
const JOINS: ReadonlySet<string> = new Set(["concat", "replace", "replaceAll", "padStart", "padEnd"]);
/** Global paths that write an argument out. */
const WRITES: ReadonlySet<string> = new Set(["process.stdout.write", "process.stderr.write", "Promise.reject"]);
const FS = /^(node:)?fs(\/promises)?$/;
const FS_WRITE = /^(writeFile|appendFile|write)(Sync)?$/;
/** The name a member reads: `o.a`, or `o['a']` with a string key; else `null`. */
const named = (m: MemberExpression): string | null => {
  if (m.property.type === "PrivateIdentifier") return null;
  if (!m.computed) return m.property.name;
  return m.property.type === "Literal" && typeof m.property.value === "string" ? m.property.value : null;
};

/**
 * E1112 (k.reveal): in app code, a value `reveal` returns (`@keel/schema`, any alias, `<namespace>.reveal`, or a
 * local bound to one) that reaches a sink. Sinks, under any local name or `.bind()`: an argument of `tx` or `store`
 * (`@keel/store`), of `set` or `commit` on `ctx.storage` (a `.storage` member, a local destructured or assigned
 * from one, a parameter or value-less local named `storage`), of a `console` method, of `process.stdout.write`,
 * `process.stderr.write` or `Promise.reject`, of a `node:fs` or `node:fs/promises` write (a named import or a
 * member of the module), of a global whose name ends in `Error`, called or constructed; and the value thrown.
 * A value carries one when it is the call; a local a live given value carries (`givenAt`); a spread, literal,
 * template, operator other than a test, `?:` or `await` of one; the right side of `&&`; a member of one other than
 * `length` and `size` (of an object literal or a local, the named field only); a method called on one other than
 * the tests in `ASKS`; a `JOINS` method given one; or a `KEEPS` call of one. Any other call, a parameter and an
 * import end it. One finding per sink, at the first carrying argument; no fix (what to derive is the author's
 * choice).
 */
export const revealedValue: RuleDef = {
  code: "E1112",
  message: (f) => `a revealed value reaches ${str(f.data, "sink")}; store a value derived from it`,
  explain: "Logs, storage and state keep a revealed value as written. Pass the Secret, or store a derived value.",
  see: "k.reveal",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const reveals = new Set<string>();
    const spaces = new Set<string>();
    const fs = new Set<string>();
    const stores = new Set<string>();
    const sinks = new Map<string, string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration") continue;
      const from = st.source.value;
      for (const sp of st.specifiers) {
        const local = sp.local.name;
        const name =
          sp.type !== "ImportSpecifier"
            ? "default"
            : sp.imported.type === "Identifier"
              ? sp.imported.name
              : sp.imported.value;
        if (from === "@keel/schema") {
          if (name === "reveal") reveals.add(local);
          else if (sp.type === "ImportNamespaceSpecifier") spaces.add(local);
        } else if (from === "@keel/store") {
          if (name === "tx" || name === "store") sinks.set(local, name);
          else if (sp.type === "ImportNamespaceSpecifier") stores.add(local);
        } else if (FS.test(from)) {
          if (FS_WRITE.test(name)) sinks.set(local, name);
          else if (name === "default" || name === "promises") fs.add(local);
        }
      }
    }
    if (reveals.size === 0 && spaces.size === 0) return [];
    const g = globalRefs(ast);
    const imported = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const { live, under } = givenAt(ast, g);
    /** The values the local `name` read at `at` is bound to whole: initializers and assignments. */
    const bound = (name: string, at: number): Expression[] =>
      live(name, at).flatMap((x) => (x.key === undefined ? [x.v] : []));
    const isReveal = (callee: Expression, d: number): boolean => {
      const c = unwrap(callee);
      if (c.type === "Identifier")
        return (
          (reveals.has(c.name) && imported(c.name, c.start)) ||
          (d < MAX_DEPTH && bound(c.name, c.start).some((v) => isReveal(v, d + 1)))
        );
      return (
        c.type === "MemberExpression" &&
        !c.computed &&
        c.property.name === "reveal" &&
        c.object.type === "Identifier" &&
        spaces.has(c.object.name) &&
        imported(c.object.name, c.object.start)
      );
    };
    const memo = new Map<Expression, Map<string | undefined, boolean>>();
    /** `carries(v, key)` for a given value, each answered once; a value that reaches itself carries nothing more. */
    const once = (v: Expression, key: string | undefined, d: number): boolean => {
      const seen = memo.get(v) ?? new Map<string | undefined, boolean>();
      memo.set(v, seen);
      const known = seen.get(key);
      if (known !== undefined) return known;
      seen.set(key, false);
      const r = carries(v, key, d + 1);
      seen.set(key, r);
      return r;
    };
    /** Whether `e` carries a revealed value, or with `key`, whether its field `key` does. */
    const carries = (e: Argument | null | undefined, key: string | undefined, d: number): boolean => {
      if (e === null || e === undefined || d > MAX_DEPTH) return false;
      const next = (x: Argument | null | undefined): boolean => carries(x, undefined, d + 1);
      /** Whether a read of `key` reads the field `name` (null: any field). */
      const reads = (name: string | null): boolean => key === undefined || name === null || name === key;
      switch (e.type) {
        case "Identifier":
          return live(e.name, e.start).some((x) =>
            x.field === undefined ? once(x.v, x.key ?? key, d) : reads(x.field) && next(x.v),
          );
        case "ObjectExpression":
          return e.properties.some((p) =>
            p.type === "SpreadElement" ? next(p.argument) : reads(keyName(p)) && next(p.value),
          );
        case "ParenthesizedExpression":
        case "ChainExpression":
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
          return carries(e.expression, key, d + 1);
      }
      if (key !== undefined) return !COUNTS.has(key) && next(e);
      switch (e.type) {
        case "CallExpression":
        case "NewExpression": {
          const c = e.callee;
          if (e.type === "CallExpression" && isReveal(c, 0)) return true;
          const path = g.resolve(c)?.join(".");
          if (path !== undefined && KEEPS.has(path) && (path === "String" || e.type === "CallExpression"))
            return e.arguments.some(next);
          if (e.type === "NewExpression" || c.type !== "MemberExpression") return false;
          const m = (c.computed ? g.constString(c.property) : c.property.name) ?? "";
          return !ASKS.has(m) && (next(c.object) || (JOINS.has(m) && e.arguments.some(next)));
        }
        case "TaggedTemplateExpression":
          return g.resolve(e.tag)?.join(".") === "String.raw" && e.quasi.expressions.some(next);
        case "MemberExpression":
          return carries(e.object, e.computed ? (g.constString(e.property) ?? undefined) : e.property.name, d + 1);
        case "ArrayExpression":
          return e.elements.some(next);
        case "TemplateLiteral":
          return e.expressions.some(next);
        case "BinaryExpression":
          return !TESTS.has(e.operator) && (next(e.right) || (e.left.type !== "PrivateIdentifier" && next(e.left)));
        case "LogicalExpression":
          return (e.operator !== "&&" && next(e.left)) || next(e.right);
        case "ConditionalExpression":
          return next(e.consequent) || next(e.alternate);
        case "UnaryExpression":
          return !TESTS.has(e.operator) && next(e.argument);
        case "AssignmentExpression":
          return next(e.right);
        case "SequenceExpression":
          return next(e.expressions[e.expressions.length - 1]);
        case "SpreadElement":
        case "AwaitExpression":
          return next(e.argument);
        default:
          return false;
      }
    };
    const isStorage = (object: Expression, d: number): boolean => {
      const o = unwrap(object);
      if (o.type === "MemberExpression") return named(o) === "storage";
      if (o.type !== "Identifier" || d > MAX_DEPTH) return false;
      if (under("storage", o.name, o.start)) return true;
      const given = live(o.name, o.start).filter((x) => !x.kept);
      return given.length === 0
        ? o.name === "storage"
        : given.some((x) => x.key === undefined && isStorage(x.v, d + 1));
    };
    const sinkOf = (callee: Expression, d: number): string | null => {
      const c = unwrap(callee);
      if (d > MAX_DEPTH) return null;
      if (c.type === "CallExpression") {
        const b = c.callee;
        return b.type === "MemberExpression" && !b.computed && b.property.name === "bind"
          ? sinkOf(b.object, d + 1)
          : null;
      }
      const m = c.type === "MemberExpression" ? named(c) : null;
      if (c.type === "MemberExpression" && m !== null) {
        if ((m === "set" || m === "commit") && isStorage(c.object, 0)) return `storage.${m}`;
        const o = unwrap(c.object);
        const ns = o.type === "MemberExpression" && named(o) === "promises" ? unwrap(o.object) : o;
        const from = ns.type === "Identifier" && imported(ns.name, ns.start) ? ns.name : null;
        if (from !== null && FS_WRITE.test(m) && fs.has(from)) return m;
        if (from !== null && o === ns && (m === "tx" || m === "store") && stores.has(from)) return m;
      }
      const p = g.resolve(c) ?? [];
      const path = p.join(".");
      if ((p.length === 2 && p[0] === "console") || WRITES.has(path) || (p.length === 1 && path.endsWith("Error")))
        return path;
      if (c.type !== "Identifier") return null;
      const s = imported(c.name, c.start) ? sinks.get(c.name) : undefined;
      if (s !== undefined) return s;
      for (const v of bound(c.name, c.start)) {
        const via = sinkOf(v, d + 1);
        if (via !== null) return via;
      }
      return null;
    };
    const out: Finding[] = [];
    const call = (n: { readonly callee: Expression; readonly arguments: readonly Argument[] }): void => {
      const sink = sinkOf(n.callee, 0);
      const arg = sink === null ? undefined : n.arguments.find((a) => carries(a, undefined, 0));
      if (sink !== null && arg !== undefined) out.push(findingAt(file, arg.start, { sink }));
    };
    new Visitor({
      CallExpression: call,
      NewExpression: call,
      ThrowStatement: (n) => {
        if (carries(n.argument, undefined, 0)) out.push(findingAt(file, n.argument.start, { sink: "throw" }));
      },
    }).visit(ast);
    return out;
  },
};
