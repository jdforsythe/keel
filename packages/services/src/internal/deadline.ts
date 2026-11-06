import type { Clock } from "@keel/ctx";

/** setTimeout clamps delays above 2^31 - 1 ms to 1 ms; longer waits re-arm until the clock reaches the deadline. */
const MAX_DELAY = 2 ** 31 - 1;

/** Let a pending sim poll not hold the process open (Node timers have `unref`; browsers return a number). */
function unref(handle: unknown): void {
  if (typeof handle !== "object" || handle === null) return;
  const fn: unknown = Reflect.get(handle, "unref");
  if (typeof fn === "function") Reflect.apply(fn, handle, []);
}

/**
 * Resolves `done` once `clock.now()` reaches `now + ms`. `ctx.clock` exposes no timer (k.ctx), so a sim clock
 * (one with `advance`) is polled once per macrotask; a real clock is re-checked after a platform timer.
 */
export function deadline(clock: Clock, ms: number): { readonly done: Promise<void>; cancel(): void } {
  const at = clock.now() + ms;
  const sim = "advance" in clock;
  let handle: ReturnType<typeof setTimeout> | undefined;
  let live = true;
  const done = new Promise<void>((resolve) => {
    const tick = (): void => {
      if (!live) return;
      const left = at - clock.now();
      if (left <= 0) {
        resolve();
        return;
      }
      handle = setTimeout(tick, sim ? 0 : Math.min(left, MAX_DELAY));
      if (sim) unref(handle);
    };
    tick();
  });
  const cancel = (): void => {
    live = false;
    if (handle !== undefined) clearTimeout(handle);
  };
  return { done, cancel };
}
