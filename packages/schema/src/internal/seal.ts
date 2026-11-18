import { Secret } from "../Secret.ts";
import type { Node } from "./Node.ts";
import { fits } from "./fits.ts";
import { isRecord } from "./isRecord.ts";
import { variantOf } from "./variantOf.ts";

/**
 * Wrap every raw value at a `secret` node in a Secret, copying the containers above it (undeclared keys kept), and
 * add each value it wraps to `made`, for the caller to freeze once the whole value passes its check. Values that do
 * not fit their node, the redaction marker and existing secrets are left for `check` to judge.
 */
export function seal(node: Node, x: unknown, made: unknown[] = []): unknown {
  switch (node.kind) {
    case "secret": {
      if (Secret.is(x) || x === Secret.marker) return x;
      const v = seal(node.inner, x, made);
      made.push(v);
      return Secret.of(v, node.inner);
    }
    case "optional":
    case "nullable":
      return x === null ? x : seal(node.inner, x, made);
    case "format":
      return seal(node.base, x, made);
    case "array":
      return Array.isArray(x) ? x.map((v: unknown) => seal(node.item, v, made)) : x;
    case "record":
      return isRecord(x) ? Object.fromEntries(Object.keys(x).map((k) => [k, seal(node.value, x[k], made)])) : x;
    case "object":
      if (!isRecord(x)) return x;
      return {
        ...x,
        ...Object.fromEntries(
          Object.entries(node.fields)
            .filter(([k]) => Object.hasOwn(x, k))
            .map(([k, f]) => [k, seal(f, x[k], made)]),
        ),
      };
    case "union": {
      const variant = isRecord(x) ? variantOf(node, x[node.key]) : undefined;
      return variant === undefined ? x : seal(variant, x, made);
    }
    case "anyOf":
      for (const member of node.members) {
        const mine: unknown[] = [];
        const sealed = seal(member, x, mine);
        if (fits(member, sealed)) {
          made.push(...mine);
          return sealed;
        }
      }
      return x;
    default:
      return x;
  }
}
