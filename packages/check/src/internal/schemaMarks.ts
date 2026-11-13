import type { Argument, Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { followValue } from "./followValue.ts";

type Verdict = "marked" | "clean" | "unknown";
const worst = (a: Verdict, b: Verdict): Verdict =>
  a === "marked" || b === "marked" ? "marked" : a === "unknown" || b === "unknown" ? "unknown" : "clean";

/**
 * Whether the schema expression `expr` holds a `.pii(...)` mark (k.privacy E1111), read through consts, imports,
 * re-exports, namespace members, spreads, array and object arguments and schema method chains. `unknown` when a
 * part cannot be read statically: a call whose callee is not a member (a factory), or a binding it cannot follow.
 */
export function schemaMarks(
  expr: Expression | Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  seen: Set<string> = new Set(),
): Verdict {
  if (expr.type === "SpreadElement") return schemaMarks(expr.argument, file, project, seen);
  const at = followValue(expr, file, project);
  if (at === "package" || at === "global") return "clean";
  if (at === null) return "unknown";
  const key = `${at.file.path}:${at.expr.start}:${at.expr.end}`;
  if (seen.has(key)) return "clean";
  seen.add(key);
  const e = at.expr;
  const sub = (x: Expression | Argument | null): Verdict =>
    x === null ? "clean" : schemaMarks(x, at.file, project, seen);
  switch (e.type) {
    case "CallExpression": {
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed) return "unknown";
      if (c.property.name === "pii") return "marked";
      // `s.object(...)` reads `s` from a package; `X.optional()` reads `X`.
      return e.arguments.map(sub).reduce(worst, sub(c.object));
    }
    case "ObjectExpression":
      return e.properties.map((p) => (p.type === "Property" ? sub(p.value) : sub(p))).reduce(worst, "clean");
    case "ArrayExpression":
      return e.elements.map((x) => (x === null ? "clean" : sub(x))).reduce(worst, "clean");
    case "ConditionalExpression":
      return worst(sub(e.consequent), sub(e.alternate));
    case "MemberExpression":
      return e.computed ? "unknown" : sub(e.object);
    case "Literal":
    case "TemplateLiteral":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "UnaryExpression":
      return "clean";
    default:
      return "unknown";
  }
}
