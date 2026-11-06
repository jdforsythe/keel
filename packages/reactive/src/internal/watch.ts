import type { Node } from "./Node.ts";
import { createNode } from "./createNode.ts";
import { flush } from "./flush.ts";
import { rt } from "./rt.ts";

/** Create an effect-like node, queue its first run, and commit unless a batch or flush is open. */
export function watch(kind: "effect" | "resource", fn: () => void, writes: readonly unknown[]): Node {
  const n = createNode(
    kind,
    () => {
      fn();
      return false;
    },
    writes,
  );
  rt.queue.push(n);
  flush();
  return n;
}
