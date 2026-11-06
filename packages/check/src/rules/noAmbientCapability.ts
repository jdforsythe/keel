import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { num } from "../internal/num.ts";
import { references } from "../internal/references.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Called path -> ctx replacement for the whole zero-argument call. */
const CALLS: ReadonlyMap<string, string> = new Map([
  ["Date.now", "ctx.clock.now()"],
  ["Math.random", "ctx.random.float()"],
  ["crypto.randomUUID", "ctx.random.uuid()"],
]);
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
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "document.cookie",
]);
/** Globals whose every member is ambient storage. */
const STORAGE: ReadonlySet<string> = new Set(["localStorage", "sessionStorage", "indexedDB"]);
/** Constructors that are ambient effects with any arguments. */
const CONSTRUCTORS: ReadonlySet<string> = new Set(["XMLHttpRequest", "WebSocket", "EventSource"]);
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(["globalThis", "window", "self"]);

/** Dotted path of an identifier or static member chain (`a.b`, `a["b"]`), or null. */
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

/**
 * E1601 (k.ctx): the clock, random, net and storage families in app code (and test code: tests are
 * deterministic too): `Date` (`Date.now`, `new Date()`, `Date()`), `performance.now`, `Math.random`,
 * `crypto.randomUUID`/`getRandomValues`, `setTimeout`/`setInterval`/`requestAnimationFrame`, `fetch`,
 * `XMLHttpRequest`/`WebSocket`/`EventSource`, `localStorage`/`sessionStorage`/`indexedDB`, `document.cookie`;
 * also through `globalThis`/`window`/`self` and `["computed"]` access. Fix: the `ctx` equivalent where exact.
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
    const { declared } = references(ast);
    /** Path with a live `globalThis`/`window`/`self` prefix dropped; null when its root is locally declared. */
    const resolve = (e: Expression): string[] | null => {
      const p = pathOf(e);
      if (p === null) return null;
      const first = p[0];
      const rest = first !== undefined && GLOBAL_OBJECTS.has(first) && !declared.has(first) ? p.slice(1) : p;
      const root = rest[0];
      return root === undefined || declared.has(root) ? null : rest;
    };
    /** Source spelling of `p` (prefix kept), cut after the first `keep` resolved segments (all when omitted). */
    const spelled = (e: Expression, p: string[], keep = p.length): string => {
      const raw = pathOf(e) ?? p;
      return raw.slice(0, raw.length - p.length + keep).join(".");
    };
    const out: Finding[] = [];
    const handled = new Set<number>();
    const hit = (at: number, what: string, start: number, end: number, use: string): void => {
      handled.add(at);
      out.push(findingAt(file, at, { what, start, end, use }));
    };
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const p = resolve(c);
        if (p === null) return;
        const name = p.join(".");
        if (name === "Date" && c.type === "Identifier") return hit(c.start, "Date()", -1, -1, "");
        const whole = CALLS.get(name);
        if (whole !== undefined && n.arguments.length === 0)
          return hit(c.start, `${spelled(c, p)}()`, n.start, n.end, whole);
        const callee = CALLEES.get(name);
        if (callee !== undefined) return hit(c.start, spelled(c, p), c.start, c.end, callee);
        if (AMBIENT.has(name)) hit(c.start, spelled(c, p), -1, -1, "");
        else if (STORAGE.has(p[0] ?? "") && p.length > 1) hit(c.start, spelled(c, p, 1), -1, -1, "");
      },
      NewExpression: (n) => {
        const p = resolve(n.callee);
        const name = p === null ? "" : p.join(".");
        if (name === "Date" && n.arguments.length === 0)
          hit(n.start, "new Date()", n.start, n.end, "new Date(ctx.clock.now())");
        else if (CONSTRUCTORS.has(name)) {
          handled.add(n.callee.start);
          hit(n.start, `new ${spelled(n.callee, p ?? [])}`, -1, -1, "");
        }
      },
      MemberExpression: (n) => {
        if (handled.has(n.start)) return;
        const p = resolve(n);
        if (p === null) return;
        const name = p.join(".");
        if (AMBIENT.has(name)) hit(n.start, spelled(n, p), -1, -1, "");
        else if (STORAGE.has(p[0] ?? "")) hit(n.start, spelled(n, p, 1), -1, -1, "");
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const start = num(f.data, "start");
    const use = str(f.data, "use");
    if (start < 0 || use === "") return null;
    return [{ start, end: num(f.data, "end"), text: use }];
  },
};
