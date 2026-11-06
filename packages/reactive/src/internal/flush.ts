import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { refresh } from "./refresh.ts";
import { rt } from "./rt.ts";

/** Effects may write and queue more effects; a commit that never settles is a cycle. */
const MAX_PASSES = 1000;

/**
 * Commit: run queued effects until none are stale. No-op inside a batch or an ongoing flush.
 * A throwing effect does not stop the commit: every queued effect runs, then the first error is rethrown.
 */
export function flush(): void {
  if (rt.depth > 0 || rt.flushing) return;
  rt.flushing = true;
  let failure: { error: unknown } | null = null;
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
        failure ??= { error };
      }
    }
  }
  rt.flushing = false;
  if (failure) throw failure.error;
}
