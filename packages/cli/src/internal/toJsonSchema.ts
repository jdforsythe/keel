import type { JsonSchema } from "./JsonSchema.ts";
import type { SchemaNode } from "./SchemaNode.ts";

/** Derive the JSON Schema of a k.schema node (used for MCP tool input and output schemas). */
export function toJsonSchema(node: SchemaNode): JsonSchema {
  switch (node.kind) {
    case "string":
      return {
        type: "string",
        ...(node.min > 0 ? { minLength: node.min } : {}),
        ...(node.max === undefined ? {} : { maxLength: node.max }),
      };
    case "number":
      return { type: "number" };
    case "int":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "literal":
      return { const: node.value };
    case "enum":
      return { type: "string", enum: [...node.values] };
    case "id":
      return { type: "string" };
    case "object": {
      const entries = Object.entries(node.fields);
      return {
        type: "object",
        properties: Object.fromEntries(entries.map(([k, f]) => [k, toJsonSchema(f)])),
        required: entries.filter(([, f]) => f.kind !== "optional").map(([k]) => k),
        additionalProperties: false,
      };
    }
    case "array":
      return { type: "array", items: toJsonSchema(node.item) };
    case "record":
      return { type: "object", additionalProperties: toJsonSchema(node.value) };
    case "union":
      return { oneOf: node.variants.map(toJsonSchema) };
    case "nullable":
      return { anyOf: [toJsonSchema(node.inner), { type: "null" }] };
    case "optional":
      return toJsonSchema(node.inner);
  }
}
