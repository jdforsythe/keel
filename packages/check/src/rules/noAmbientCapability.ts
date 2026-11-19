import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Called path -> ctx replacement for the whole zero-argument call. */
const CALLS: ReadonlyMap<string, string> = new Map([
  ["Date.now", "ctx.clock.now()"],
  ["Math.random", "ctx.random.float()"],
]);
/** Called path -> ctx replacement named in the message only: no exact rewrite (the brand is the author's). */
const HINTS: ReadonlyMap<string, string> = new Map([["crypto.randomUUID", "ctx.random.id(brand)"]]);
/** Called path -> ctx replacement for the callee only (arguments kept). */
const CALLEES: ReadonlyMap<string, string> = new Map([
  ["localStorage.getItem", "ctx.storage.get"],
  ["localStorage.setItem", "ctx.storage.set"],
  ["fetch", "ctx.net.fetch"],
]);
/** Paths that are ambient effects as a call, a `new`, or a plain reference (flagged without a fix). */
const AMBIENT: ReadonlySet<string> = new Set([
  "Date.now",
  "Math.random",
  "crypto.randomUUID",
  "crypto.getRandomValues",
  "performance.now",
  "performance.timeOrigin",
  "Temporal.Now",
  "navigator.sendBeacon",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "document.cookie",
]);
/** `Intl.DateTimeFormat` members that read the clock when called with no date (rfc:0058). */
const FORMATS: ReadonlySet<string> = new Set(["format", "formatToParts"]);
/** Globals whose every member is ambient storage. */
const STORAGE: ReadonlySet<string> = new Set(["localStorage", "sessionStorage", "indexedDB"]);
/** Constructors that are ambient effects with any arguments. */
/** Whole globals whose members are guarded: exporting one hands the members to another file (rfc:0053, 0151). */
const ROOTS: ReadonlySet<string> = new Set(["Date", "Math", "performance", "crypto"]);
const CONSTRUCTORS: ReadonlySet<string> = new Set(["XMLHttpRequest", "WebSocket", "EventSource"]);

/** Syntactic dotted path of an identifier or static member chain (`a.b`, `a["b"]`), or null: the spelling. */
function pathOf(e: Expression): string[] | null {
  if (e.type === "ParenthesizedExpression") return pathOf(e.expression);
  if (e.type === "Identifier") return [e.name];
  if (e.type !== "MemberExpression") return null;
  const head = pathOf(e.object);
  if (head === null) return null;
  if (!e.computed) return e.property.type === "Identifier" ? [...head, e.property.name] : null;
  const p = e.property;
  return p.type === "Literal" && typeof p.value === "string" ? [...head, p.value] : null;
}

/** Whether `p` ends with `tail`. */
const endsWith = (p: readonly string[], tail: readonly string[]): boolean =>
  p.length >= tail.length && tail.every((t, i) => p[p.length - tail.length + i] === t);

/**
 * E1601 (k.ctx): the clock, random, net and storage families in app code (and test code: tests are
 * deterministic too): `Date` (`Date.now`, `new Date()`, `Date()`), `performance.now`, `Math.random`,
 * `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`,
 * `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`,
 * `Temporal.Now`, `performance.timeOrigin`, `navigator.sendBeacon`, and an `Intl.DateTimeFormat` `format()` or
 * `formatToParts()` with no date (its instance followed through a same-file `const`; rfc:0058);
 * also through `globalThis`/`window`/`self`, literal computed keys, and same-file aliases and destructuring,
 * names bound by lexical scope (`globalRefs`, rfc:0053). An unexported alias is reported at its uses, not at
 * its initializer. Fix: the `ctx` equivalent where exact.
 */
