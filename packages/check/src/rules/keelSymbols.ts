import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { KEEL_SYMBOL_MESSAGE } from "../internal/KEEL_SYMBOL_MESSAGE.ts";
import { findingAt } from "../internal/findingAt.ts";
import { inKernel } from "../internal/inKernel.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The names of the global object `getOwnPropertySymbols` and `ownKeys` may not list (k.realm The keel. names). */
const GLOBAL_OBJECT: ReadonlySet<string> = new Set(["globalThis", "window", "self", "global"]);

/**
 * E1766 (k.realm The keel. names): in app code and a library's file, `Symbol.for` given a string that folds to one
 * starting `keel.` (a literal, a template without substitution, a `const` bound to either, `+` of those), and
 * `Object.getOwnPropertySymbols` or `Reflect.ownKeys` given `globalThis`, `window`, `self` or `global`, each at the
 * call. `Symbol`, `Object` and `Reflect` are the globals, through aliases, not names the file binds (`globalRefs`).
 * The kernel's own packages name these symbols. This is the reading without the type pass; with it, `calleeUses` finds
 * each callee by symbol (k.unsafe One path). No fix.
 */
export const keelSymbols: RuleDef = {
  code: "E1766",
  message: KEEL_SYMBOL_MESSAGE,
  see: "k.realm",
  check: ({ file, ast, types }) => {
    if (types === true || !isAppPath(file.path) || inKernel(file.path)) return [];
    const g = globalRefs(ast);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (arg === undefined || arg.type === "SpreadElement") return;
        const callee = g.resolve(n.callee)?.join(".");
        if (callee === "Symbol.for") {
          if (g.constString(arg)?.startsWith("keel.") === true) out.push(findingAt(file, n.start));
        } else if (callee === "Object.getOwnPropertySymbols" || callee === "Reflect.ownKeys") {
          if (arg.type === "Identifier" && GLOBAL_OBJECT.has(arg.name)) out.push(findingAt(file, n.start));
        }
      },
    }).visit(ast);
    return out;
  },
};
