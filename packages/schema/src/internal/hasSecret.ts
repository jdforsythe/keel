import type { Node } from "./Node.ts";

/** True when a `secret` node occurs anywhere in the tree, so `parse` must wrap raw values. */
export function hasSecret(node: Node): boolean {
  switch (node.kind) {
    case "secret":
      return true;
    case "optional":
    case "nullable":
      return hasSecret(node.inner);
    case "array":
      return hasSecret(node.item);
    case "record":
      return hasSecret(node.value);
    case "object":
      return Object.values(node.fields).some(hasSecret);
    case "union":
      return node.variants.some(hasSecret);
    case "anyOf":
      return node.members.some(hasSecret);
    default:
      return false;
  }
}
