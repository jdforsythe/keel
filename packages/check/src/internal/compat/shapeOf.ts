import type { Shape } from "./Shape.ts";
import { isRecord } from "./isRecord.ts";

const n = (x: unknown): number | undefined => (typeof x === "number" ? x : undefined);

/**
 * The kind a JSON Schema node encodes, as `routes.json` and `surface.json` write k.schema nodes: `{}` is `s.json()`,
 * `anyOf`/`oneOf` a union (nullable is `anyOf` with `{ type: 'null' }`), `const` a literal, `enum` an enum, then by
 * `type`; an object with `properties` is an object (closed with `additionalProperties: false`), one with only a schema
 * in `additionalProperties` a record. Anything else is `unknown`, which only `s.json()` accepts.
 */
export function shapeOf(x: unknown): Shape {
  if (!isRecord(x)) return { kind: "unknown" };
  const members = x.anyOf ?? x.oneOf;
  if (Array.isArray(members)) return { kind: "union", members };
  if (Object.hasOwn(x, "const")) return { kind: "const", value: x.const };
  if (Array.isArray(x.enum)) return { kind: "enum", values: x.enum };
  switch (x.type) {
    case undefined:
      return Object.keys(x).length === 0 ? { kind: "any" } : { kind: "unknown" };
    case "string":
      return { kind: "string", min: n(x.minLength) ?? 0, max: n(x.maxLength), format: x.format };
    case "number":
    case "integer":
      return { kind: "number", int: x.type === "integer", min: n(x.minimum), max: n(x.maximum) };
    case "boolean":
    case "null":
      return { kind: x.type };
    case "array":
      return { kind: "array", items: x.items };
    case "object": {
      const extra = x.additionalProperties;
      if (!isRecord(x.properties)) return isRecord(extra) ? { kind: "record", value: extra } : { kind: "unknown" };
      const required = Array.isArray(x.required) ? x.required.filter((k) => typeof k === "string") : [];
      return { kind: "object", props: x.properties, required: new Set(required), closed: extra === false };
    }
    default:
      return { kind: "unknown" };
  }
}
