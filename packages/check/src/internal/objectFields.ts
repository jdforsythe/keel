import type { ObjectProperty } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { At } from "./compat/At.ts";
import { resolveExpr } from "./compat/resolveExpr.ts";
import { keyName } from "./keyName.ts";

/**
 * The fields of the `s.object({...})` schema `expr` resolves to (through consts and relative imports), each with its
 * value resolved, or `null` when that cannot be read statically (another call, a spread, a computed key).
 */
export function objectFields(
  at: At | null,
  project: readonly SourceFile[],
):
  | { readonly name: string; readonly prop: ObjectProperty; readonly file: SourceFile; readonly value: At | null }[]
  | null {
  if (at === null) return null;
  const e = at.expr;
  if (e.type !== "CallExpression" || e.callee.type !== "MemberExpression" || e.callee.computed) return null;
  const { object, property } = e.callee;
  if (object.type !== "Identifier" || !at.src.s.has(object.name) || property.name !== "object") return null;
  const arg = e.arguments[0];
  if (arg?.type !== "ObjectExpression") return null;
  const out = [];
  for (const p of arg.properties) {
    const name = p.type === "Property" ? keyName(p) : null;
    if (p.type !== "Property" || name === null) return null;
    out.push({ name, prop: p, file: at.file, value: resolveExpr(p.value, at.file, project, at.src) });
  }
  return out;
}
