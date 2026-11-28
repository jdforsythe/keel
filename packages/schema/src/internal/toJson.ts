import type { JsonValue } from "../JsonValue.ts";
import type { Node } from "./Node.ts";
import { SECRET_MARKER } from "./SECRET_MARKER.ts";
import { copyJson } from "./copyJson.ts";
import { fits } from "./fits.ts";
import { isRecord } from "./isRecord.ts";
import { variantOf } from "./variantOf.ts";

/** Copy an already-validated value into plain JSON, keeping only declared keys. Absent stays absent. */
export function toJson(node: Node, value: unknown): JsonValue {
  if (node.kind === "secret") return SECRET_MARKER;
  if (node.kind === "format") return toJson(node.base, value);
  const member = node.kind === "anyOf" ? node.members.find((m) => fits(m, value)) : undefined;
  if (member !== undefined) return toJson(member, value);
  if (node.kind === "json") return copyJson(value);
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (node.kind === "optional" || node.kind === "nullable") return toJson(node.inner, value);
  if (node.kind === "array" && Array.isArray(value)) {
    const list: readonly unknown[] = value;
    return list.map((v) => toJson(node.item, v));
  }
  if (isRecord(value)) {
    if (node.kind === "record")
      return Object.fromEntries(Object.keys(value).map((k) => [k, toJson(node.value, value[k])]));
    if (node.kind === "object")
      return Object.fromEntries(
        Object.entries(node.fields)
          .filter(([k]) => Object.hasOwn(value, k))
          .map(([k, f]) => [k, toJson(f, value[k])]),
      );
    const variant = node.kind === "union" ? variantOf(node, value[node.key]) : undefined;
    if (variant) return toJson(variant, value);
  }
  throw new Error("value cannot be encoded by this schema");
}
