import type { Node } from "./Node.ts";
import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { findHandler } from "./findHandler.ts";
import { refresh } from "./refresh.ts";
import { rt } from "./rt.ts";

/** Effects may write and queue more effects; a commit that never settles is a cycle. */
const MAX_PASSES = 1000;

/**
 * Commit: run queued effects until none are stale. No-op inside a batch or an ongoing flush.
 * A throwing effect does not stop the commit: every queued effect runs, then the first error is rethrown.
 * An effect owned by a scope with `onError` is marked failed instead and its error delivered after the commit.
 */
export function flush(): void {
  if (rt.depth > 0 || rt.flushing) return;
  rt.flushing = true;
  let failure: { error: unknown } | null = null;
  const caught: { node: Node; error: unknown }[] = [];
  for (let pass = 0; rt.queue.length > 0; pass++) {
    if (pass === MAX_PASSES) {
      for (const e of rt.queue) e.state = State.Clean;
      rt.queue = [];
      failure ??= { error: fail("E1202", "dependency cycle: effects kept invalidating each other") };
      break;
    }
    const q = rt.queue;
    rt.queue = [];
    for (const e of q) {
      try {
        refresh(e);
      } catch (error) {
        if (findHandler(e)) {
          e.failed = true;
          caught.push({ node: e, error });
        } else failure ??= { error };
      }
    }
  }
  rt.flushing = false;
  const prev = rt.reaction;
  rt.reaction = null;
  for (const { node, error } of caught) {
    try {
      findHandler(node)?.(error);
    } catch (thrown) {
      failure ??= { error: thrown };
    }
  }
  rt.reaction = prev;
  if (failure) throw failure.error;
}
