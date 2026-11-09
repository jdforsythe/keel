import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { isEffect } from "./isEffect.ts";
import { rt } from "./rt.ts";

/**
 * Raise `n` to `state`. Effects and resources are queued and stop the mark (a resource notifies its
 * readers itself when it settles); computeds pass Check on to their observers.
 */
export function mark(n: Node, state: number): void {
  if (n.state === State.Running)
    throw fail("E1202", "dependency cycle: a computation invalidated itself while running");
  if (n.state >= state) return;
  const effect = isEffect(n);
  if (n.state === State.Clean && effect) rt.queue.push(n);
  n.state = state;
  if (!effect) for (const o of n.observers) mark(o, State.Check);
}
