import { isBlank } from "@keel/schema/internal";
import type { SchemaNode } from "./SchemaNode.ts";

type Bounds = { readonly min?: number | undefined; readonly max?: number | undefined };

/** Whether the bounds of `inner` lie within those of `outer`, an absent bound unbounded. */
const within = (inner: Bounds, outer: Bounds): boolean =>
  (outer.min === undefined || (inner.min !== undefined && inner.min >= outer.min)) &&
  (outer.max === undefined || (inner.max !== undefined && inner.max <= outer.max));

/** The node without its `pii` mark, which changes no value it holds. */
const bare = (n: SchemaNode): unknown => JSON.stringify({ ...n, pii: undefined });

/** Whether the scalar leaf `target` parses `value`, as k.schema validates it; any other kind refuses. */
function accepts(target: SchemaNode, value: string | number | boolean): boolean {
  switch (target.kind) {
    case "string":
      if (typeof value !== "string" || (target.min >= 1 && isBlank(value))) return false;
      return value.length >= target.min && (target.max === undefined || value.length <= target.max);
    case "enum":
      return typeof value === "string" && target.values.includes(value);
    case "literal":
      return value === target.value;
    case "id":
      return typeof value === "string" && value.length > 0;
    case "number":
      return typeof value === "number" && Number.isFinite(value) && within({ min: value, max: value }, target);
    case "int":
      return typeof value === "number" && Number.isSafeInteger(value) && within({ min: value, max: value }, target);
    default:
      return false;
  }
}

/**
 * Whether a guarded page's params field `page` fits its redirect route's field `target` (k.guards Carried params):
 * the same node, or one of the same type with the same options (an `id` of the same brand), or one holding only
 * values the target accepts: an `enum` or `literal` each of whose values `target` parses, a `string`, `number` or
 * `int` whose bounds lie within the target's of the same type, or an `int` within a `number` target's. Anything else
 * does not fit.
 */
export function paramFits(page: SchemaNode, target: SchemaNode): boolean {
  if (page === target || bare(page) === bare(target)) return true;
  if (page.kind === "enum") return page.values.every((v) => accepts(target, v));
  if (page.kind === "literal") return accepts(target, page.value);
  if (page.kind === "string" && target.kind === "string") return within(page, target);
  if (page.kind === "number" && target.kind === "number") return within(page, target);
  if (page.kind === "int" && (target.kind === "int" || target.kind === "number")) return within(page, target);
  return false;
}
