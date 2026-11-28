import { globalRefs } from "@keel/compiler/internal";
import { type Expression, Visitor } from "oxc-parser";
import { KEEL_SYMBOL_MESSAGE } from "../internal/KEEL_SYMBOL_MESSAGE.ts";
import { findingAt } from "../internal/findingAt.ts";
import { inKernel } from "../internal/inKernel.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The names of the global object (k.realm The keel. names). */
const GLOBAL_OBJECT: ReadonlySet<string> = new Set(["globalThis", "window", "self", "global"]);
/** The listings of own keys that yield symbol keys or their values. */
const LISTINGS: ReadonlySet<string> = new Set([
  "Object.getOwnPropertySymbols",
  "Object.getOwnPropertyDescriptors",
  "Reflect.ownKeys",
]);

/**
 * E1766 (k.realm The keel. names): in app code and a library's file, `Symbol.for` given a string that folds to one
 * starting `keel.` (a literal, a template without substitution, a `const` bound to either, `+` of those); a listing of
 * the global object's own symbol keys (`Object.getOwnPropertySymbols`, `Object.getOwnPropertyDescriptors`,
 * `Reflect.ownKeys`); and a copy that carries them (a spread of it, `Object.assign` given it as a source), each at the
 * call or spread. Without the type pass the global object is one of its names, a global path resolving to one (a member
 * by those names, an alias), `Reflect.get` of one by a literal of those names, or `Object(e)` or `new Object(e)` of one.
 * `Symbol`, `Object` and `Reflect` are the globals, through aliases, not names the file binds (`globalRefs`). The
 * kernel's own packages name these symbols. With the type pass, `calleeUses` finds each by symbol and type. No fix.
 */
export const keelSymbols: RuleDef = {
  code: "E1766",
  message: KEEL_SYMBOL_MESSAGE,
  see: "k.realm",
  check: ({ file, ast, types }) => {
    if (types === true || !isAppPath(file.path) || inKernel(file.path)) return [];
    const g = globalRefs(ast);
    const isGlobal = (e: Expression, depth: number): boolean => {
      if (depth > 8) return false;
      if (e.type === "ParenthesizedExpression") return isGlobal(e.expression, depth + 1);
      if (e.type === "Identifier" && GLOBAL_OBJECT.has(e.name)) return true;
      if (e.type === "CallExpression" || e.type === "NewExpression") {
        const callee = g.resolve(e.callee)?.join(".");
        const [a, b] = e.arguments;
        if (a === undefined || a.type === "SpreadElement") return false;
        if (callee === "Object") return isGlobal(a, depth + 1);
        if (callee === "Reflect.get" && e.type === "CallExpression" && b !== undefined && b.type !== "SpreadElement")
          return GLOBAL_OBJECT.has(g.constString(b) ?? "") && isGlobal(a, depth + 1);
        return false;
      }
      const path = g.resolve(e);
      return path !== null && path.length === 1 && GLOBAL_OBJECT.has(path[0] ?? "");
    };
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (arg === undefined || arg.type === "SpreadElement") return;
        const callee = g.resolve(n.callee)?.join(".");
        if (callee === "Symbol.for") {
          if (g.constString(arg)?.startsWith("keel.") === true) out.push(findingAt(file, n.start));
        } else if (callee !== undefined && LISTINGS.has(callee)) {
          if (isGlobal(arg, 0)) out.push(findingAt(file, n.start));
        } else if (callee === "Object.assign") {
          if (n.arguments.slice(1).some((a) => a.type !== "SpreadElement" && isGlobal(a, 0)))
            out.push(findingAt(file, n.start));
        }
      },
      ObjectExpression: (n) => {
        for (const p of n.properties)
          if (p.type === "SpreadElement" && isGlobal(p.argument, 0)) out.push(findingAt(file, p.start));
      },
      JSXSpreadAttribute: (n) => {
        if (isGlobal(n.argument, 0)) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
