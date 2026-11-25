import type { Node } from "./Node.ts";

/**
 * Freezes `node` and every object and array under it, without recursion, and returns `node`. A subtree that is
 * already frozen is skipped: every node `make` sees is built from fresh objects over nodes it froze before, so a
 * frozen object there is frozen deep, and a schema built from other schemas costs only its own new objects.
 */
export function freezeNode(node: Node): Node {
  for (const todo: unknown[] = [node]; todo.length > 0; ) {
    const o = todo.pop();
    if (typeof o === "object" && o !== null && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const v of Object.values(o)) todo.push(v);
    }
  }
  return node;
}
