import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import { derefNode } from "./derefNode.ts";
import { dimensionText } from "./dimensionText.ts";
import { memberOf } from "./memberOf.ts";

/** The dimension in field `key` of object `node` (an alias taken to its value), or undefined when absent or not a dimension. */
export function compositeDimension(reach: Reach, node: JsonNode, key: string): string | undefined {
  const field = memberOf(node, key)?.value;
  const value = field === undefined ? undefined : derefNode(reach, field);
  return value === undefined ? undefined : dimensionText(value);
}
