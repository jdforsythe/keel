import { unsafe } from "./unsafe.ts";

/** Throws the `RangeError` std.temporal specifies for a `ms` that is no integer number of milliseconds within 1e15. */
export function notDuration(ms: number): never {
  return unsafe(
    "std.temporal specifies a throw for durationOf over a non-integer or unbounded count, as encode of an invalid value throws: the count comes from the app's own arithmetic, so a bad one is a bug in that code and never an expected failure a Result would carry",
    () => {
      throw new RangeError(`durationOf: ${ms} is not an integer number of milliseconds within 1e15`);
    },
  );
}
