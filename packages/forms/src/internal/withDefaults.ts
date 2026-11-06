import type { Node } from "./Node.ts";
import { isRecord } from "./isRecord.ts";

/**
 * Fill absent required boolean keys with false, as k.schema decodeStrings does (an unchecked checkbox is
 * absent from FormData). Recurses into present objects only; other values are returned unchanged.
 */
export function withDefaults(node: Node, x: unknown): unknown {
  if (node.kind !== "object" || !isRecord(x)) return x;
  const out: Record<string, unknown> = { ...x };
  for (const [key, field] of Object.entries(node.fields)) {
    if (!Object.hasOwn(x, key)) {
      if (field.kind === "boolean") out[key] = false;
    } else out[key] = withDefaults(field, x[key]);
  }
  return out;
}
