import type { Settled } from "./Settled.ts";
import { unsafe } from "./unsafe.ts";

/** Awaits `run`, giving its value or the very value it threw or rejected with (std.postgres errors). */
export async function settle<T>(run: () => Promise<T>): Promise<Settled<T>> {
  return unsafe(
    "std.postgres tells a statement's answer by the error object pg or PGlite throws, its SQLSTATE and severity (a serialization failure reruns, a constraint is postgres.constraint, a lost connection keel.unreachable), which attempt replaces with keel.unexpected text, so the catch must keep the original value",
    async (): Promise<Settled<T>> => {
      try {
        return { threw: false, value: await run() };
      } catch (error) {
        return { threw: true, error };
      }
    },
  );
}
