import type { Node } from "./Node.ts";

const walk = (node: Node, path: readonly string[]): readonly string[] | null => {
  switch (node.kind) {
    case "secret":
      return path;
    case "optional":
    case "nullable":
      return walk(node.inner, path);
    case "format":
      return walk(node.base, path);
    case "array":
      return walk(node.item, path);
    case "record":
      return walk(node.value, path);
    case "object":
      for (const [k, v] of Object.entries(node.fields)) {
        const hit = walk(v, [...path, k]);
        if (hit !== null) return hit;
      }
      return null;
    case "union":
      return first(node.variants, path);
    case "anyOf":
      return first(node.members, path);
    default:
      return null;
  }
};

const first = (nodes: readonly Node[], path: readonly string[]): readonly string[] | null => {
  for (const n of nodes) {
    const hit = walk(n, path);
    if (hit !== null) return hit;
  }
  return null;
};

/**
 * The object-key path (`creds.token`, `""` for the root) of the first `secret` node in the tree, or null when
 * there is none. Array items, record values and union members add no segment.
 */
export function secretPathOf(node: Node): string | null {
  const hit = walk(node, []);
  return hit === null ? null : hit.join(".");
}
