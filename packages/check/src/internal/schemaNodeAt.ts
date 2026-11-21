import type { Argument, CallExpression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { followRef } from "./followRef.ts";
import { mutatedBinding } from "./mutatedBinding.ts";
import { propertyOf } from "./propertyOf.ts";

const MAX_HOPS = 16;
type At = { readonly call: CallExpression; readonly name: string; readonly file: SourceFile };

/** Whether `e` in `file` is the `@keel/schema` namespace: its `s` export or a namespace import of the package. */
function isSchemaNs(e: Argument, file: SourceFile, project: readonly SourceFile[]): boolean {
  if (e.type === "SpreadElement") return false;
  const at = followRef(e, file, project);
  return (
    at !== null &&
    at !== "global" &&
    "package" in at &&
    at.package === "@keel/schema" &&
    (at.name === "s" || at.name === "*")
  );
}

/** The `s.<name>(…)` call `e` is, followed as `schemaHolds` follows it, trailing method calls passed over; else null. */
function schemaCall(e: Argument, file: SourceFile, project: readonly SourceFile[], hops: number): At | null {
  if (e.type === "SpreadElement" || hops > MAX_HOPS) return null;
  const at = followRef(e, file, project);
  if (at === null || at === "global" || "package" in at || mutatedBinding(at.expr, at.file)) return null;
  const call = at.expr;
  if (call.type !== "CallExpression") return null;
  const c = call.callee;
  if (c.type !== "MemberExpression" || c.computed) return null;
  if (isSchemaNs(c.object, at.file, project)) return { call, name: c.property.name, file: at.file };
  return schemaCall(c.object, at.file, project, hops + 1);
}

/**
 * The name of the `s.<name>(…)` call (`@keel/schema`) the schema `expr` of `file` holds at `path`, walked one segment
 * at a time through `s.object` fields (W1114). `null` where a step cannot be followed: a numeric segment, a field
 * that is not a plain `key: value`, an object literal holding a spread, a schema that is not such a call.
 */
export function schemaNodeAt(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  path: readonly string[],
): string | null {
  let at = schemaCall(expr, file, project, 0);
  for (const seg of path) {
    if (at === null || at.name !== "object" || /^\d+$/.test(seg)) return null;
    const arg = at.call.arguments[0];
    if (arg === undefined || arg.type === "SpreadElement") return null;
    const fields = followRef(arg, at.file, project);
    if (fields === null || fields === "global" || "package" in fields) return null;
    const obj = fields.expr;
    if (obj.type !== "ObjectExpression" || mutatedBinding(obj, fields.file)) return null;
    if (obj.properties.some((p) => p.type === "SpreadElement")) return null;
    const p = propertyOf(obj, seg);
    if (p === null || p.kind !== "init" || p.method || p.computed) return null;
    at = schemaCall(p.value, fields.file, project, 0);
  }
  return at?.name ?? null;
}
