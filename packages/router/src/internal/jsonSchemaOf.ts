import type { JsonValue } from "@keel/schema";
import type { SchemaNode } from "./SchemaNode.ts";

const sorted = (o: Readonly<Record<string, JsonValue>>): JsonValue =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k] ?? null]),
  );

/** JSON Schema for a schema node, keys sorted (routes.json, k.compiler). Optional unwraps; ids keep their brand. */
export function jsonSchemaOf(node: SchemaNode): JsonValue {
  switch (node.kind) {
    case "secret":
      return jsonSchemaOf(node.inner);
    case "string":
      return sorted(
        node.max === undefined
          ? { type: "string", minLength: node.min }
          : { type: "string", minLength: node.min, maxLength: node.max },
      );
    case "number":
      return sorted({ type: "number" });
    case "int":
      return sorted({ type: "integer" });
    case "boolean":
      return sorted({ type: "boolean" });
    case "literal":
      return sorted({ const: node.value });
    case "enum":
      return sorted({ type: "string", enum: [...node.values] });
    case "json":
      return {};
    case "id":
      return sorted({ type: "string", minLength: 1, "x-keel-id": node.brand });
    case "object": {
      const entries = Object.entries(node.fields);
      return sorted({
        type: "object",
        properties: sorted(Object.fromEntries(entries.map(([k, f]) => [k, jsonSchemaOf(f)]))),
        ...(node.closed === true ? { additionalProperties: false } : {}),
        required: entries
          .filter(([, f]) => f.kind !== "optional")
          .map(([k]) => k)
          .sort(),
      });
    }
    case "array":
      return sorted({ type: "array", items: jsonSchemaOf(node.item) });
    case "record":
      return sorted({ type: "object", additionalProperties: jsonSchemaOf(node.value) });
    case "union":
      return sorted({ oneOf: node.variants.map(jsonSchemaOf) });
    case "anyOf":
      return sorted({ anyOf: node.members.map(jsonSchemaOf) });
    case "nullable":
      return sorted({ anyOf: [jsonSchemaOf(node.inner), sorted({ type: "null" })] });
    case "optional":
      return jsonSchemaOf(node.inner);
  }
}
