import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import { compositeColor } from "./compositeColor.ts";
import { compositeDimension } from "./compositeDimension.ts";
import { memberOf } from "./memberOf.ts";

const STYLES = ["solid", "dashed", "dotted", "double"];

/** A DTCG border `{ color, width, style }` as `<width> <style> <color>`; undefined when a part is missing, the style is not one of `solid`, `dashed`, `dotted` and `double`, or the color has alpha. */
export function borderText(reach: Reach, node: JsonNode): { text: string; converted?: string } | undefined {
  const c = memberOf(node, "color")?.value;
  const color = c === undefined ? undefined : compositeColor(reach, c);
  const width = compositeDimension(reach, node, "width");
  const style = memberOf(node, "style")?.value;
  if (color === undefined || color.alpha === true || width === undefined) return undefined;
  if (style?.kind !== "string" || !STYLES.includes(style.value)) return undefined;
  return {
    text: `${width} ${style.value} ${color.text}`,
    ...(color.space === undefined ? {} : { converted: color.space }),
  };
}
