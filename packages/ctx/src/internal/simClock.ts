import type { SimClock } from "../SimClock.ts";
import { checkMs } from "./checkMs.ts";

interface Waiter {
  readonly at: number;
  readonly seq: number;
  readonly resolve: () => void;
  readonly timer?: true;
}

/**
 * Simulated clock at 0. `advance` rejects negative or non-finite ms so time stays monotonic, then resolves
 * every waiter whose deadline it crossed, in deadline order (ties by registration order), before returning.
 * Time steps to each deadline while resolving, so `now()` never reads past a waiter's own deadline. `timers` run
 * synchronously when the clock reaches their `at`, in the same order as waiters; they are not `after` deadlines, so
 * `next()` leaves them out.
 */
export function simClock(timers: readonly { readonly at: number; readonly fn: () => void }[] = []): SimClock {
  let t = 0;
  let seq = 0;
  const waiters = new Set<Waiter>(timers.map(({ at, fn }) => ({ at, seq: seq++, resolve: fn, timer: true })));
  return {
    now: () => t,
    next: () => {
      let min: number | null = null;
      for (const w of waiters) if (w.timer === undefined && (min === null || w.at < min)) min = w.at;
      return min;
    },
    after: (ms, signal) =>
      new Promise<void>((resolve, reject) => {
        checkMs(ms);
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        const w: Waiter = {
          at: t + ms,
          seq: seq++,
          resolve: () => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
          },
        };
        const onAbort = (): void => {
          waiters.delete(w);
          reject(signal?.reason);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        if (ms === 0) {
          w.resolve();
          return;
        }
        waiters.add(w);
      }),
    advance: (ms) => {
      checkMs(ms);
      const target = t + ms;
      const due = [...waiters].filter((w) => w.at <= target).sort((a, b) => a.at - b.at || a.seq - b.seq);
      for (const w of due) {
        waiters.delete(w);
        t = w.at;
        w.resolve();
      }
      t = target;
    },
  };
}
