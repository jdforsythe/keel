import type { PiiClass } from "./PiiClass.ts";
import type { PiiPath } from "./PiiPath.ts";
import type { Schema } from "./Schema.ts";
import type { Node } from "./internal/Node.ts";

/**
 * Each marked leaf of `schema` once, in declaration order: its dotted path (`*` for an array item or record
 * value) and the class of the nearest mark above it (k.privacy). A marked open object adds `<object>.*` (`*` at the
 * root) after its fields, for the keys it does not declare. A `format` is read through to its base, as `piiValues`
 * reads it.
 */
export function piiPaths(schema: Schema<unknown, boolean>): readonly PiiPath[] {
  const out: PiiPath[] = [];
  const seen = new Set<string>();
  const walk = (node: Node, prefix: readonly string[], inherited: PiiClass | undefined): void => {
    const cls = node.pii ?? inherited;
    switch (node.kind) {
      case "optional":
      case "nullable":
        walk(node.inner, prefix, cls);
        return;
      case "format":
        walk(node.base, prefix, cls);
        return;
      case "array":
        walk(node.item, [...prefix, "*"], cls);
        return;
      case "record":
        walk(node.value, [...prefix, "*"], cls);
        return;
      case "object":
        for (const [k, f] of Object.entries(node.fields)) walk(f, [...prefix, k], cls);
        // An open object's undeclared keys, as one leaf `*` under the class in force.
        if (node.closed !== true) walk({ kind: "json" }, [...prefix, "*"], cls);
        return;
      case "union":
        for (const v of node.variants) walk(v, prefix, cls);
        return;
      case "anyOf":
        for (const m of node.members) walk(m, prefix, cls);
        return;
      default: {
        const path = prefix.join(".");
        if (cls === undefined || seen.has(path)) return;
        seen.add(path);
        out.push({ path, class: cls });
      }
    }
  };
  walk(schema.node, [], undefined);
  return out;
}
