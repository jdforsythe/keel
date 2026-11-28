import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { THROW_MESSAGE } from "../internal/THROW_MESSAGE.ts";
import { ensureImport } from "../internal/ensureImport.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { spelledKeelThrows } from "../internal/spelledKeelThrows.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1451 (k.errors): `throw`, a call of `Promise.reject`, or a `new Promise` executor that declares a second parameter
 * (at it) or is no function literal (at it), in app code, `unsafe(` ranges included. A `throw` of a `catch` clause's own
 * binding, in that clause and outside a function nested in it, is that catch's E1452 and not reported here.
 * `Promise.reject` is read here by spelling without the type pass, and by symbol in it (`calleeUses`, k.unsafe One
 * path). Fix (k.fixes Per code): a `throw` the type pass found to throw a `KeelError` directly in a function whose
 * return type takes `Result<never, E>` (`keelThrows`), or without the type pass one the file spells so
 * (`spelledKeelThrows`), becomes `return err(<e>)`, with the `err` import.
 */
export const noThrow: RuleDef = {
  code: "E1451",
  message: THROW_MESSAGE,
  see: "k.errors",
  check: ({ file, ast, types, keelThrows }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    const fixable = types === true ? (keelThrows ?? new Set<number>()) : spelledKeelThrows(ast, file.source);
    let depth = 0;
    const catches: { param: string; depth: number }[] = [];
    const enter = (): void => void depth++;
    const exit = (): void => void depth--;
    const g = globalRefs(ast);
    const promise = (name: string, at: number): boolean =>
      name === "Promise" && g.sameBinding("Promise", ast.start, at);
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (types === true || c.type !== "MemberExpression" || c.computed || c.property.name !== "reject") return;
        if (c.object.type === "Identifier" && promise(c.object.name, c.object.start))
          out.push(findingAt(file, c.property.start));
      },
      NewExpression: (n) => {
        const c = n.callee;
        if (c.type !== "Identifier" || !promise(c.name, c.start)) return;
        const run = n.arguments[0];
        if (run === undefined) return;
        if (run.type === "ArrowFunctionExpression" || run.type === "FunctionExpression") {
          const second = run.params[1];
          if (second !== undefined) out.push(findingAt(file, second.start));
        } else out.push(findingAt(file, run.start));
      },
      CatchClause: (n) => void catches.push({ param: n.param?.type === "Identifier" ? n.param.name : "", depth }),
      "CatchClause:exit": () => void catches.pop(),
      FunctionDeclaration: enter,
      "FunctionDeclaration:exit": exit,
      FunctionExpression: enter,
      "FunctionExpression:exit": exit,
      ArrowFunctionExpression: enter,
      "ArrowFunctionExpression:exit": exit,
      ThrowStatement: (n) => {
        const a = n.argument;
        if (a.type === "Identifier" && catches.some((c) => c.param === a.name && c.depth === depth)) return;
        out.push(
          findingAt(file, n.start, {
            start: n.start,
            argStart: a.start,
            argEnd: a.end,
            fixable: fixable.has(n.start) ? 1 : 0,
          }),
        );
      },
    }).visit(ast);
    return out;
  },
  fix: (f, { file, ast }) => {
    if (num(f.data, "fixable", 0) !== 1) return null;
    const start = num(f.data, "start");
    const argStart = num(f.data, "argStart");
    const argEnd = num(f.data, "argEnd");
    if (start < 0 || argStart < 0 || argEnd < 0 || !file.source.startsWith("throw", start)) return null;
    return [
      ...ensureImport(ast, "err", "@keel/schema"),
      { start, end: argStart, text: "return err(" },
      { start: argEnd, end: argEnd, text: ")" },
    ];
  },
};
