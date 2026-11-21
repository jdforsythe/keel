import type { Schema } from "./Schema.ts";
import type { Node } from "./internal/Node.ts";
import { fits } from "./internal/fits.ts";
import { isRecord } from "./internal/isRecord.ts";
import { variantOf } from "./internal/variantOf.ts";

/** Every non-empty string, number and object key in a JSON value, in the order they stand, without recursion. */
function collect(value: unknown, out: Set<string>): void {
  for (const todo = [value]; todo.length > 0; ) {
    const v = todo.pop();
    if (typeof v === "string") {
      if (v !== "") out.add(v);
    } else if (typeof v === "number") out.add(String(v));
    else if (Array.isArray(v)) for (let i = v.length - 1; i >= 0; i--) todo.push(v[i]);
    else if (isRecord(v)) for (const [k, x] of Object.entries(v).reverse()) todo.push(x, k);
  }
}

/**
 * The distinct non-empty strings and numbers (as `String()`) under a marked path of `value`, a valid value of
 * `schema`, in the order met (k.privacy): also the keys of a marked record, and the undeclared keys and values a
 * parsed open object under a mark keeps. A secret's marker is not one.
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
        if (isRecord(x))
          for (const [k, v] of Object.entries(x)) {
            if (marked) collect(k, out);
            walk(node.value, v, marked);
          }
        return;
      case "object":
        if (!isRecord(x)) return;
        for (const [k, f] of Object.entries(node.fields)) if (Object.hasOwn(x, k)) walk(f, x[k], marked);
        // A parsed open object keeps undeclared keys; under a mark, their names and values are personal data too.
        if (marked && node.closed !== true)
          for (const [k, v] of Object.entries(x)) if (!Object.hasOwn(node.fields, k)) collect({ [k]: v }, out);
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
