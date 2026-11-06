import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { refresh } from "./refresh.ts";
import { rt } from "./rt.ts";

/** Read `n`: subscribe the running computation to it, then bring it up to date. */
export function track(n: Node): void {
  if (n.state === State.Running) throw fail("E1202", "dependency cycle: a computed read itself");
  const r = rt.reaction;
  if (r && !n.gone && !r.sources.includes(n)) {
    r.sources.push(n);
    n.observers.push(r);
  }
  refresh(n);
}
