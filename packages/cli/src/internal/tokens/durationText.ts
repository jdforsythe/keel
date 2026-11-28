import type { JsonNode } from "./JsonNode.ts";
import { dimensionText } from "./dimensionText.ts";

/** A DTCG duration (`{ value, unit }` or a string such as `200ms`) as `200ms`; undefined for another form. */
export function durationText(node: JsonNode): string | undefined {
  return dimensionText(node, ["ms", "s"]);
}
