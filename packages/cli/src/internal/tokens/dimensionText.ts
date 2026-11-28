import type { JsonNode } from "./JsonNode.ts";
import { fmtNumber } from "./fmtNumber.ts";
import { memberOf } from "./memberOf.ts";

/** A DTCG dimension (`{ value, unit }` or a string such as `8px`) as `8px`, with units from `units`; undefined for a negative or another form. */
export function dimensionText(node: JsonNode, units: readonly string[] = ["px", "rem", "em"]): string | undefined {
  if (node.kind === "string") {
    const m = /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(node.value);
    return m?.[2] !== undefined && units.includes(m[2]) ? node.value : undefined;
  }
  const v = memberOf(node, "value")?.value;
  const u = memberOf(node, "unit")?.value;
  if (v?.kind !== "number" || u?.kind !== "string" || v.value < 0 || !units.includes(u.value)) return undefined;
  return `${fmtNumber(v.value)}${u.value}`;
}
