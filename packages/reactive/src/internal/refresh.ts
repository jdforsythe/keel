import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { dispose } from "./dispose.ts";
import { rt } from "./rt.ts";
import { unlink } from "./unlink.ts";

/** Bring `n` up to date: verify Check sources in order, rerun only if one actually changed. */
export function refresh(n: Node): void {
  if (n.gone) return;
  // Sources in read order; stop at the first one whose change made `n` Dirty.
  for (let i = 0; n.state === State.Check && i < n.sources.length; i++) {
    const s = n.sources[i];
    if (s) refresh(s);
  }
  const fn = n.fn;
  if (n.state !== State.Dirty || fn === undefined) {
    if (n.state === State.Check) n.state = State.Clean;
    return;
  }
  const kids = n.owned;
  n.owned = [];
  for (const k of kids) dispose(k);
  unlink(n);
  const prevReaction = rt.reaction;
  const prevOwner = rt.owner;
  rt.reaction = n;
  rt.owner = n;
  n.state = State.Running;
  let ok = false;
  let changed = false;
  try {
    changed = fn();
    ok = true;
  } finally {
    rt.reaction = prevReaction;
    rt.owner = prevOwner;
    // A failed computed stays Dirty so the next read retries; a failed effect waits for its next change.
    n.state = ok || n.effect ? State.Clean : State.Dirty;
  }
  if (changed) for (const o of n.observers) if (o.state === State.Check) o.state = State.Dirty;
}
