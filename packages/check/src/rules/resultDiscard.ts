import { type Node, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1453 (k.errors) without the type pass: an expression statement, bare or under `void` and `await`, that calls a name
 * this file declares to return `Result` from `@keel/schema` or `Promise` of one (a function's or an arrow's return
 * annotation, or a `const` annotated with a function type), inside a function given to `attempt` too. With the type
 * pass, `typeCheck` reports every discarded `Result` by its type (`resultDiscards`). No fix.
 */
export const resultDiscard: RuleDef = {
  code: "E1453",
  message: "Result discarded: narrow on r.ok and handle r.error",
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (types === true || !isAppPath(file.path)) return [];
    const results = localNames(ast, "Result", "@keel/schema");
    if (results.size === 0) return [];
    const isResult = (t: Node | null | undefined): boolean => {
      if (t?.type !== "TSTypeReference" || t.typeName.type !== "Identifier") return false;
      if (results.has(t.typeName.name)) return true;
      return t.typeName.name === "Promise" && isResult(t.typeArguments?.params[0]);
    };
    const returnsResult = (n: Node | null | undefined): boolean => {
      if (n === null || n === undefined) return false;
      if (n.type === "TSFunctionType") return isResult(n.returnType.typeAnnotation);
      if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression")
        return isResult(n.returnType?.typeAnnotation);
      return false;
    };
    const named = new Set<string>();
    const statements: Node[] = [];
    new Visitor({
      FunctionDeclaration: (n) => {
        if (n.id !== null && isResult(n.returnType?.typeAnnotation)) named.add(n.id.name);
      },
      TSDeclareFunction: (n) => {
        if (n.id !== null && isResult(n.returnType?.typeAnnotation)) named.add(n.id.name);
      },
      VariableDeclarator: (n) => {
        if (n.id.type !== "Identifier") return;
        if (returnsResult(n.id.typeAnnotation?.typeAnnotation) || returnsResult(n.init)) named.add(n.id.name);
      },
      ExpressionStatement: (n) => void statements.push(n),
    }).visit(ast);
    const callee = (e: Node): string | undefined => {
      if (e.type === "ParenthesizedExpression") return callee(e.expression);
      if (e.type === "AwaitExpression") return callee(e.argument);
      if (e.type === "UnaryExpression" && e.operator === "void") return callee(e.argument);
      return e.type === "CallExpression" && e.callee.type === "Identifier" ? e.callee.name : undefined;
    };
    const out: Finding[] = [];
    for (const s of statements) {
      if (s.type !== "ExpressionStatement") continue;
      const name = callee(s.expression);
      if (name !== undefined && named.has(name)) out.push(findingAt(file, s.start));
    }
    return out;
  },
};
