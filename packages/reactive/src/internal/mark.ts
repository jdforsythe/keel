import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { rt } from "./rt.ts";

/** Raise `n` to `state`, queue it if it is an effect, and mark its observers Check. */
export function mark(n: Node, state: number): void {
  if (n.state === State.Running)
    throw fail("E1202", "dependency cycle: a computation invalidated itself while running");
  if (n.state >= state) return;
  if (n.state === State.Clean && n.effect) rt.queue.push(n);
  n.state = state;
  for (const o of n.observers) mark(o, State.Check);
}
