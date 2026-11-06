import type { Expression, PropertyKey } from "oxc-parser";
import type { Analysis } from "./Analysis.ts";
import type { Shape } from "./Shape.ts";

const UNKNOWN: Shape = { kind: "unknown" };
const WRAPPERS: ReadonlySet<string> = new Set(["optional", "nullable", "default", "describe", "brand"]);

function unwrap(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression") return unwrap(e.expression);
  if (e.type === "TSNonNullExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression")
    return unwrap(e.expression);
  if (e.type === "ChainExpression" && e.expression.type === "MemberExpression") return unwrap(e.expression);
  return e;
}

function pathFrom(e: Expression, root: string): string[] | undefined {
  const x = unwrap(e);
  if (x.type === "Identifier") return x.name === root ? [] : undefined;
  if (x.type !== "MemberExpression" || x.computed || x.property.type !== "Identifier") return undefined;
  const base = pathFrom(x.object, root);
  return base === undefined ? undefined : [...base, x.property.name];
}

function keyName(k: PropertyKey): string | null {
  if (k.type === "Identifier") return k.name;
  if (k.type === "Literal" && typeof k.value === "string") return k.value;
  return null;
}

function shapeOf(a: Analysis, input: Expression, depth: number): Shape {
  if (depth > 12) return UNKNOWN;
  const e = unwrap(input);
  if (e.type === "Identifier") {
    const init = a.consts.get(e.name);
    return init === undefined ? UNKNOWN : shapeOf(a, init, depth + 1);
  }
  if (e.type !== "CallExpression" || e.callee.type !== "MemberExpression" || e.callee.computed) return UNKNOWN;
  const prop = e.callee.property;
  if (prop.type !== "Identifier") return UNKNOWN;
  if (WRAPPERS.has(prop.name) && e.callee.object.type === "CallExpression")
    return shapeOf(a, e.callee.object, depth + 1);
  const [first, second] = e.arguments;
  if (first === undefined || first.type === "SpreadElement") return UNKNOWN;
  switch (prop.name) {
    case "object": {
      if (first.type !== "ObjectExpression") return UNKNOWN;
      const fields = new Map<string, Shape>();
      for (const p of first.properties) {
        if (p.type !== "Property" || p.computed) continue;
        const k = keyName(p.key);
        if (k !== null) fields.set(k, shapeOf(a, p.value, depth + 1));
      }
      return { kind: "object", fields };
    }
    case "array":
      return { kind: "array", item: shapeOf(a, first, depth + 1) };
    case "literal":
      return first.type === "Literal" && first.value !== null
        ? { kind: "literal", value: String(first.value) }
        : UNKNOWN;
    case "union": {
      if (first.type !== "Literal" || typeof first.value !== "string") return UNKNOWN;
      if (second === undefined || second.type !== "ArrayExpression") return UNKNOWN;
      const key = first.value;
      const tags: string[] = [];
      for (const v of second.elements) {
        if (v === null || v.type === "SpreadElement") return UNKNOWN;
        const s = shapeOf(a, v, depth + 1);
        const tag = s.kind === "object" ? s.fields.get(key) : undefined;
        if (tag === undefined || tag.kind !== "literal") return UNKNOWN;
        tags.push(tag.value);
      }
      return { kind: "union", key, tags };
    }
    default:
      return UNKNOWN;
  }
}

/** Shape of `expr` when it reads a field path of the component's props (`props.a.b`) and `Props` is a schema. */
export function shapeAt(a: Analysis, expr: Expression, propsName: string | undefined): Shape {
  if (propsName === undefined) return UNKNOWN;
  const path = pathFrom(expr, propsName);
  const props = a.consts.get("Props");
  if (path === undefined || props === undefined) return UNKNOWN;
  let s = shapeOf(a, props, 0);
  for (const seg of path) {
    if (s.kind !== "object") return UNKNOWN;
    s = s.fields.get(seg) ?? UNKNOWN;
  }
  return s;
}
