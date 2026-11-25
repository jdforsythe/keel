import type { Settled } from "./Settled.ts";
import { unsafe } from "./unsafe.ts";

/** Awaits `run`, giving its value or the very value it threw or rejected with (std.db errors). */
export async function settle<T>(run: () => Promise<T>): Promise<Settled<T>> {
  return unsafe(
    "std.db passes on its own E2152 and E2153 unchanged and names a failed call by the database's own error code (pg's code, node:sqlite's errcode), both read from the error object the driver throws, which attempt replaces with keel.unexpected text, so the catch must keep the original value",
    async (): Promise<Settled<T>> => {
      try {
        return { threw: false, value: await run() };
      } catch (error) {
        return { threw: true, error };
      }
    },
  );
}
