import type { Argument } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaAnswer } from "./SchemaAnswer.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { followRef } from "./followRef.ts";
import { mutatedBinding } from "./mutatedBinding.ts";

const worst = (a: SchemaAnswer, b: SchemaAnswer): SchemaAnswer =>
  a === "yes" || b === "yes" ? "yes" : a === "unknown" || b === "unknown" ? "unknown" : "no";

/**
 * The schema walk E1111, E1107 and `schemaHolds` share (k.privacy-reads Readers): `expr` in `file` read through
 * `const`s, project imports and re-exports, namespace members, object literal fields, spreads, array elements, call
 * arguments, a call's receiver (`X.optional()` reads `X`) and both branches of `?:`, each part asked `q`. `yes` when
 * a part answers `yes`; else `unknown` when a part cannot be read: a call whose callee is not a member (a factory) and
 * that `q.call` does not answer, a binding it cannot follow, a computed member, an object literal's getter, setter or
 * method, or a binding the file changes after its literal; else `no`. A part reached twice answers `no` the second time.
 */
export function schemaRead(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  q: SchemaQuestion,
  seen: Set<string> = new Set(),
): SchemaAnswer {
  if (expr.type === "SpreadElement") return schemaRead(expr.argument, file, project, q, seen);
  const at = followRef(expr, file, project);
  if (at === "global") return q.global;
  if (at === null) return "unknown";
  if ("package" in at) return q.pkg(at);
  const key = `${at.file.path}:${at.expr.start}:${at.expr.end}`;
  if (seen.has(key)) return "no";
  seen.add(key);
  const e = at.expr;
  if (mutatedBinding(e, at.file)) return "unknown";
  const sub = (x: Argument | null): SchemaAnswer => (x === null ? "no" : schemaRead(x, at.file, project, q, seen));
  switch (e.type) {
    case "CallExpression": {
      const own = q.call?.(e, at.file, sub);
      if (own !== undefined) return own;
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed) return "unknown";
      // `s.object(...)` reads `s` from a package; `X.optional()` reads `X`.
      return e.arguments.map(sub).reduce(worst, sub(c.object));
    }
    case "ObjectExpression":
      // A getter, setter or method runs code to give its field, so its schema cannot be read statically.
      return e.properties
        .map(
          (p): SchemaAnswer =>
            p.type !== "Property" ? sub(p) : p.kind !== "init" || p.method ? "unknown" : sub(p.value),
        )
        .reduce(worst, "no");
    case "ArrayExpression":
      return e.elements.map((x) => (x === null ? "no" : sub(x))).reduce(worst, "no");
    case "ConditionalExpression":
      return worst(sub(e.consequent), sub(e.alternate));
    case "MemberExpression":
      return e.computed ? "unknown" : sub(e.object);
    case "Literal":
    case "TemplateLiteral":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "UnaryExpression":
      return "no";
    default:
      return "unknown";
  }
}
