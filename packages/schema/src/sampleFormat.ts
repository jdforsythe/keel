import type { JsonValue } from "./JsonValue.ts";
import type { Schema } from "./Schema.ts";
import { formats } from "./internal/formats.ts";
import { toJson } from "./internal/toJson.ts";

type SchemaNode = Schema<unknown, boolean>["node"];

/**
 * An encoded value of format node `node` built without fast-check: `sample` gives an encoded value of the format's
 * `from` schema, which its `map` turns into a candidate. Undefined when the node has no in-memory format (a
 * deserialized node) or the candidate fails `check`.
 */
export function sampleFormat(node: SchemaNode, sample: (from: SchemaNode) => JsonValue): JsonValue | undefined {
  const impl = node.kind === "format" ? formats.get(node) : undefined;
  if (impl === undefined) return undefined;
  const candidate = impl.map(sample(impl.from));
  return impl.test(candidate) ? toJson(node, candidate) : undefined;
}
