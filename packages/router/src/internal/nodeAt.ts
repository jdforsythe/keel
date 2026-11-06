import type { SchemaNode as Node } from "./SchemaNode.ts";
import { unwrapNode } from "./unwrapNode.ts";

const INDEX = /^(0|[1-9]\d*)$/;

/** The schema node at a path of segments, or undefined when the path is not in the schema. */
export function nodeAt(root: Node, segments: readonly (string | number)[]): Node | undefined {
  let node: Node | undefined = root;
  for (const raw of segments) {
    if (node === undefined) return undefined;
    const seg = String(raw);
    const n = unwrap(node);
    if (n.kind === "object") node = Object.hasOwn(n.fields, seg) ? n.fields[seg] : undefined;
    else if (n.kind === "array") node = INDEX.test(seg) ? n.item : undefined;
    else if (n.kind === "record") node = seg === "" ? undefined : n.value;
    else if (n.kind === "union")
      node = n.variants
        .map((v) => (v.kind === "object" && Object.hasOwn(v.fields, seg) ? v.fields[seg] : undefined))
        .find((f) => f !== undefined);
    else node = undefined;
  }
  return node;
}
