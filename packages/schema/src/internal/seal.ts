import { Secret } from "../Secret.ts";
import type { Node } from "./Node.ts";
import { fits } from "./fits.ts";
import { plainEntries } from "./plainEntries.ts";
import { plainItems } from "./plainItems.ts";
import { variantOf } from "./variantOf.ts";

/**
 * Wrap every raw value at a `secret` node in a Secret, copying the containers above it (undeclared keys kept), and
 * add each value it wraps to `made`, for the caller to freeze once the whole value passes its check. Only a plain
 * container (k.schema Plain data) is copied, read through its descriptors, so a getter never runs and a key the copy
 * would drop is never dropped; anything else, the redaction marker and existing secrets are left as given for
 * `check` to judge. Each array it builds goes into `copies`: a new array of a plain array's items, plain by
 * construction, which `check` and `freeze` then read without its descriptors.
 */
export function seal(node: Node, x: unknown, made: unknown[] = [], copies: Set<object> = new Set()): unknown {
  switch (node.kind) {
    case "secret": {
      if (Secret.is(x) || x === Secret.marker) return x;
      const v = seal(node.inner, x, made, copies);
      made.push(v);
      return Secret.of(v, node.inner);
    }
    case "optional":
    case "nullable":
      return x === null ? x : seal(node.inner, x, made, copies);
    case "format":
      return seal(node.base, x, made, copies);
    case "array": {
      const items = plainItems(x);
      if (items === undefined) return x;
      const out = items.map((v: unknown) => seal(node.item, v, made, copies));
      copies.add(out);
      return out;
    }
    case "record": {
      const own = plainEntries(x);
      if (own === undefined) return x;
      const out: Record<string, unknown> = {};
      own.keys.forEach((k, i) => {
        out[k] = seal(node.value, own.values[i], made, copies);
      });
      return out;
    }
    case "object": {
      const own = plainEntries(x);
      if (own === undefined) return x;
      const out: Record<string, unknown> = {};
      own.keys.forEach((k, i) => {
        const field = Object.hasOwn(node.fields, k) ? node.fields[k] : undefined;
        out[k] = field === undefined ? own.values[i] : seal(field, own.values[i], made, copies);
      });
      return out;
    }
    case "union": {
      const own = plainEntries(x);
      const at = own === undefined ? -1 : own.keys.indexOf(node.key);
      const variant = own === undefined || at < 0 ? undefined : variantOf(node, own.values[at]);
      return variant === undefined ? x : seal(variant, x, made, copies);
    }
    case "anyOf":
      for (const member of node.members) {
        const mine: unknown[] = [];
        const sealed = seal(member, x, mine, copies);
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
