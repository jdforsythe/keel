import type { Clock } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { Cancelled } from "./Cancelled.schema.ts";

/** `run` once, `ms()` on `clock` after the last `push`; `cancel` drops a pending run. */
export function debounced(clock: Clock, ms: () => number, run: () => void): { push(): void; cancel(): void } {
  let pending: AbortController | undefined;
  const cancel = (): void => {
    pending?.abort();
    pending = undefined;
  };
  const push = (): void => {
    cancel();
    const mine = new AbortController();
    pending = mine;
    const waiting = clock.after(ms(), mine.signal);
    void attempt(
      () => waiting,
      (x) => (x === mine.signal.reason ? Cancelled.make({}) : undefined),
    ).then((waited) => {
      if (!waited.ok) return;
      if (pending === mine) pending = undefined;
      run();
    });
  };
  return { push, cancel };
}
