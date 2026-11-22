import type { Argument, Expression } from "oxc-parser";

const MAX = 4096;

/** Folds the elements of an array literal, or null when one is a hole, a spread or does not fold. */
function foldAll(items: readonly (Expression | Argument | null)[]): string[] | null {
  const out: string[] = [];
  for (const e of items) {
    if (e === null || e.type === "SpreadElement") return null;
    const v = foldString(e);
    if (v === null) return null;
    out.push(v);
  }
  return out;
}

/**
 * The string `e` folds to from literals alone (k.escapes R1052): a string or number literal, a template whose
 * substitutions fold, `+`, `.join` of an array literal (`,` without a separator), `.concat`, `String.raw`, and
 * parentheses or a TypeScript wrapper around one; null when any part is not a literal.
 */
export function foldString(e: Expression): string | null {
  switch (e.type) {
    case "Literal":
      return typeof e.value === "string" ? e.value : typeof e.value === "number" ? String(e.value) : null;
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
      return foldString(e.expression);
    case "TemplateLiteral": {
      const parts = foldAll(e.expressions);
      if (parts === null) return null;
      return e.quasis.map((q, i) => `${q.value.cooked ?? q.value.raw}${parts[i] ?? ""}`).join("");
    }
    case "TaggedTemplateExpression": {
      const t = e.tag;
      const raw =
        t.type === "MemberExpression" &&
        !t.computed &&
        t.object.type === "Identifier" &&
        t.object.name === "String" &&
        t.property.type === "Identifier" &&
        t.property.name === "raw";
      const parts = raw ? foldAll(e.quasi.expressions) : null;
      return parts === null ? null : e.quasi.quasis.map((q, i) => `${q.value.raw}${parts[i] ?? ""}`).join("");
    }
    case "BinaryExpression": {
      if (e.operator !== "+") return null;
      const l = foldString(e.left);
      const r = l === null ? null : foldString(e.right);
      return l === null || r === null || l.length + r.length > MAX ? null : l + r;
    }
    case "CallExpression": {
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return null;
      const args = foldAll(e.arguments);
      if (args === null) return null;
      if (c.property.name === "join" && c.object.type === "ArrayExpression") {
        const items = foldAll(c.object.elements);
        return items === null || args.length > 1 ? null : items.join(args[0] ?? ",");
      }
      if (c.property.name === "concat") {
        const head = foldString(c.object);
        return head === null ? null : [head, ...args].join("");
      }
      return null;
    }
    default:
      return null;
  }
}
