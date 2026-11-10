import type { Expression } from "oxc-parser";
import type { ToolKind } from "./ToolKind.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

/** The kind of a param schema written as `s.string()`, `s.int()`, `s.number()`, `s.enum([...])`, `line()` or `para()`. */
export function kindAt(e: Expression): ToolKind {
  const x = unwrap(e);
  if (x.type !== "CallExpression") return "unknown";
  const c = x.callee;
  const name =
    c.type === "Identifier" ? c.name : c.type === "MemberExpression" && !c.computed ? c.property.name : undefined;
  if (name === "line" || name === "para" || name === "string") return "string";
  if (name === "int" || name === "number") return "number";
  const list = x.arguments[0];
  if (name !== "enum" || list === undefined || list.type === "SpreadElement") return "unknown";
  const arr = unwrap(list);
  if (arr.type !== "ArrayExpression") return "unknown";
  const values = arr.elements.flatMap((el) =>
    el === null || el.type === "SpreadElement" ? [] : [stringOf(el)?.value ?? ""],
  );
  return values.length === arr.elements.length && !values.includes("") ? values : "unknown";
}