export const noAmbientCapability: RuleDef = {
  code: "E1601",
  message: (f) => {
    const use = str(f.data, "use");
    return `${str(f.data, "what")} outside ctx${use === "" ? "; use the ctx capability" : `; use ${use}`}`;
  },
  explain: "Every effect comes through ctx so sim runs are deterministic: ctx.clock, ctx.random, ctx.net, ctx.storage.",
  see: "k.ctx",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) && !isTestPath(file.path)) return [];
    const g = globalRefs(ast);
    /** Source spelling of `p` when `e` spells it (prefix kept), else the resolved path; cut after `keep` segments. */
    const spelled = (e: Expression, p: string[], keep = p.length): string => {
      const raw = pathOf(e);
      if (raw === null || !endsWith(raw, p)) return p.slice(0, keep).join(".");
      return raw.slice(0, raw.length - p.length + keep).join(".");
    };
    const out: Finding[] = [];
    const handled = new Set<number>();
    const report = (at: number, what: string, start: number, end: number, use: string): void => {
      handled.add(at);
      out.push(findingAt(file, at, { what, start, end, use }));
    };
    const typeofArgs = new Set<number>();
    /** Objects of a member (`WebSocket` in `WebSocket.OPEN`) and `instanceof` right operands, as `start:end`. */
    const objects = new Set<string>();
    const instanceofs = new Set<string>();
    const key = (n: { start: number; end: number }): string => `${n.start}:${n.end}`;
    /** A read in operand position that names no guarded member: a whole global used as an object or a class. */
    const operand = (n: { start: number; end: number }, p: readonly string[]): boolean =>
      instanceofs.has(key(n)) || (p.length === 1 && objects.has(key(n)));
    const exportedRoot = (at: number, p: readonly string[] | null): void => {
      const root = p?.[0];
      if (p !== null && p.length === 1 && root !== undefined && ROOTS.has(root) && !handled.has(at))
        report(at, root, -1, -1, "");
    };
    new Visitor({
      UnaryExpression: (n) => {
        if (n.operator === "typeof") typeofArgs.add(n.argument.start);
      },
      BinaryExpression: (n) => {
        if (n.operator === "instanceof") instanceofs.add(key(unwrapExpression(n.right)));
      },
      ExportNamedDeclaration: (n) => {
        if (n.source !== null) return;
        for (const sp of n.specifiers)
          if (sp.local.type === "Identifier")
            exportedRoot(sp.local.start, g.resolveName(sp.local.name, sp.local.start));
      },
      ExportDefaultDeclaration: (n) => {
        const d = n.declaration;
        if (d.type === "Identifier" || d.type === "MemberExpression") exportedRoot(d.start, g.resolve(d));
      },
      CallExpression: (n) => {
        const c = n.callee;
        const fmt = unwrapExpression(c);
        if (n.arguments.length === 0 && fmt.type === "MemberExpression") {
          const member = fmt.computed
            ? g.constString(fmt.property)
            : fmt.property.type === "Identifier"
              ? fmt.property.name
              : null;
          const made = g.initOf(fmt.object);
          const maker = made.type === "NewExpression" || made.type === "CallExpression" ? g.resolve(made.callee) : null;
          if (FORMATS.has(member ?? "") && maker?.join(".") === "Intl.DateTimeFormat")
            return report(c.start, `Intl.DateTimeFormat ${member}()`, n.end - 1, n.end - 1, "ctx.clock.now()");
        }
        const p = g.resolve(c);
        if (p === null) return;
        const core = unwrapExpression(c).start;
        const hit = (at: number, what: string, start: number, end: number, use: string): void => {
          handled.add(core);
          report(at, what, start, end, use);
        };
        const name = p.join(".");
        if (name === "Date") return hit(c.start, "Date()", -1, -1, "");
        const whole = CALLS.get(name);
        if (whole !== undefined && n.arguments.length === 0)
          return hit(c.start, `${spelled(c, p)}()`, n.start, n.end, whole);
        const callee = CALLEES.get(name);
        if (callee !== undefined) return hit(c.start, spelled(c, p), c.start, c.end, callee);
        if (AMBIENT.has(name)) hit(c.start, spelled(c, p), -1, -1, HINTS.get(name) ?? "");
        else if (STORAGE.has(p[0] ?? "") && p.length > 1) hit(c.start, spelled(c, p, 1), -1, -1, "");
      },
      NewExpression: (n) => {
        const p = g.resolve(n.callee);
        const name = p === null ? "" : p.join(".");
        if (name === "Date" && n.arguments.length === 0)
          report(n.start, "new Date()", n.start, n.end, "new Date(ctx.clock.now())");
        else if (CONSTRUCTORS.has(name)) {
          handled.add(n.callee.start);
          report(n.start, `new ${spelled(n.callee, p ?? [])}`, -1, -1, "");
        }
      },
      MemberExpression: (n) => {
        objects.add(key(unwrapExpression(n.object)));
        if (handled.has(n.start) || g.isAliasInit(n.start, n.end)) return;
        const p = g.resolve(n);
        if (p === null || operand(n, p)) return;
        const name = p.join(".");
        if (AMBIENT.has(name)) report(n.start, spelled(n, p), -1, -1, "");
        else if (STORAGE.has(p[0] ?? "")) report(n.start, spelled(n, p, 1), -1, -1, "");
      },
    }).visit(ast);
    // Bare reads (`fetch` passed as a value, an alias used without a call): after the visitor, so a read inside
    // a reported call or member is already handled.
    for (const r of g.refs) {
      if (handled.has(r.start) || typeofArgs.has(r.start) || g.isAliasInit(r.start, r.end)) continue;
      const p = g.resolveName(r.name, r.start);
      if (p === null || operand(r, p)) continue;
      const name = p.join(".");
      const what = p.length === 1 && p[0] === r.name ? r.name : name;
      if (AMBIENT.has(name)) report(r.start, what, -1, -1, HINTS.get(name) ?? "");
      else if (STORAGE.has(p[0] ?? "")) report(r.start, p.length === 1 ? what : (p[0] ?? ""), -1, -1, "");
    }
    // Exported declarations: a whole guarded global, or a guarded member bound by destructuring (no read here
    // names it), is reported at the exported name; its uses are in other files.
    for (const e of g.exported) {
      const p = g.resolveName(e.name, e.at);
      if (p === null || handled.has(e.at)) continue;
      const name = p.join(".");
      if (e.destructured && AMBIENT.has(name)) report(e.at, name, -1, -1, HINTS.get(name) ?? "");
      else if (e.destructured && STORAGE.has(p[0] ?? "")) report(e.at, p[0] ?? "", -1, -1, "");
      else exportedRoot(e.at, p);
    }
    return out;
  },
  fix: (f) => {
    const start = num(f.data, "start");
    const use = str(f.data, "use");
    if (start < 0 || use === "") return null;
    return [{ start, end: num(f.data, "end"), text: use }];
  },
};
