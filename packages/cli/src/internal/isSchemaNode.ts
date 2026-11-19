import type { SchemaNode } from "./SchemaNode.ts";
import { isRecord } from "./isRecord.ts";

const num = (x: unknown): boolean => x === undefined || typeof x === "number";

/** A k.schema node read back from evaluated app code (`schema.node`), checked kind by kind. */
export function isSchemaNode(x: unknown): x is SchemaNode {
  if (!isRecord(x)) return false;
  switch (x.kind) {
    case "string":
      return typeof x.min === "number" && num(x.max);
    case "number":
    case "int":
      return num(x.min) && num(x.max);
    case "boolean":
    case "json":
      return true;
    case "literal":
      return ["string", "number", "boolean"].includes(typeof x.value);
    case "enum":
      return Array.isArray(x.values) && x.values.every((v) => typeof v === "string");
    case "id":
      return typeof x.brand === "string";
    case "object":
      return (
        isRecord(x.fields) &&
        Object.values(x.fields).every(isSchemaNode) &&
        (x.closed === undefined || typeof x.closed === "boolean")
      );
    case "array":
      return isSchemaNode(x.item);
    case "record":
      return isSchemaNode(x.value);
    case "union":
      return typeof x.key === "string" && Array.isArray(x.variants) && x.variants.every(isSchemaNode);
    case "anyOf":
      return Array.isArray(x.members) && x.members.every(isSchemaNode);
    case "nullable":
    case "optional":
    case "secret":
      return isSchemaNode(x.inner);
    case "format":
      return typeof x.name === "string" && isSchemaNode(x.base);
    default:
      return false;
  }
}
