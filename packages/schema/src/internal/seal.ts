import { Secret } from "../Secret.ts";
import type { Node } from "./Node.ts";
import { fits } from "./fits.ts";
import { isRecord } from "./isRecord.ts";
import { variantOf } from "./variantOf.ts";

/**
 * Wrap every raw value at a `secret` node in a Secret, copying the containers above it (undeclared keys kept).
 * Values that do not fit their node, the redaction marker and existing secrets are left for `check` to judge.
 */
export function seal(node: Node, x: unknown): unknown {
  switch (node.kind) {
    case "secret":
      return Secret.is(x) || x === Secret.marker ? x : Secret.of(seal(node.inner, x));
    case "optional":
    case "nullable":
      return x === null ? x : seal(node.inner, x);
    case "array":
      return Array.isArray(x) ? x.map((v: unknown) => seal(node.item, v)) : x;
    case "record":
      return isRecord(x) ? Object.fromEntries(Object.keys(x).map((k) => [k, seal(node.value, x[k])])) : x;
    case "object":
      if (!isRecord(x)) return x;
      return {
        ...x,
        ...Object.fromEntries(
          Object.entries(node.fields)
            .filter(([k]) => Object.hasOwn(x, k))
            .map(([k, f]) => [k, seal(f, x[k])]),
        ),
      };
    case "union": {
      const variant = isRecord(x) ? variantOf(node, x[node.key]) : undefined;
      return variant === undefined ? x : seal(variant, x);
    }
    case "anyOf":
      for (const member of node.members) {
        const sealed = seal(member, x);
        if (fits(member, sealed)) return sealed;
      }
      return x;
    default:
      return x;
  }
}
