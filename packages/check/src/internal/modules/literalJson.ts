import type { JsonValue } from "@keel/schema";
import type { Expression, ObjectProperty } from "oxc-parser";

type Out = { readonly ok: true; readonly value: JsonValue } | { readonly ok: false };
const NO: Out = { ok: false };

/** A static object key (identifier or string literal), or `null` when computed. */
function staticKey(p: ObjectProperty): string | null {
  if (p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  return p.key.type === "Literal" && typeof p.key.value === "string" ? p.key.value : null;
}

/**
 * The JSON value of a literal expression (RFC 0047 `std` config): strings, finite numbers (with unary `-`), booleans,
 * `null`, templates without substitutions, and arrays and objects of those. Anything else (calls, identifiers,
 * operators, spreads, computed keys) is not literal.
 */
export function literalJson(e: Expression): Out {
  switch (e.type) {
    case "ParenthesizedExpression":
      return literalJson(e.expression);
    case "Literal": {
      const v = e.value;
      if (v === null || typeof v === "string" || typeof v === "boolean") return { ok: true, value: v };
      return typeof v === "number" && Number.isFinite(v) ? { ok: true, value: v } : NO;
    }
    case "UnaryExpression": {
      if (e.operator !== "-" || e.argument.type !== "Literal" || typeof e.argument.value !== "number") return NO;
      return { ok: true, value: -e.argument.value };
    }
    case "TemplateLiteral": {
      const cooked = e.expressions.length === 0 ? e.quasis[0]?.value.cooked : undefined;
      return typeof cooked === "string" ? { ok: true, value: cooked } : NO;
    }
    case "ArrayExpression": {
      const out: JsonValue[] = [];
      for (const el of e.elements) {
        if (el === null || el.type === "SpreadElement") return NO;
        const r = literalJson(el);
        if (!r.ok) return NO;
        out.push(r.value);
      }
      return { ok: true, value: out };
    }
    case "ObjectExpression": {
      const out: { [k: string]: JsonValue } = {};
      for (const p of e.properties) {
        if (p.type !== "Property" || p.kind !== "init" || p.method) return NO;
        const k = staticKey(p);
        if (k === null) return NO;
        const r = literalJson(p.value);
        if (!r.ok) return NO;
        out[k] = r.value;
      }
      return { ok: true, value: out };
    }
    default:
      return NO;
  }
}
