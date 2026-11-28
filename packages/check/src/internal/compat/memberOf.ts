import type { ObjectProperty } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { propertyOf } from "../propertyOf.ts";
import type { At } from "./At.ts";
import { resolveExpr } from "./resolveExpr.ts";

/** The property `name` of the object literal `at` resolves to, with its value resolved; `null` when absent. */
export function memberOf(
  at: At | null,
  name: string,
  project: readonly SourceFile[],
): { readonly prop: ObjectProperty; readonly file: SourceFile; readonly value: At | null } | null {
  if (at === null || at.expr.type !== "ObjectExpression") return null;
  const prop = propertyOf(at.expr, name);
  return prop === null ? null : { prop, file: at.file, value: resolveExpr(prop.value, at.file, project, at.src) };
}
