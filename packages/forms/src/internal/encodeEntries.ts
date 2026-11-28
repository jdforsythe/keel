import type { Node } from "./Node.ts";
import { formatValue } from "./formatValue.ts";
import { isRecord } from "./isRecord.ts";
import { unwrap } from "./unwrap.ts";

const LEAVES = ["string", "number", "int", "boolean", "literal", "enum", "id"];
const join = (prefix: string, name: string): string => (prefix === "" ? name : `${prefix}.${name}`);
const tagOf = (variant: Node, key: string): unknown => {
  const f = variant.kind === "object" ? variant.fields[key] : undefined;
  return f?.kind === "literal" ? f.value : undefined;
};

/**
 * Append the string entries for `x` under `key`, the inverse of k.schema decodeStrings: dotted keys for
 * objects, records and union variants; repeated keys for arrays of leaves (indexed dotted keys otherwise);
 * null as the empty string; absent optionals omitted.
 */
export function encodeEntries(node: Node, key: string, x: unknown, add: (key: string, text: string) => void): void {
  if (x === undefined) return;
  switch (node.kind) {
    case "optional":
      encodeEntries(node.inner, key, x, add);
      break;
    case "format":
      encodeEntries(node.base, key, x, add);
      break;
    case "nullable":
      if (x === null) add(key, "");
      else encodeEntries(node.inner, key, x, add);
      break;
    case "array":
      if (!Array.isArray(x)) break;
      for (const [i, item] of x.entries()) {
        if (LEAVES.includes(unwrap(node.item).kind)) add(key, formatValue(item));
        else encodeEntries(node.item, join(key, String(i)), item, add);
      }
      break;
    case "object":
      if (!isRecord(x)) break;
      for (const [name, f] of Object.entries(node.fields)) encodeEntries(f, join(key, name), x[name], add);
      break;
    case "record":
      if (!isRecord(x)) break;
      for (const [name, v] of Object.entries(x)) encodeEntries(node.value, join(key, name), v, add);
      break;
    case "union": {
      if (!isRecord(x)) break;
      const variant = node.variants.find((v) => tagOf(v, node.key) === x[node.key]);
      if (variant !== undefined) encodeEntries(variant, key, x, add);
      break;
    }
    default:
      add(key, formatValue(x));
  }
}
