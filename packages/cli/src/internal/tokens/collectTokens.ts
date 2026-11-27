import type { DesignToken } from "./DesignToken.ts";
import type { JsonNode } from "./JsonNode.ts";
import { memberOf } from "./memberOf.ts";

/** The tokens under `root`, a JSON object: an object holding `$value` is a token, any other object a group; keys beginning `$` are not names. A `$type` applies to the group it is in. */
export function collectTokens(root: JsonNode): DesignToken[] {
  const found: DesignToken[] = [];
  const walk = (node: JsonNode, path: readonly string[], inherited: string | undefined): void => {
    if (node.kind !== "object") return;
    const own = memberOf(node, "$type")?.value;
    const type = own?.kind === "string" ? own.value : inherited;
    const value = memberOf(node, "$value");
    if (value !== undefined && path.length > 0) {
      found.push({ path, type, value: value.value, valueAt: value.keyAt });
      return;
    }
    for (const m of node.members) if (!m.key.startsWith("$")) walk(m.value, [...path, m.key], type);
  };
  walk(root, [], undefined);
  return found;
}
