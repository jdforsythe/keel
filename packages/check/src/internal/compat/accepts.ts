import { canonicalJson } from "../canonicalJson.ts";
import type { Refusal } from "./Refusal.ts";
import type { Shape } from "./Shape.ts";
import { admits } from "./admits.ts";
import { shapeOf } from "./shapeOf.ts";

const no = (path: readonly string[], why: Refusal["why"]): Refusal => ({ path, why });

/** Bounds of `b` inside those of `a` (an absent bound is unbounded). */
const within = (a: number | undefined, b: number | undefined, low: boolean): boolean =>
  a === undefined || (b !== undefined && (low ? b >= a : b <= a));

function first(checks: Iterable<() => Refusal | null>): Refusal | null {
  for (const c of checks) {
    const r = c();
    if (r !== null) return r;
  }
  return null;
}

/** `a` (a record's value or a closed or open object) accepts every field of the object `b`. */
function fieldsInto(a: unknown, b: Shape & { kind: "object" }, path: readonly string[]): Refusal | null {
  return first(Object.keys(b.props).map((k) => () => accepts(a, b.props[k], [...path, k])));
}

function sameKind(a: Shape, b: Shape, path: readonly string[]): Refusal | null {
  switch (a.kind) {
    case "string":
      if (b.kind !== "string") return no(path, "type");
      if (a.format !== undefined && a.format !== b.format) return no(path, "format");
      return a.min <= b.min && within(a.max, b.max, false) ? null : no(path, "bounds");
    case "number":
      if (b.kind !== "number" || (a.int && !b.int)) return no(path, "type");
      return within(a.min, b.min, true) && within(a.max, b.max, false) ? null : no(path, "bounds");
    case "boolean":
    case "null":
      return b.kind === a.kind ? null : no(path, "type");
    case "array":
      return b.kind === "array" ? accepts(a.items, b.items, [...path, "[]"]) : no(path, "type");
    case "record":
      if (b.kind === "record") return accepts(a.value, b.value, [...path, "*"]);
      if (b.kind !== "object") return no(path, "type");
      return fieldsInto(a.value, b, path) ?? (b.closed || shapeOf(a.value).kind === "any" ? null : no(path, "open"));
    case "object": {
      if (b.kind === "record") {
        const need = [...a.required].sort()[0];
        if (need !== undefined) return no([...path, need], "missing");
        if (a.closed) return no(path, "open");
        return first(Object.keys(a.props).map((k) => () => accepts(a.props[k], b.value, [...path, k])));
      }
      if (b.kind !== "object") return no(path, "type");
      const keys = Object.keys(a.props).sort();
      return first([
        ...[...a.required].sort().map((k) => () => (b.required.has(k) ? null : no([...path, k], "missing"))),
        ...keys.map((k) => () => (Object.hasOwn(b.props, k) ? accepts(a.props[k], b.props[k], [...path, k]) : null)),
        () => (a.closed && !b.closed ? no(path, "open") : null),
        ...Object.keys(b.props)
          .sort()
          .map((k) => () => (a.closed && !Object.hasOwn(a.props, k) ? no([...path, k], "extra") : null)),
      ]);
    }
    default:
      return no(path, a.kind === "const" || a.kind === "enum" ? "value" : "type");
  }
}

/**
 * Whether the JSON Schema `a` accepts `b` (k.compat Accepts): every value `b` admits parses with `a`, decided on
 * schema kinds, conservatively (`null` when it does; else the first refused field). `s.json()` accepts any; a union
 * `b` is accepted when each member is; a union `a` when one member accepts; literals and enums value by value; number
 * and string bounds inside; arrays and records by item; objects by required fields, field by field, and, when `a` is
 * closed, only a closed `b` with no other field. Two nodes of a kind it does not know are accepted only when equal.
 */
export function accepts(a: unknown, b: unknown, path: readonly string[] = []): Refusal | null {
  const A = shapeOf(a);
  const B = shapeOf(b);
  if (A.kind === "any") return null;
  if (B.kind === "union") return first(B.members.map((m) => () => accepts(a, m, path)));
  if (A.kind === "union") {
    const tries = A.members.map((m) => ({ kind: shapeOf(m).kind, r: accepts(m, b, path) }));
    if (tries.some((t) => t.r === null)) return null;
    return (tries.find((t) => t.kind === B.kind) ?? tries[0])?.r ?? no(path, "type");
  }
  if (B.kind === "const") return admits(a, B.value, path);
  if (B.kind === "enum") return first(B.values.map((v) => () => admits(a, v, path)));
  if (B.kind === "unknown" || A.kind === "unknown")
    return canonicalJson(a) === canonicalJson(b) ? null : no(path, "type");
  return sameKind(A, B, path);
}
