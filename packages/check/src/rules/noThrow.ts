import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import { ensureImport } from "../internal/ensureImport.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1451 (k.errors): `throw`, or a call of `Promise.reject`, in app code, `unsafe(` ranges included; a bug is raised with
 * `defect`. Fix (a `throw` inside a function): `return err(<value>)`. `Promise.reject` is read here by spelling without
 * the type pass, and by symbol in it (`calleeUses`, k.unsafe One path).
 */
export const noThrow: RuleDef = {
  code: "E1451",
  message: "throw in app code; return err(...) when expected, defect(...) when a bug",
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    let depth = 0;
    const enter = (): void => void depth++;
    const exit = (): void => void depth--;
    const g = types === true ? undefined : globalRefs(ast);
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (g === undefined || c.type !== "MemberExpression" || c.computed || c.property.name !== "reject") return;
        if (
          c.object.type === "Identifier" &&
          c.object.name === "Promise" &&
          g.sameBinding("Promise", ast.start, c.object.start)
        )
          out.push(findingAt(file, c.property.start));
      },
      FunctionDeclaration: enter,
      "FunctionDeclaration:exit": exit,
      FunctionExpression: enter,
      "FunctionExpression:exit": exit,
      ArrowFunctionExpression: enter,
      "ArrowFunctionExpression:exit": exit,
      ThrowStatement: (n) =>
        void out.push(
          findingAt(file, n.start, {
            start: n.start,
            end: n.end,
            argStart: n.argument.start,
            argEnd: n.argument.end,
            inFunction: depth > 0 ? 1 : 0,
          }),
        ),
    }).visit(ast);
    return out;
  },
  fix: (f, { file, ast }) => {
    if (num(f.data, "inFunction", 0) !== 1) return null;
    const start = num(f.data, "start");
    const argStart = num(f.data, "argStart");
    const argEnd = num(f.data, "argEnd");
    if (start < 0 || argStart < 0 || argEnd < 0) return null;
    return [
      ...ensureImport(ast, "err", "@keel/schema"),
      { start, end: argStart, text: "return err(" },
      { start: argEnd, end: argEnd, text: ")" },
    ];
  },
};
