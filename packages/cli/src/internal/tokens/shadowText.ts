import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import { compositeColor } from "./compositeColor.ts";
import { compositeDimension } from "./compositeDimension.ts";
import { memberOf } from "./memberOf.ts";

/**
 * A DTCG shadow (one object, or an array of them) as the `shadow` form: `[inset ]<x> <y> <blur> <spread> <color>` each,
 * joined by `, `, a color's alpha kept. Undefined when a part is missing or unreadable. `converted` names the spaces
 * a color was turned into Oklch from.
 */
export function shadowText(reach: Reach, node: JsonNode): { text: string; converted: string[] } | undefined {
  const layers = node.kind === "array" ? node.items : [node];
  const converted: string[] = [];
  const parts: string[] = [];
  for (const layer of layers) {
    const c = memberOf(layer, "color")?.value;
    const color = c === undefined ? undefined : compositeColor(reach, c);
    const x = compositeDimension(reach, layer, "offsetX");
    const y = compositeDimension(reach, layer, "offsetY");
    if (color === undefined || x === undefined || y === undefined) return undefined;
    const blur = memberOf(layer, "blur") === undefined ? "0px" : compositeDimension(reach, layer, "blur");
    const spread = memberOf(layer, "spread") === undefined ? "0px" : compositeDimension(reach, layer, "spread");
    if (blur === undefined || spread === undefined) return undefined;
    const inset = memberOf(layer, "inset")?.value;
    if (color.space !== undefined) converted.push(color.space);
    parts.push(
      `${inset?.kind === "literal" && inset.value === true ? "inset " : ""}${x} ${y} ${blur} ${spread} ${color.text}`,
    );
  }
  return parts.length === 0 || parts.length > 4 ? undefined : { text: parts.join(", "), converted };
}
