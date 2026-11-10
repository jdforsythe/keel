import type { JsonValue } from "../JsonValue.ts";
import type { Node } from "./Node.ts";
import { formats } from "./formats.ts";
import { toJson } from "./toJson.ts";

/**
 * An encoded value of format node `node` built without fast-check: `sample` gives an encoded value of the format's
 * `from` schema, which its `map` turns into a candidate. Undefined when the node has no in-memory format (a
 * deserialized node) or the candidate fails `check`.
 */
export function sampleFormat(node: Node, sample: (from: Node) => JsonValue): JsonValue | undefined {
  const impl = node.kind === "format" ? formats.get(node) : undefined;
  if (impl === undefined) return undefined;
  const candidate = impl.map(sample(impl.from));
  return impl.test(candidate) ? toJson(node, candidate) : undefined;
}
