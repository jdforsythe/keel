import { State } from "./State.ts";
import { fail } from "./fail.ts";
import { refresh } from "./refresh.ts";
import { rt } from "./rt.ts";

/** Effects may write and queue more effects; a commit that never settles is a cycle. */
const MAX_PASSES = 1000;

/** Commit: run queued effects until none are stale. No-op inside a batch or an ongoing flush. */
export function flush(): void {
  if (rt.depth > 0 || rt.flushing) return;
  rt.flushing = true;
  try {
    for (let pass = 0; rt.queue.length > 0; pass++) {
      if (pass === MAX_PASSES) {
        for (const e of rt.queue) e.state = State.Clean;
        rt.queue = [];
        throw fail("E1202", "dependency cycle: effects kept invalidating each other");
      }
      const q = rt.queue;
      rt.queue = [];
      for (let i = 0; i < q.length; i++) {
        try {
          const e = q[i];
          if (e) refresh(e);
        } catch (err) {
          rt.queue = q.slice(i + 1).concat(rt.queue);
          throw err;
        }
      }
    }
  } finally {
    rt.flushing = false;
  }
}
