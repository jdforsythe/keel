import { unwrapExpression as unwrap } from "@keel/compiler/internal";
import { type Argument, type Expression, type MemberExpression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { revealFlow } from "../internal/revealFlow.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Links followed before giving up, as in E1603. */
const MAX_DEPTH = 16;
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
 * Whether a value carries one is k.reveal Flow, read by `revealFlow` (the walk `carriesReveal` exports). A sink's
 * `.call`, `.apply` or `.bind`, or `Reflect.apply` of it, passes it each argument after the `this` value. One finding
 * per sink, at the first carrying argument; no fix (what to derive is the author's choice).
 */
export const revealedValue: RuleDef = {
  code: "E1112",
  message: (f) => `a revealed value reaches ${str(f.data, "sink")}; store a value derived from it`,
  see: "k.reveal",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
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
        if (from === "@keel/store") {
          if (name === "tx" || name === "store") sinks.set(local, name);
          else if (sp.type === "ImportNamespaceSpecifier") stores.add(local);
        } else if (FS.test(from)) {
          if (FS_WRITE.test(name)) sinks.set(local, name);
          else if (name === "default" || name === "promises") fs.add(local);
        }
      }
    }
    const flow = revealFlow(ast);
    if (flow === null) return [];
    const { g, live, under, bound, imported } = flow;
    const carries = (e: Argument | undefined): boolean => flow.carries(e);
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
      const c = unwrap(n.callee);
      const m = c.type === "MemberExpression" ? named(c) : null;
      const [f, , list] = n.arguments;
      // A sink's `.call`, `.apply` or `.bind`, or `Reflect.apply` of it: the arguments after the `this` value.
      const [sink, args] =
        f !== undefined && f.type !== "SpreadElement" && g.resolve(c)?.join(".") === "Reflect.apply"
          ? [sinkOf(f, 0), list === undefined ? [] : [list]]
          : c.type === "MemberExpression" && (m === "call" || m === "apply" || m === "bind")
            ? [sinkOf(c.object, 0), n.arguments.slice(1, m === "apply" ? 2 : undefined)]
            : [sinkOf(c, 0), n.arguments];
      const arg = sink === null ? undefined : args.find((a) => carries(a));
      if (sink !== null && arg !== undefined) out.push(findingAt(file, arg.start, { sink }));
    };
    new Visitor({
      CallExpression: call,
      NewExpression: call,
      ThrowStatement: (n) => {
        if (carries(n.argument)) out.push(findingAt(file, n.argument.start, { sink: "throw" }));
      },
    }).visit(ast);
    return out;
  },
};
