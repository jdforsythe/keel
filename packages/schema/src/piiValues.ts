import type { Schema } from "./Schema.ts";
import type { Node } from "./internal/Node.ts";
import { fits } from "./internal/fits.ts";
import { isRecord } from "./internal/isRecord.ts";
import { variantOf } from "./internal/variantOf.ts";

/** Every string and number in a JSON value. */
function collect(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (value !== "") out.add(value);
  } else if (typeof value === "number") out.add(String(value));
  else if (Array.isArray(value)) for (const v of value) collect(v, out);
  else if (isRecord(value)) for (const v of Object.values(value)) collect(v, out);
}

/**
 * The distinct non-empty strings and numbers (as `String()`) under a marked path of `value`, a valid encoded
 * value of `schema`, in the order met (k.privacy). A secret's marker is not one.
 */
export function piiValues(schema: Schema<unknown, boolean>, value: unknown): readonly string[] {
  const out = new Set<string>();
  const walk = (node: Node, x: unknown, inherited: boolean): void => {
    const marked = inherited || node.pii !== undefined;
    switch (node.kind) {
      case "secret":
        return;
      case "optional":
      case "nullable":
        walk(node.inner, x, marked);
        return;
      case "format":
        walk(node.base, x, marked);
        return;
      case "array":
        if (Array.isArray(x)) for (const v of x) walk(node.item, v, marked);
        return;
      case "record":
        if (isRecord(x)) for (const v of Object.values(x)) walk(node.value, v, marked);
        return;
      case "object":
        if (isRecord(x))
          for (const [k, f] of Object.entries(node.fields)) if (Object.hasOwn(x, k)) walk(f, x[k], marked);
        return;
      case "union": {
        const variant = isRecord(x) ? variantOf(node, x[node.key]) : undefined;
        if (variant !== undefined) walk(variant, x, marked);
        return;
      }
      case "anyOf": {
        const member = node.members.find((m) => fits(m, x));
        if (member !== undefined) walk(member, x, marked);
        return;
      }
      default:
        if (marked) collect(x, out);
    }
  };
  walk(schema.node, value, false);
  return [...out];
}
