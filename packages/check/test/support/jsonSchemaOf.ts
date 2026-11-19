import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];
type Json = Readonly<Record<string, unknown>>;
const SAFE = Number.MAX_SAFE_INTEGER;

/** JSON Schema of a k.schema node as `keel build` writes it into `surface.json` (the cli's encoder, mirrored for tests). */
export function jsonSchemaOf(node: Node): Json {
  switch (node.kind) {
    case "secret":
    case "optional":
      return jsonSchemaOf(node.inner);
    case "format":
      return { ...jsonSchemaOf(node.base), format: node.name };
    case "string":
      return {
        type: "string",
        ...(node.min > 0 ? { minLength: node.min } : {}),
        ...(node.max === undefined ? {} : { maxLength: node.max }),
      };
    case "number":
      return {
        type: "number",
        ...(node.min === undefined ? {} : { minimum: node.min }),
        ...(node.max === undefined ? {} : { maximum: node.max }),
      };
    case "int":
      return {
        type: "integer",
        minimum: Math.max(node.min ?? -SAFE, -SAFE),
        maximum: Math.min(node.max ?? SAFE, SAFE),
      };
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
        properties: Object.fromEntries(entries.map(([k, f]) => [k, jsonSchemaOf(f)])),
        required: entries.filter(([, f]) => f.kind !== "optional").map(([k]) => k),
        ...(node.closed === true ? { additionalProperties: false } : {}),
      };
    }
    case "array":
      return { type: "array", items: jsonSchemaOf(node.item) };
    case "record":
      return { type: "object", additionalProperties: jsonSchemaOf(node.value) };
    case "union":
      return { oneOf: node.variants.map(jsonSchemaOf) };
    case "anyOf":
      return { anyOf: node.members.map(jsonSchemaOf) };
    case "nullable":
      return { anyOf: [jsonSchemaOf(node.inner), { type: "null" }] };
  }
}
