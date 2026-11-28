import { replaced } from "./replaced.ts";

/** `nodes`, each server island root that re-rendered replaced by the nodes in its place. */
export function nodesOf(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((n) => {
    const r = replaced.get(n);
    return r === undefined ? [n] : nodesOf(r);
  });
}
