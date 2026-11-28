import { type Node, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { schemaCallee } from "../internal/schemaCallee.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The keys a `KeelError` object literal holds. */
const KEYS = ["code", "message", "data"];

/** Whether the argument's own form shows it is no `KeelError`; a name or a call needs the type pass. */
function noKeelError(n: Node): boolean {
  if (n.type === "ParenthesizedExpression") return noKeelError(n.expression);
  if (n.type === "Literal" || n.type === "TemplateLiteral" || n.type === "NewExpression") return true;
  if (n.type === "ArrayExpression" || n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression")
    return true;
  if (n.type !== "ObjectExpression") return false;
  if (n.properties.some((p) => p.type === "SpreadElement" || p.computed)) return false;
  const keys = n.properties.flatMap((p) =>
    p.type === "Property" && p.key.type === "Identifier"
      ? [p.key.name]
      : p.type === "Property" && p.key.type === "Literal"
        ? [String(p.key.value)]
        : [],
  );
  return KEYS.some((k) => !keys.includes(k));
}

/**
 * E1458 (k.attempt): `err` from `@keel/schema` given a value whose type is no `KeelError`, at the argument. Without the
 * type pass the argument's form decides (a literal, a `new` expression, an array, a function, an object literal
 * without `code`, `message` and `data`); with it the type pass reports the argument TypeScript refuses
 * (`typeCheck`). No fix (k.fixes Per code).
 */
export const errKeelError: RuleDef = {
  code: "E1458",
  message: "err takes a KeelError: declare it with s.error(code, data) and pass X.make(data)",
  see: "k.attempt",
  check: ({ file, ast, types }) => {
    if (types === true || !isAppPath(file.path)) return [];
    const isErr = schemaCallee(ast, "err");
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (!isErr(n.callee) || arg === undefined || arg.type === "SpreadElement") return;
        if (noKeelError(arg)) out.push(findingAt(file, arg.start));
      },
    }).visit(ast);
    return out;
  },
};
