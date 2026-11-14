import type { Clock } from "@keel/ctx";

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
    clock.after(ms(), mine.signal).then(
      () => {
        if (pending === mine) pending = undefined;
        run();
      },
      () => {},
    );
  };
  return { push, cancel };
}
