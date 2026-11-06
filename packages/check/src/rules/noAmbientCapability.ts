import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { num } from "../internal/num.ts";
import { references } from "../internal/references.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Called member -> ctx replacement for the whole call (`""`: flag without a fix). */
const CALLS: ReadonlyMap<string, string> = new Map([
  ["Date.now", "ctx.clock.now()"],
  ["Math.random", "ctx.random.float()"],
  ["crypto.randomUUID", "ctx.random.uuid()"],
]);
/** Called member -> ctx replacement for the callee only (arguments kept). */
const CALLEES: ReadonlyMap<string, string> = new Map([
  ["localStorage.getItem", "ctx.storage.get"],
  ["localStorage.setItem", "ctx.storage.set"],
  ["window.fetch", "ctx.net.fetch"],
  ["globalThis.fetch", "ctx.net.fetch"],
]);
const MEMBERS: ReadonlySet<string> = new Set([
  "Date.now",
  "Math.random",
  "crypto.randomUUID",
  "window.localStorage",
  "globalThis.localStorage",
  "window.fetch",
  "globalThis.fetch",
]);
const GLOBALS: ReadonlySet<string> = new Set([
  "Date",
  "Math",
  "crypto",
  "localStorage",
  "fetch",
  "window",
  "globalThis",
]);

function memberName(e: Expression): string | null {
  if (e.type !== "MemberExpression" || e.computed || e.object.type !== "Identifier") return null;
  return `${e.object.name}.${e.property.name}`;
}

/**
 * E1601 (k.ctx): `Date.now`, `new Date()`, `Math.random`, `crypto.randomUUID`, bare `fetch`, `localStorage`
 * in app code (and test code: tests are deterministic too). Fix: the `ctx` equivalent where one is exact.
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
    const live = (name: string): boolean => GLOBALS.has(name) && !declared.has(name);
    const out: Finding[] = [];
    const handled = new Set<number>();
    const hit = (at: number, what: string, start: number, end: number, use: string): void => {
      handled.add(at);
      out.push(findingAt(file, at, { what, start, end, use }));
    };
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type === "Identifier") {
          if (c.name === "fetch" && live("fetch")) hit(c.start, "fetch", c.start, c.end, "ctx.net.fetch");
          else if (c.name === "Date" && live("Date")) hit(c.start, "Date()", -1, -1, "");
          return;
        }
        const name = memberName(c);
        if (name === null || c.type !== "MemberExpression" || c.object.type !== "Identifier" || !live(c.object.name))
          return;
        const whole = CALLS.get(name);
        if (whole !== undefined && n.arguments.length === 0) hit(c.start, `${name}()`, n.start, n.end, whole);
        const callee = CALLEES.get(name);
        if (callee !== undefined) hit(c.start, name, c.start, c.end, callee);
      },
      NewExpression: (n) => {
        if (n.callee.type !== "Identifier" || n.callee.name !== "Date" || !live("Date")) return;
        if (n.arguments.length === 0) hit(n.start, "new Date()", n.start, n.end, "new Date(ctx.clock.now())");
      },
      MemberExpression: (n) => {
        if (handled.has(n.start) || n.object.type !== "Identifier" || !live(n.object.name)) return;
        const name = memberName(n);
        if (name !== null && MEMBERS.has(name)) hit(n.start, name, -1, -1, "");
        else if (n.object.name === "localStorage") hit(n.start, "localStorage", -1, -1, "");
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
