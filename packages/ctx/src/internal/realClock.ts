import type { Clock } from "../Clock.ts";
import { checkMs } from "./checkMs.ts";

/** setTimeout treats delays above 2^31 - 1 ms as 1 ms. */
const MAX_DELAY = 2 ** 31 - 1;

/** Wall clock. One of the few places allowed to read Date.now (k.ctx). */
export function realClock(): Clock {
  return {
    now: () => Date.now(),
    after: (ms, signal) =>
      new Promise<void>((resolve, reject) => {
        checkMs(ms);
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        const onAbort = (): void => {
          clearTimeout(handle);
          reject(signal?.reason);
        };
        const handle = setTimeout(
          () => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
          },
          Math.min(ms, MAX_DELAY),
        );
        signal?.addEventListener("abort", onAbort, { once: true });
      }),
  };
}
