import { partsOf } from "../internal/partsOf.ts";

/** The nodes, already in place, that a fragment `frag` returned while resuming stands for; undefined for any other node. */
export function parts(node: Node): readonly Node[] | undefined {
  return partsOf.get(node);
}
