import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { isEffect } from "./isEffect.ts";
import { refresh } from "./refresh.ts";
import { rt } from "./rt.ts";

/** Read `n`: subscribe the running computation to it (unless that one is disposed), then pull it. */
export function track(n: Node): void {
  if (n.state === State.Running) throw fail("E1202", "dependency cycle: a computation read itself");
  const r = rt.reaction;
  if (r && !r.gone && !r.sources.includes(n)) {
    r.sources.push(n);
    n.observers.push(r);
  }
  if (!isEffect(n)) refresh(n);
}
