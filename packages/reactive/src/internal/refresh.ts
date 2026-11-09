import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { disposeOwned } from "./disposeOwned.ts";
import { isEffect } from "./isEffect.ts";
import { rt } from "./rt.ts";
import { unlink } from "./unlink.ts";

/** Bring `n` up to date: verify Check sources in order, rerun only if one actually changed. */
export function refresh(n: Node): void {
  if (n.gone || n.failed) return;
  // Sources in read order; stop at the first one whose change made `n` Dirty. Effects are never pulled.
  for (let i = 0; n.state === State.Check && i < n.sources.length; i++) {
    const s = n.sources[i];
    if (s && !isEffect(s)) refresh(s);
  }
  const fn = n.fn;
  if (n.state !== State.Dirty || fn === undefined) {
    if (n.state === State.Check) n.state = State.Clean;
    return;
  }
  disposeOwned(n);
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
    // A failed effect waits for its next change; any other node whose run threw stays Dirty (a computed keeps its
    // own error and never throws here).
    n.state = ok || isEffect(n) ? State.Clean : State.Dirty;
    // Disposed while running: free what the rest of the run created.
    if (n.gone) {
      disposeOwned(n);
      unlink(n);
    }
  }
  if (changed) for (const o of n.observers) if (o.state === State.Check) o.state = State.Dirty;
}
