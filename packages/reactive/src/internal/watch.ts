import type { Node } from "./Node.ts";
import { createNode } from "./createNode.ts";
import { flush } from "./flush.ts";
import { rt } from "./rt.ts";

/** Create an effect node, queue its first run, and commit unless a batch or flush is open. */
export function watch(fn: () => void, writes: readonly unknown[]): Node {
  const n = createNode(
    () => {
      fn();
      return false;
    },
    true,
    writes,
  );
  rt.queue.push(n);
  flush();
  return n;
}
