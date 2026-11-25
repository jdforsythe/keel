import type { Settled } from "./Settled.ts";
import { unsafe } from "./unsafe.ts";

/** Runs `run`, giving its value or the very value it threw (std.db errors); the synchronous form of `settle`. */
export function settleNow<T>(run: () => T): Settled<T> {
  return unsafe(
    "node:sqlite calls are synchronous, and std.db passes on its own E2152 and E2153 unchanged and names a failed call by node:sqlite's errcode, read from the error object it throws, which attempt replaces with keel.unexpected text, so the catch must keep the original value",
    (): Settled<T> => {
      try {
        return { threw: false, value: run() };
      } catch (error) {
        return { threw: true, error };
      }
    },
  );
}
