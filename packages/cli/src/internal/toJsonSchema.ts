import type { JsonSchema } from "./JsonSchema.ts";
import type { SchemaNode } from "./SchemaNode.ts";

const SAFE = Number.MAX_SAFE_INTEGER;

/**
 * Inclusive bounds as JSON Schema keywords. Integers always carry the safe-integer range (parse rejects
 * anything else with rule `int`).
 */
function bounds(node: { readonly min?: number; readonly max?: number }, safe: boolean) {
  const min = safe ? Math.max(node.min ?? -SAFE, -SAFE) : node.min;
  const max = safe ? Math.min(node.max ?? SAFE, SAFE) : node.max;
  return {
    ...(min === undefined ? {} : { minimum: min }),
    ...(max === undefined ? {} : { maximum: max }),
  };
}

/** Derive the JSON Schema of a k.schema node (used for MCP tool input and output schemas). */
export function toJsonSchema(node: SchemaNode): JsonSchema {
  switch (node.kind) {
    case "secret":
      return toJsonSchema(node.inner);
    case "format":
      return { ...toJsonSchema(node.base), format: node.name };
    case "string":
      // Residual mismatch: parse counts UTF-16 units, JSON Schema counts code points. The two agree for
      // strings without astral characters (surrogate pairs); parse stays authoritative.
      return {
        type: "string",
        ...(node.min > 0 ? { minLength: node.min } : {}),
        ...(node.max === undefined ? {} : { maxLength: node.max }),
      };
    case "number":
      return { type: "number", ...bounds(node, false) };
    case "int":
      return { type: "integer", ...bounds(node, true) };
    case "boolean":
      return { type: "boolean" };
    case "literal":
      return { const: node.value };
    case "enum":
      return { type: "string", enum: [...node.values] };
    case "json":
      return {};
    case "id":
      return { type: "string", minLength: 1 };
    case "object": {
      const entries = Object.entries(node.fields);
      return {
        type: "object",
        properties: Object.fromEntries(entries.map(([k, f]) => [k, toJsonSchema(f)])),
        required: entries.filter(([, f]) => f.kind !== "optional").map(([k]) => k),
        ...(node.closed === true ? { additionalProperties: false } : {}),
      };
    }
    case "array":
      return { type: "array", items: toJsonSchema(node.item) };
    case "record":
      return { type: "object", additionalProperties: toJsonSchema(node.value) };
    case "union":
      return { oneOf: node.variants.map(toJsonSchema) };
    case "anyOf":
      return { anyOf: node.members.map(toJsonSchema) };
    case "nullable":
      return { anyOf: [toJsonSchema(node.inner), { type: "null" }] };
    case "optional":
      return toJsonSchema(node.inner);
  }
}
